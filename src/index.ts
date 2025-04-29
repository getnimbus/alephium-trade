import "dotenv/config";
import { initKafka } from "@services/kafka";
import { consumeAlephiumEvents } from "src/executor/indexer";
import { syncPoolInfo } from "./executor/pool";
import { syncPriceFeed } from "./executor/price-feed";
import logger from "@utils/logger";

const main = async () => {
  await initKafka();
  syncPoolInfo();
  syncPriceFeed();
  await consumeAlephiumEvents();
};

main().catch(async (err) => {
  logger.error(err);
});
