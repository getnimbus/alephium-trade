import "dotenv/config";
import cron from "node-cron";
import { prisma } from "@services/prisma";
import logger from "@utils/logger";

export const syncPriceFeed = (syncNow: boolean = false) => {
  if (syncNow) {
    (async () => {
      try {
        await Promise.allSettled([calculatePriceData()]);
      } catch (err) {
        logger.error(err);
      }
    })();
  }

  cron.schedule(
    "* * * * *", // every minute
    async () => {
      try {
        await Promise.allSettled([calculatePriceData()]);
      } catch (err) {
        logger.error(err);
      }
    },
    {
      scheduled: true,
      timezone: "UTC",
    }
  );
};

const calculatePriceData = async () => {
  try {
    logger.info("Calculating price data");

    await prisma.$executeRaw`
      INSERT INTO alephium_price_feed
      WITH token_swap AS (		
        SELECT
          block,
          from_token_address,
          to_token_address,
          amount_usd/quanlity_in AS from_price,
          amount_usd/quanlity_out AS to_price,
          timestamp
        FROM trade_alephium
        WHERE chain = 'ALPH'
        AND amount_usd > 0
        AND quanlity_out > 0
        AND quanlity_in > 0
        AND "timestamp" BETWEEN NOW() - INTERVAL '5 MINUTE' AND NOW()
        ORDER BY "timestamp" DESC
      ),
      token_data AS (
        SELECT
          from_token_address AS token_address,
          from_price AS price
        FROM token_swap
        UNION ALL
        SELECT
          to_token_address AS token_address,
          to_price AS price
        FROM token_swap
      ),
      token_prices AS (
        SELECT token_address, AVG(price) AS price FROM token_data GROUP BY token_address
      )
      SELECT
        uuid_generate_v4() AS id,
        token_address AS contract_address,
        price,
        ROUND(EXTRACT(EPOCH FROM date_trunc('minute', CURRENT_TIMESTAMP))) * 1000 AS "timestamp" 
      FROM token_prices;`;

    logger.info("Price data calculated");
  } catch (err) {
    logger.error(err);
  }
};
