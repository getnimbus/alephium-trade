import { kafkaClient } from "@services/kafka";
import { prisma } from "@services/prisma";
import logger from "@utils/logger";

const env = process.env.ENV;

export const consumeAlephiumEvents = async () => {
  logger.info("Start consume alephium events");
  const consumer = kafkaClient.consumer({
    groupId: "nimbus-api-alph-event-group" + (env || ""),
  });
  await consumer.subscribe({
    topic: "alph-events",
    fromBeginning: true, // TODO: change to false
  });

  await consumer.run({
    autoCommit: true,
    eachMessage: async (payload) => {
      const data = {
        key: payload.message.key?.toString() || "",
        msg: payload.message.value?.toString(),
      };
      if (data.key) {
        const message = JSON.parse(data.msg || "");
        // TODO: handle message
        logger.info(message);
      }
    },
  });

  process.once("SIGINT", () => consumer.disconnect());
  process.once("SIGTERM", () => consumer.disconnect());
};
