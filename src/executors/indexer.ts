import axios from "axios";
import { kafkaClient } from "@services/kafka";
import { prisma } from "@services/prisma";
import { getOrSet } from "src/services/redis";
import { uuidv7 } from "uuidv7";
import logger from "@utils/logger";

const env = process.env.ENV;

const NATIVE_TOKEN_ADDRESS = "tgx7VNFoP9DJiFMFgXXtafQZkUvyEdDHT9ryamHJYrjq";

export const consumeAlephiumEvents = async () => {
  logger.info("Start consume alephium events");
  const consumer = kafkaClient.consumer({
    groupId: "nimbus-api-alph-event-group" + (env || ""),
  });
  await consumer.subscribe({
    topic: "alph-events",
    fromBeginning: false,
  });

  await consumer.run({
    autoCommit: true,
    eachMessage: async (payload) => {
      try {
        const data = {
          key: payload.message.key?.toString() || "",
          msg: payload.message.value?.toString(),
        };

        if (data.key) {
          const message = JSON.parse(data.msg || "");

          // Trade data event
          if (message?.fields?.length === 6) {
            const nativePrice = await getOrSet(
              `ALPH_native_price`,
              async () => {
                const price = await axios
                  .get(
                    "https://coins.llama.fi/prices/current/coingecko:alephium"
                  )
                  .then((res) => {
                    return res.data;
                  });
                return Number(price?.coins?.["coingecko:alephium"]?.price || 0);
              },
              5 * 60 // 5 mins
            );

            const poolInfo = await getOrSet(
              `ALPH_pool_info_${message.contractAddress}`,
              async () => {
                const pool = await prisma.pool.findFirst({
                  where: {
                    pool: message.contractAddress,
                    chain: "ALPH",
                  },
                });
                return pool;
              },
              60 * 60 // 1 hour
            );

            if (!poolInfo) {
              return;
            }

            if (
              ![poolInfo.token0, poolInfo.token1].includes(NATIVE_TOKEN_ADDRESS)
            ) {
              return;
            }

            console.log(message?.fields?.[0]?.value);

            const from_token_address =
              Number(message?.fields?.[1]?.value || 0) > 0
                ? poolInfo.token0
                : poolInfo.token1;
            const to_token_address =
              Number(message?.fields?.[1]?.value || 0) > 0
                ? poolInfo.token1
                : poolInfo.token0;
            const quanlity_in =
              Number(message?.fields?.[1]?.value || 0) /
                10 ** Number(poolInfo.token0Decimal || 18) ||
              Number(message?.fields?.[2]?.value || 0) /
                10 ** Number(poolInfo.token1Decimal || 18);
            const quanlity_out =
              Number(message?.fields?.[3]?.value || 0) /
                10 ** Number(poolInfo.token0Decimal || 18) ||
              Number(message?.fields?.[4]?.value || 0) /
                10 ** Number(poolInfo.token1Decimal || 18);
            const amount_usd =
              from_token_address ===
              "0000000000000000000000000000000000000000000000000000000000000000"
                ? quanlity_in * nativePrice
                : quanlity_out * nativePrice;

            await prisma.trade.createMany({
              data: [
                {
                  id: uuidv7(),
                  block: message.blockHash,
                  tx_hash: message.txId,
                  from_token_address,
                  to_token_address,
                  sender_address: message?.fields?.[0]?.value || "",
                  origin_sender_address: message?.fields?.[0]?.value || "",
                  quanlity_in,
                  quanlity_out,
                  log_index: message.eventIndex,
                  exchange_name: poolInfo.exchangeName,
                  timestamp: new Date(message.timestamp),
                  pool_address: message.contractAddress,
                  amount_usd,
                  chain: "ALPH",
                  native_price: nativePrice,
                },
              ],
              skipDuplicates: true,
            });

            logger.info(
              `Consumed swap trade ${payload.message.key?.toString() || ""}`
            );
          }
        }
      } catch (err) {
        logger.error(err);
      }
    },
  });

  process.once("SIGINT", () => consumer.disconnect());
  process.once("SIGTERM", () => consumer.disconnect());
};
