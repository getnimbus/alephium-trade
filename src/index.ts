import "dotenv/config";
import { initKafka } from "@services/kafka";
import { consumeAlephiumEvents } from "src/executor";
import logger from "@utils/logger";

const main = async () => {
  await initKafka();
  await consumeAlephiumEvents();
};

main().catch(async (err) => {
  logger.error(err);
});
