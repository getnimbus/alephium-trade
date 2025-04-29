import dayjs from "dayjs";
import Redis from "ioredis";
import { parse, stringify, isInteger } from "lossless-json";
import { RedisMissedError } from "@utils/error";
import { timeoutPromise } from "@utils/misc";
import logger from "@utils/logger";

const NO_CACHE = process.env.NO_CACHE;
const REDIS_LOG = process.env.REDIS_LOG;

export let client = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    enableAutoPipelining: true,
    db: 0,
  }
);

async function createRedisClient() {
  const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    enableAutoPipelining: true,
    db: 0,
  });

  client.on("error", (err) => {
    logger.error(err);
  });

  await client.connect();
  return client;
}

export async function getRedisClient(numRetries: number = 1) {
  try {
    if (!client) {
      client = await createRedisClient();
    }
    return client;
  } catch (err) {
    if (numRetries > 0) {
      return getRedisClient(numRetries - 1);
    }
    throw err;
  }
}

export function customNumberParser(value: any) {
  return isInteger(value) ? BigInt(value) : parseFloat(value);
}

// const customNumberParser = undefined;
// TODO: Cache in memory of this function. Maybe usefull in serverless env. USING FIFO
type Parameters<T> = T extends (...args: infer T) => any ? T : never;
type ReturnType<T> = T extends (...args: any[]) => infer T ? T : never;

type WrapAsyncFunction<T, V = any> = (
  ...args: Parameters<T>
) => Promise<Awaited<ReturnType<T>>> | Promise<V>;

const MemoryCache: Record<string, any> = {};

export const wait = (time: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, time);
  });
};

const BLOCK_TTL = 5; // 5 seconds
const POLL_INTERVAL = 200; // 200ms

export const memorizeFunction = <T extends Function, V = any>(
  keyPrefix: string,
  fn: T,
  {
    defaultValue,
    ttl,
    keyFn,
    memory = false,
    disabled = false,
    normalJSON = true,
    throwOnError = false,
    timeout,
  }: {
    defaultValue?: V;
    ttl?: number;
    keyFn?: (input: Parameters<T>) => string | number;
    memory?: boolean;
    disabled?: boolean;
    normalJSON?: boolean;
    throwOnError?: boolean;
    timeout?: number;
  }
): WrapAsyncFunction<T, V> => {
  const cachedFn = async (...input) => {
    try {
      const prune = input[input.length - 1]?.prune || false;
      if (prune) {
        // Remove the prune option from the key
        input.pop();
      }

      const key =
        input.length > 0
          ? `${keyPrefix}_${keyFn ? keyFn(input) : stringify(input)}`
          : keyPrefix;

      if (disabled || NO_CACHE) {
        // Ignore cache in dev mode or we disabled it
        REDIS_LOG && logger.info(`DISABLED CACHE: ${key}`);
        return await fn(...input);
      }

      if (memory) {
        const cachedValue = MemoryCache[key];
        if (cachedValue && cachedValue?.expiredTime > dayjs().unix) {
          return cachedValue.returnValue;
        }

        const returnValue = await fn(...input);
        MemoryCache[key] = {
          returnValue,
          expiredTime: dayjs().unix() + (ttl || 365 * 24 * 60 * 60),
        };

        return returnValue;
      }

      const client = await getRedisClient();

      const cachedValue = prune
        ? undefined
        : await client.get(key).catch((err) => {
            logger.error(err);

            return undefined;
          });

      if (cachedValue === "blocked") {
        REDIS_LOG && logger.info(`WAITING: ${key}`);
        await wait(POLL_INTERVAL);
        return await cachedFn(...input);
      }

      if (cachedValue) {
        REDIS_LOG && logger.info(`HIT: ${key}`);
        return normalJSON
          ? JSON.parse(cachedValue).value
          : parse(cachedValue, null, customNumberParser).value;
      }

      REDIS_LOG && logger.info(`MISS: ${key}, TTL: ${ttl}`);
      // Set blocked state if key does not exists
      await client.set(key, "blocked", "EX", BLOCK_TTL, "NX");

      // Wrap the function execution in Promise.race if timeout is specified
      const executeFn = async () => {
        const returnValue = await fn(...input);

        // Save to Redis
        const valueJSON = normalJSON
          ? JSON.stringify({ value: returnValue })
          : stringify({ value: returnValue });
        try {
          if (valueJSON !== undefined) {
            if (ttl) {
              await client.setex(key, ttl, valueJSON);
            } else {
              await client.set(key, valueJSON);
            }
          } else {
            await client.del(key); // delete key for "blocked" state
          }
        } catch (err) {
          logger.error(`Cache failed ${key}: ${err}`);
        }

        return returnValue;
      };

      if (timeout) {
        return await Promise.race([timeoutPromise(timeout), executeFn()]);
      }

      return await executeFn();
    } catch (err) {
      logger.error(err);
      if (throwOnError) {
        throw err;
      }
      return defaultValue;
    }
  };

  return cachedFn;
};

export const purgeCache = async (keyPrefix: string, input?: any[]) => {
  try {
    const client = await getRedisClient();

    if (!input) {
      await Promise.allSettled([
        client.unlink(keyPrefix),
        client
          .keys(keyPrefix)
          .then(async (keys) => {
            if (!keys.length) {
              return;
            }

            logger.info(`Going to unlink keys ${keys}`);
            await client.unlink(keys);

            return keys;
          })
          .catch((err) => {
            logger.error(err);
          }),
      ]);

      logger.info(`Done delete ${keyPrefix}`);
      return;
    }

    const key = `${keyPrefix}_${JSON.stringify(input)}`;
    await client.unlink(key);
    logger.info(`Done delete ${key}`);
  } catch (err) {
    logger.error(err);
  }
};

