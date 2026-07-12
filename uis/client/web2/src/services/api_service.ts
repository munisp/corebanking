import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
} from "axios";
import { AppConfig } from "../config/app_config";

class ApiService {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: AppConfig.baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor: Add headers from localStorage
    this.axiosInstance.interceptors.request.use((config) => {
      if (!config.headers) {
        config.headers = {} as typeof config.headers;
      }

      // Add auth token
      const token = localStorage.getItem(AppConfig.accessTokenKey);
      if (token) {
        if (typeof config.headers.set === "function") {
          config.headers.set("Authorization", `Bearer ${token}`);
        } else {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      // Add keycloak_id header
      const keycloakId = localStorage.getItem("keycloak_id");
      if (keycloakId) {
        if (typeof config.headers.set === "function") {
          config.headers.set("x-keycloak-id", keycloakId);
        } else {
          config.headers["x-keycloak-id"] = keycloakId;
        }
      }

      const defualtAccountId = JSON.parse(localStorage.getItem("user") || "{}");
      if (defualtAccountId) {
        if (typeof config.headers.set === "function") {
          config.headers.set(
            "x-default-account-id",
            defualtAccountId?.account_id,
          );
        } else {
          config.headers["x-default-account-id"] = defualtAccountId?.account_id;
        }
      }

      // Add tenant headers
      const tenantConfigStr = localStorage.getItem("tenant_config");
      if (tenantConfigStr) {
        try {
          const tenantConfig = JSON.parse(tenantConfigStr);

          // Add x-tenant-id header
          const tenantId = tenantConfig.tenant_id || tenantConfig.id;
          if (tenantId) {
            if (typeof config.headers.set === "function") {
              config.headers.set("x-tenant-id", String(tenantId));
            } else {
              config.headers["x-tenant-id"] = String(tenantId);
            }
          }

          // Get feature flags
          const featureFlags = tenantConfig.feature_flags;

          if (Array.isArray(featureFlags)) {
            // Raw server data format
            const authFeature = featureFlags.find(
              (flag: Record<string, unknown>) =>
                flag.name === "auth" && flag.is_enabled,
            ) as
              | { config?: { realm?: string; public_rsa_key?: string } }
              | undefined;

            if (authFeature?.config) {
              if (authFeature.config.realm) {
                if (typeof config.headers.set === "function") {
                  config.headers.set(
                    "x-keycloak-realm",
                    authFeature.config.realm,
                  );
                } else {
                  config.headers["x-keycloak-realm"] = authFeature.config.realm;
                }
              }
              if (authFeature.config.public_rsa_key) {
                if (typeof config.headers.set === "function") {
                  config.headers.set(
                    "x-keycloak-pub-key",
                    authFeature.config.public_rsa_key,
                  );
                } else {
                  config.headers["x-keycloak-pub-key"] =
                    authFeature.config.public_rsa_key;
                }
              }
            }

            const accountsFeature = featureFlags.find(
              (flag: Record<string, unknown>) =>
                flag.name === "accounts" && flag.is_enabled,
            ) as
              | { config?: { account?: { id?: string; ledger_id?: string } } }
              | undefined;

            if (accountsFeature?.config?.account?.id) {
              if (typeof config.headers.set === "function") {
                config.headers.set(
                  "x-mint-account-id",
                  String(accountsFeature.config.account.id),
                );
                config.headers.set(
                  "x-mint-id",
                  String(accountsFeature.config.account.id),
                );
              } else {
                config.headers["x-mint-account-id"] = String(
                  accountsFeature.config.account.id,
                );
                config.headers["x-mint-id"] = String(
                  accountsFeature.config.account.id,
                );
              }
            }

            // Add x-ledger-id from accounts feature config
            if (accountsFeature?.config?.account?.ledger_id) {
              if (typeof config.headers.set === "function") {
                config.headers.set(
                  "x-ledger-id",
                  String(accountsFeature.config.account.ledger_id),
                );
              } else {
                config.headers["x-ledger-id"] = String(
                  accountsFeature.config.account.ledger_id,
                );
              }
            }
          } else if (featureFlags && typeof featureFlags === "object") {
            // Transformed client data format
            const featuresObj = featureFlags as Record<string, unknown>;
            const authConfig = (featuresObj.authConfig ||
              featuresObj.auth_config) as
              | { realm?: string; public_rsa_key?: string }
              | undefined;
            if (authConfig) {
              if (authConfig.realm) {
                if (typeof config.headers.set === "function") {
                  config.headers.set("x-keycloak-realm", authConfig.realm);
                } else {
                  config.headers["x-keycloak-realm"] = authConfig.realm;
                }
              }
              if (authConfig.public_rsa_key) {
                if (typeof config.headers.set === "function") {
                  config.headers.set(
                    "x-keycloak-pub-key",
                    authConfig.public_rsa_key,
                  );
                } else {
                  config.headers["x-keycloak-pub-key"] =
                    authConfig.public_rsa_key;
                }
              }
            }

            const accountsConfig = (featuresObj.accountsConfig ||
              featuresObj.accounts_config) as
              | { account?: { id?: string; ledger_id?: string } }
              | undefined;
            if (accountsConfig?.account?.id) {
              if (typeof config.headers.set === "function") {
                config.headers.set(
                  "x-mint-account-id",
                  String(accountsConfig.account.id),
                );
                config.headers.set(
                  "x-mint-id",
                  String(accountsConfig.account.id),
                );
              } else {
                config.headers["x-mint-account-id"] = String(
                  accountsConfig.account.id,
                );
                config.headers["x-mint-id"] = String(accountsConfig.account.id);
              }
            }

            // Add x-ledger-id from accounts config
            if (accountsConfig?.account?.ledger_id) {
              if (typeof config.headers.set === "function") {
                config.headers.set(
                  "x-ledger-id",
                  String(accountsConfig.account.ledger_id),
                );
              } else {
                config.headers["x-ledger-id"] = String(
                  accountsConfig.account.ledger_id,
                );
              }
            }
          }
        } catch (e) {
          console.error("[API Service] Error parsing tenant config:", e);
        }
      }

      // Ensure x-tenant-id is always set even when tenant_config is absent from storage
      if (!config.headers["x-tenant-id"]) {
        if (typeof config.headers.set === "function") {
          config.headers.set("x-tenant-id", AppConfig.DEFAULT_TENANT_ID);
        } else {
          config.headers["x-tenant-id"] = AppConfig.DEFAULT_TENANT_ID;
        }
      }

      return config;
    });

    // Response interceptor: handle 401
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          const currentPath = window.location.pathname;
          const isAuthPage =
            currentPath.includes("/login") ||
            currentPath.includes("/register") ||
            currentPath.includes("/onboarding");

          if (!isAuthPage) {
            this.clearStorage();
            window.location.href = "/login";
          }
        }
        return Promise.reject(error);
      },
    );
  }

  // GET request
  async get<T = unknown>(
    path: string,
    params?: Record<string, unknown>,
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.get<T>(path, { params });
  }

  // POST request
  async post<T = unknown>(
    path: string,
    data?: unknown,
    params?: Record<string, unknown>,
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.post<T>(path, data, { params });
  }

  // PUT request
  async put<T = unknown>(
    path: string,
    data?: unknown,
    params?: Record<string, unknown>,
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.put<T>(path, data, { params });
  }

  // DELETE request
  async delete<T = unknown>(
    path: string,
    params?: Record<string, unknown>,
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.delete<T>(path, { params });
  }

  // Get stored token
  getToken(): string | null {
    return localStorage.getItem(AppConfig.accessTokenKey);
  }

  // Clear all storage
  clearStorage(): void {
    localStorage.removeItem(AppConfig.accessTokenKey);
    localStorage.removeItem(AppConfig.refreshTokenKey);
  }
}

export const apiService = new ApiService();
