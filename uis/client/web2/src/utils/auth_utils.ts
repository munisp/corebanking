import { AppConfig } from '../config/app_config';

/**
 * Get keycloak_id from various sources
 * Tries in order:
 * 1. localStorage 'keycloak_id'
 * 2. Stored user data (user_data)
 * 3. Decode from access token
 * 
 * @returns keycloak_id or null if not found
 */
export function getKeycloakId(): string | null {
  // Try localStorage first (stored after login)
  let keycloakId = localStorage.getItem('keycloak_id');
  if (keycloakId) {
    return keycloakId;
  }

  // Try to get from stored user data
  const storedUserData = localStorage.getItem(AppConfig.userDataKey);
  if (storedUserData) {
    try {
      const user = JSON.parse(storedUserData);
      keycloakId = user.keycloakId || user.keycloak_id || null;
      if (keycloakId) {
        // Store it in localStorage for future use
        localStorage.setItem('keycloak_id', keycloakId);
        return keycloakId;
      }
    } catch (e) {
      console.error('Failed to parse stored user data:', e);
    }
  }

  // Try to decode from access token
  const token = localStorage.getItem(AppConfig.accessTokenKey);
  if (token) {
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        // Add padding if needed for base64 decoding
        let payloadBase64 = tokenParts[1];
        while (payloadBase64.length % 4) {
          payloadBase64 += '=';
        }
        const payload = JSON.parse(atob(payloadBase64));
        keycloakId = payload.sub || payload.keycloak_id || null;
        if (keycloakId) {
          // Store it in localStorage for future use
          localStorage.setItem('keycloak_id', keycloakId);
          return keycloakId;
        }
      }
    } catch (e) {
      console.error('Failed to decode token for keycloak_id:', e);
    }
  }

  return null;
}

/**
 * Get keycloak_id or throw an error if not found
 * @throws Error if keycloak_id cannot be retrieved
 */
export function getKeycloakIdOrThrow(): string {
  const keycloakId = getKeycloakId();
  if (!keycloakId) {
    throw new Error('Unable to retrieve keycloak_id. Please log in again.');
  }
  return keycloakId;
}

