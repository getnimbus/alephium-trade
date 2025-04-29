import { Request, Response } from "express";
import { prisma } from "@services/prisma";
import { getOrSet } from "@services/redis";
import { binToHex, contractIdFromAddress } from "@alephium/web3";
import logger from "@utils/logger";

/**
 * @swagger
 * /api/prices:
 *   get:
 *     summary: Get token price and information
 *     description: Returns the latest price and information for a specific Alephium token
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: The contract address of the token
 *     responses:
 *       200:
 *         description: Token price and information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: Contract ID in hex format
 *                 address:
 *                   type: string
 *                   description: Token contract address
 *                 name:
 *                   type: string
 *                   description: Token name
 *                 symbol:
 *                   type: string
 *                   description: Token symbol
 *                 decimals:
 *                   type: number
 *                   description: Token decimals
 *                 logo:
 *                   type: string
 *                   description: Token logo URL
 *                 price:
 *                   type: number
 *                   description: Latest token price
 *                 timestamp:
 *                   type: number
 *                   description: Price timestamp
 *       400:
 *         description: Bad request - contract address is required
 *       500:
 *         description: Internal server error
 */
export const getTokenPriceHandler = async (req: Request, res: Response) => {
  try {
    const address = String(req.query.address || "");
    if (!address) {
      return res.status(400).json({ error: "Contract address is required" });
    }

    const [prices, tokenInfo] = await Promise.all([
      getOrSet(
        `ALPH-token-price:${address}`,
        async () => {
          return await prisma.alephiumPriceFeed.findMany({
            select: {
              price: true,
              timestamp: true,
            },
            where: {
              contract_address: address,
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
        `ALPH-token-info:${address}`,
        async () => {
          return await prisma.token.findFirst({
            where: {
              tokenAddress: address,
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
