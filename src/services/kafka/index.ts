import { Kafka, CompressionTypes, CompressionCodecs, logLevel } from "kafkajs";
import SnappyCodec from "kafkajs-snappy";
import logger from "@utils/logger";

CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;

export const kafkaClient = new Kafka({
  clientId: "alephium-trade",
  brokers: String(
    process.env.KAFKA_BROKERS ||
      "internal.background-service.getnimbus.xyz:19092"
  )
    .split(",")
    .filter(Boolean),
  logLevel: logLevel.ERROR,
});

export const producer = kafkaClient.producer();

export const admin = kafkaClient.admin();

export const initKafka = async () => {
  try {
    await Promise.all([producer.connect(), admin.connect()]);
  } catch (err) {
    logger.error(err);
  }
};

export const closeKafka = async () => {
  try {
    await Promise.all([producer.disconnect(), admin.disconnect()]);
  } catch (err) {
    logger.error(err);
  }
};

export const isHealthyKafka = async () => {
  try {
    const topics = await admin.listTopics();
    return topics.length > 0;
  } catch (err) {
    logger.error(err);
  }
};