export const multiSetCache = async (data: any, ttl = 0) => {
  try {
    const client = await getRedisClient();

    await client.mset(data);
    if (ttl) {
      await client
        .multi(Object.keys(data).map((key) => ["expire", key, ttl]))
        .exec();
    }
  } catch (err) {
    logger.error(err);
    await client.unlink(Object.keys(data)).catch((err) => {
      logger.error(err);
    });
  }
};

export const multiInvalidateCache = async (keys: string | string[]) => {
  try {
    const client = await getRedisClient();

    if (typeof keys === "string") {
      keys = [keys];
    }
    await client.unlink(keys);
  } catch (err) {
    logger.error(err);
  }
};

export const getOrSet = async <T extends Function>(
  key: string,
  fn: T,
  ttl = 0,
  disabled = false,
  throwOnError?: boolean,
  timeout?: number
): Promise<ReturnType<T>> => {
  if (NO_CACHE || disabled) {
    // Ignore cache in dev mode or we disabled it
    logger.info(`DISABLED CACHE: ${key}`);
    return await fn();
  }

  const cachedFn = async () => {
    try {
      const client = await getRedisClient();

      REDIS_LOG && logger.info(`Get or set ${key}`);
      const cachedValue = await client.get(key);

      if (cachedValue === "blocked") {
        REDIS_LOG && logger.info(`WAITING: ${key}`);
        await wait(POLL_INTERVAL);
        return await cachedFn();
      }

      if (cachedValue) {
        REDIS_LOG && logger.info(`HIT: ${key}`);
        return JSON.parse(cachedValue).value;
      }

      REDIS_LOG && logger.info(`MISS: ${key}, TTL: ${ttl}`);
      // Set blocked state if key does not exists
      await client.set(key, "blocked", "EX", BLOCK_TTL, "NX");

      // Wrap the function execution in Promise.race if timeout is specified
      const executeFn = async () => {
        const returnValue = await fn();

        const valueJSON = JSON.stringify({ value: returnValue });
        try {
          if (valueJSON !== undefined) {
            if (ttl) {
              await client.setex(key, ttl, valueJSON);
            } else {
              await client.set(key, valueJSON);
            }
          } else {
            await client.del(key); // delete key for "blocked" state
          }
        } catch (err) {
          logger.error(`Cache failed ${key}: ${err}`);
        }

        return returnValue;
      };

      if (timeout) {
        return await Promise.race([timeoutPromise(timeout), executeFn()]);
      }

      return await executeFn();
    } catch (err) {
      logger.error(err);
      if (throwOnError) {
        throw err;
      }
    }
  };

  return cachedFn();
};

interface ICacheOptions {
  protocol: string;
  key: string;
  ttl?: number;
}

export const setCache = async (value: any, options: ICacheOptions) => {
  const client = await getRedisClient();

  const key = getKey(options);

  try {
    const valueJSON = JSON.stringify({ value });
    if (options.ttl) {
      await client.setex(key, options.ttl, valueJSON);
    } else {
      await client.set(key, valueJSON);
    }
  } catch (err) {
    logger.error(`Cache failed ${key}: ${err}`);
  }

  return true;
};

export const getCache = async (options: ICacheOptions) => {
  const client = await getRedisClient();

  const key = getKey(options);
  const cachedValue = await client.get(key);
  if (cachedValue && cachedValue !== "blocked") {
    return JSON.parse(cachedValue).value;
  }

  return undefined;
};

export const setRedis = async (
  key: string,
  data: any,
  ttl = 0,
  isPure = false
) => {
  const client = await getRedisClient();

  const valueJSON = isPure
    ? JSON.stringify({ value: data })
    : stringify({ value: data });
  if (valueJSON !== undefined) {
    if (ttl) {
      await client.setex(key, ttl, valueJSON);
    } else {
      await client.set(key, valueJSON);
    }
  }
};

export const getRedis = async (
  key: string,
  defaultValue?: any,
  isPure = false
) => {
  const client = await getRedisClient();

  const cachedValue = await client.get(key);
  if (cachedValue && cachedValue !== "blocked") {
    // logger.info(`HIT: ${key}`);
    if (isPure) {
      return JSON.parse(cachedValue).value;
    }
    return parse(cachedValue, null, customNumberParser).value;
  }

  if (defaultValue !== undefined) {
    return defaultValue;
  }

  throw new RedisMissedError(`${key} is MISS on redis`);
};

export const chainNameToId = (chainName: string): number => {
  switch (chainName) {
    case "bsc":
      return 56;
    case "eth":
      return 1;
    case "polygon":
      return 137;
    case "avalanche":
      return 43114;
    case "fantom":
      return 250;
    default:
      return 0;
  }
};

export const hex2Dec = (hex: string) => parseInt(hex, 16);

export const retryAsyncCall = async <T>(
  fn: () => Promise<T>,
  times: number = 3
): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    if (times <= 1) {
      throw err;
    }
    return retryAsyncCall(fn, times - 1);
  }
};

export default {};

// Add this new function
export const clearRedisKeysByKeyword = async (
  keyword: string
): Promise<number> => {
  try {
    const client = await getRedisClient();

    const keys = await client.keys(`*${keyword}*`);
    if (keys.length === 0) {
      logger.info(`No keys found containing the keyword: ${keyword}`);
      return 0;
    }

    const deletedCount = await client.unlink(...keys);
    logger.info(
      `Deleted ${deletedCount} keys containing the keyword: ${keyword}`
    );
    return deletedCount;
  } catch (err) {
    logger.error(err);
    throw err;
  }
};
