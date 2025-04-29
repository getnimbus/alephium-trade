import "dotenv/config";
import cron from "node-cron";
import axios from "axios";
import { prisma } from "@services/prisma";
import { uuidv7 } from "uuidv7";
import { addressFromContractId } from "@alephium/web3";
import logger from "@utils/logger";

export const syncPoolInfo = (syncNow: boolean = false) => {
  if (syncNow) {
    (async () => {
      try {
        await Promise.allSettled([
          syncPoolInfoFromAyin(),
          syncPoolInfoFromElexium(),
        ]);
      } catch (err) {
        logger.error(err);
      }
    })();
  }

  cron.schedule(
    "0 * * * *", // every hour
    async () => {
      try {
        await Promise.allSettled([
          syncPoolInfoFromAyin(),
          syncPoolInfoFromElexium(),
        ]);
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

const syncPoolInfoFromElexium = async () => {
  try {
    logger.info("Syncing pool info from Elexium");

    const poolsData = await axios
      .get("https://api.elexium.finance/pools")
      .then((res) => {
        return res.data || [];
      });

    if (poolsData.length === 0) {
      return;
    }

    await prisma.pool.createMany({
      data: poolsData.map((pool: any) => {
        return {
          id: uuidv7(),
          pool: pool.address,
          token0: addressFromContractId(pool.token0.id),
          token0Decimal: Number(pool.token0.decimals),
          token1: addressFromContractId(pool.token1.id),
          token1Decimal: Number(pool.token1.decimals),
          fee: 0,
          exchangeName: "Elexium",
          chain: "ALPH",
        };
      }),
      skipDuplicates: true,
    });

    logger.info("Pool info synced from Elexium");
  } catch (err) {
    logger.error(err);
  }
};

const syncPoolInfoFromAyin = async () => {
  try {
    logger.info("Syncing pool info from Ayin");

    const poolsData = await axios
      .get("https://analytics.ayin.app/api/pools/all")
      .then((res) => {
        return res.data?.data || [];
      });

    if (poolsData.length === 0) {
      return;
    }

    await prisma.pool.createMany({
      data: poolsData.map((pool: any) => {
        return {
          id: uuidv7(),
          pool: pool.address,
          token0: addressFromContractId(pool.token0.id),
          token0Decimal: Number(pool.token0.decimals),
          token1: addressFromContractId(pool.token1.id),
          token1Decimal: Number(pool.token1.decimals),
          fee: 0,
          exchangeName: "AYIN",
          chain: "ALPH",
        };
      }),
      skipDuplicates: true,
    });

    logger.info("Pool info synced from Ayin");
  } catch (err) {
    logger.error(err);
  }
};
