import logger from "../config/logger.config";
import { initializeDatabase } from "../database/initDatabase";
import { AppDataSource } from "../database/dataSource";
import { ClientEntity } from "../entity/ClientEntity";
import { readEnv } from "../config/readEnv.config";

async function seedDefaultClient(): Promise<void> {
  try {
    const clientId     = readEnv("DEFAULT_CLIENT_ID",     "54link-orchestrator") as string;
    // Fail closed: the client secret must be provided via the environment;
    // no credential default is ever embedded in source.
    const clientSecret = readEnv("DEFAULT_CLIENT_SECRET") as string;
    if (!clientSecret) {
      throw new Error("DEFAULT_CLIENT_SECRET environment variable must be set to seed the default client");
    }

    const existing = await AppDataSource.manager.findOne(ClientEntity, {
      where: { client_id: clientId },
    });

    if (existing) return;

    const client = AppDataSource.manager.create(ClientEntity, {
      client_id:                  clientId,
      client_secret:              clientSecret,
      client_name:                "54link Orchestrator",
      contact_first_name:         "System",
      contact_last_name:          "Admin",
      contact_email:              "admin@54link.com",
      redirect_urls:              [],
      callback_url:               undefined,
      ballerine_customer_id:      "",
      ballerine_customer_api_key: "",
    });

    await AppDataSource.manager.save(client);
    logger.info(`[seed] Default verification client created — id=${clientId}`);
  } catch (err: any) {
    logger.warn(`[seed] Client seed failed (non-fatal): ${err.message}`);
  }
}

export async function tryInitializeDatabase(): Promise<void> {
  try {
    await initializeDatabase();
    await seedDefaultClient();
  } catch (error: any) {
    // If the DataSource is already initialized the connection is usable — stop retrying
    if (AppDataSource.isInitialized) {
      logger.warn(`[tryInitializeDatabase] post-init step failed but DB is connected (non-fatal): ${error.message}`);
      await seedDefaultClient();
      return;
    }
    logger.error("Database Initialization error: " + error.message);
    logger.info("Retrying in 3 seconds...");
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setTimeout(tryInitializeDatabase, 3000);
  }
}
