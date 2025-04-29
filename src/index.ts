import "dotenv/config";
import { initKafka } from "@services/kafka";
import { consumeAlephiumEvents } from "@executors/indexer";
import { syncPoolInfo } from "@executors/pool";
import { syncPriceFeed } from "@executors/price-feed";
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
