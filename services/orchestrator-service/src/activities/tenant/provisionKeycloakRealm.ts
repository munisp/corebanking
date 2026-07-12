import { KeycloakAdminApiClient } from "../../lib/keycloakAdminApiClient";
import logger from "../../config/logger.config";

export const provisionKeycloakRealm = async (realm: string) => {
  logger.info(`[provisionKeycloakRealm activity] Creating Keycloak realm`, { realm });
  try {
    await KeycloakAdminApiClient.get_instance().create_realm(realm);
    logger.info(`[provisionKeycloakRealm activity] Realm created successfully`, { realm });

    logger.info(`[provisionKeycloakRealm activity] Enabling sub in lightweight token`, { realm });
    // Enable Sub in Lightweight Access Token - Required for Login
    await KeycloakAdminApiClient.get_instance().enable_sub_in_lightweight_token(realm);
    logger.info(`[provisionKeycloakRealm activity] Enabled sub in lightweight token`, { realm });

    logger.info(`[provisionKeycloakRealm activity] Fetching public RSA key`, { realm });
    const public_rsa_key = await KeycloakAdminApiClient.get_instance().get_public_rsa_key(realm);
    logger.info(`[provisionKeycloakRealm activity] Successfully provisioned Keycloak realm`, { realm, hasKey: !!public_rsa_key });

    return {
      realm,
      public_rsa_key,
    };
  } catch (error: any) {
    logger.error(`[provisionKeycloakRealm activity] Failed to provision Keycloak realm`, {
      realm,
      error: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      stack: error?.stack,
    });
    throw error;
  }
};
