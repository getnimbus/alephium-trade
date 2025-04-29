import { Request, Response } from "express";
import { prisma } from "@services/prisma";
import { getOrSet } from "@services/redis";
import {
  addressFromContractId,
  binToHex,
  contractIdFromAddress,
} from "@alephium/web3";
import logger from "@utils/logger";

export const getTokenPriceHandler = async (req: Request, res: Response) => {
  try {
    const address = String(req.query.address || "");
    const contractId = String(req.query.contractId || "");
    if (!address && !contractId) {
      return res
        .status(400)
        .json({ error: "Contract address or contract id is required" });
    }

    const queryAddress = address || addressFromContractId(contractId);

    const [prices, tokenInfo] = await Promise.all([
      getOrSet(
        `ALPH-token-price:${queryAddress}`,
        async () => {
          return await prisma.alephiumPriceFeed.findMany({
            select: {
              price: true,
              timestamp: true,
            },
            where: {
              contract_address: queryAddress,
            },
            orderBy: {
              timestamp: "desc",
            },
            take: 1,
          });
        },
        5 * 60 // 5 mins
      ),
      getOrSet(
        `ALPH-token-info:${queryAddress}`,
        async () => {
          return await prisma.token.findFirst({
            where: {
              tokenAddress: queryAddress,
              chain: "ALPH",
            },
          });
        },
        60 * 60 // 1 hour
      ),
    ]);

    res.json({
      id: tokenInfo?.tokenAddress
        ? binToHex(contractIdFromAddress(tokenInfo.tokenAddress))
        : undefined,
      address: tokenInfo?.tokenAddress,
      name: tokenInfo?.tokenName,
      symbol: tokenInfo?.tokenSymbol,
      decimals: tokenInfo?.tokenDecimals,
      logo: tokenInfo?.logo,
      price: Number(prices?.[0]?.price || 0),
      timestamp: prices?.[0]?.timestamp || Date.now(),
    });
  } catch (error) {
    logger.error("Error fetching prices:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
