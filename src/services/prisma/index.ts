import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

export { Prisma };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({
  // log: ["query", "info", "warn", "error"],
  adapter,
  transactionOptions: {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable, // lock both read and write
    maxWait: 60000, // 60 seconds
    timeout: 5 * 60000, // 5 mins
  },
});

// Exclude keys from user
export function excludeField(user: object | null | undefined, keys: string[]) {
  if (!user) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(user).filter(([key]) => !keys.includes(key))
  );
}
