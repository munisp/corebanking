  try {
    const kafka = new KafkaCtor({ brokers, clientId: "infra-admin-server" });
    const producer = kafka.producer();
    await producer.connect();
    realProducer = producer;
    state.producerAvailable = true;
    adminClient = kafka.admin();
    await adminClient.connect();
    state.adminAvailable = true;
    logger.info("[Kafka] Real producer + admin client connected (kafkajs)");
  } catch (err: any) {
