import aicpa from "@/assets/certifications/aicpa.png";
import iso from "@/assets/certifications/iso.png";
import logo from "@/assets/certifications/logos/logo.png";
import nist from "@/assets/certifications/nist.png";
import pci from "@/assets/certifications/pci.png";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { getAdminByKeycloakId } from "@/services/admin";
import { useAuth } from "@/services/auth";
import { branchService } from "@/services/branch";
import { temporalAccessService } from "@/services/temporalAccessService";
// import { onboardingService } from '@/services/onboarding';
import { tenantService } from "@/services/tenant";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, isLoading, error: authError } = useAuth();
  const { name, logoUrl, primaryColor, secondaryColor } = useTenantBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // COMMENTED OUT: User role state
  // const [userRole, setUserRole] = useState<UserRole>('admin');
  const [error, setError] = useState("");
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Fetch tenant config on mount - MUST complete before login
  useEffect(() => {
    const fetchTenantConfig = async () => {
      setIsLoadingTenant(true);
      try {
        // Load tenant config
        await tenantService.getTenant();
        console.log("Tenant config loaded for login");

        // COMMENTED OUT: User role loading
        // Load saved user role from localStorage
        // const savedRole = localStorage.getItem('user_role') as UserRole | null;
        // if (savedRole && ['admin', 'super_admin', 'super_tenant'].includes(savedRole)) {
        //   setUserRole(savedRole);
        // }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          "Failed to fetch tenant config before login:",
          errorMessage,
        );
        setError(`Failed to load tenant configuration: ${errorMessage}`);
      } finally {
        setIsLoadingTenant(false);
      }
    };

    fetchTenantConfig();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Ensure tenant config is loaded before attempting login
    if (isLoadingTenant) {
      setError("Please wait, loading tenant configuration...");
      return;
    }

    // Double-check tenant config exists
    if (!tenantService.hasTenantConfig()) {
      setError("Tenant configuration is required. Please refresh the page.");
      return;
    }

    try {
      // COMMENTED OUT: User role storage
      // localStorage.setItem('user_role', userRole);

      await login(email, password);

      // Store tenant role — fetch from admin-service since auth-service does not return tenant_role
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const keycloakId = localStorage.getItem("keycloak_id");
        let tenantRole = "support_agent";

        if (keycloakId) {
          try {
            const adminRes = (await getAdminByKeycloakId(keycloakId)) as any;
            const admin = adminRes?.admin;
            if (admin?.access_level) {
              tenantRole = admin.access_level;
              // Cache admin data for sidebar/dashboard
              localStorage.setItem("admin_data", JSON.stringify(admin));

              // Always clear branch keys first — ensures a tenant admin logging in
              // after a branch admin doesn't inherit stale branch scoping
              localStorage.removeItem("branch_id");
              localStorage.removeItem("branch_feature_flags");

              // Ensure keycloak_id is always stored as a top-level key so usePermissions can find it
              if (admin.keycloak_id && !localStorage.getItem("keycloak_id")) {
                localStorage.setItem("keycloak_id", admin.keycloak_id);
              }
              // Patch auth_user so Sidebar reads tenant_role + name correctly
              const authUserStr = localStorage.getItem("auth_user");
              if (authUserStr) {
                try {
                  const authUser = JSON.parse(authUserStr);
                  authUser.tenant_role = tenantRole;
                  authUser.first_name = admin.first_name || authUser.first_name;
                  authUser.last_name = admin.last_name || authUser.last_name;
                  // Only set branch scoping if this admin belongs to a specific branch
                  if (admin.branch_id) {
                    authUser.branch_id = admin.branch_id;
                    localStorage.setItem("branch_id", admin.branch_id);
                    // Fetch and cache feature flags for THIS admin's branch specifically
                    try {
                      const branches = await branchService.getAllBranches();
                      const branch = branches.find(
                        (b: any) => String(b.id) === String(admin.branch_id)
                      );
                      if (branch?.feature_flags) {
                        const enabledFlags = branch.feature_flags
                          .filter((f: any) => f.is_enabled)
                          .map((f: any) => f.name);
                        localStorage.setItem("branch_feature_flags", JSON.stringify(enabledFlags));
                      }
                    } catch {}
                  } else {
                    // Tenant-level admin — no branch scoping, use tenant feature flags
                    delete authUser.branch_id;
                    localStorage.removeItem("branch_feature_flags");
                  }
                  localStorage.setItem("auth_user", JSON.stringify(authUser));
                } catch {}
              }
            }
          } catch (adminErr) {
            console.error("Failed to fetch admin data for role:", adminErr);
            // Fallback: try auth_user fields
            const authUserStr = localStorage.getItem("auth_user");
            if (authUserStr) {
              try {
                const authUser = JSON.parse(authUserStr);
                tenantRole =
                  authUser.tenant_role ||
                  authUser.access_level ||
                  authUser.role ||
                  "support_agent";
              } catch {}
            }
          }
        } else {
          // No keycloak_id yet — try auth_user
          const authUserStr = localStorage.getItem("auth_user");
          if (authUserStr) {
            try {
              const authUser = JSON.parse(authUserStr);
              tenantRole =
                authUser.tenant_role ||
                authUser.access_level ||
                authUser.role ||
                "support_agent";
            } catch {}
          }
        }

        localStorage.setItem("tenant_role", tenantRole);
      } catch (err) {
        console.error("Failed to store tenant role:", err);
        localStorage.setItem("tenant_role", "support_agent");
      }

      // After determining access level, fetch temporal access grants
      try {
        const tenantConfig = tenantService.getTenantConfig();
        const tenantIdFromConfig = tenantConfig?.tenant_id;
        const tenantId =
          tenantIdFromConfig ||
          import.meta.env.VITE_TENANT_ID ||
          localStorage.getItem("tenant_id") ||
          undefined;

        const keycloakId = localStorage.getItem("keycloak_id");

        if (tenantId && keycloakId) {
          const grants = await temporalAccessService.listUserGrants(
            tenantId,
            keycloakId,
          );
          localStorage.setItem(
            "temporal_access_grants",
            JSON.stringify(grants),
          );
        } else {
          console.warn(
            "Missing tenantId or keycloakId; skipping temporal access fetch",
          );
          localStorage.removeItem("temporal_access_grants");
        }
      } catch (temporalError) {
        console.error(
          "Failed to fetch temporal access grants after login:",
          temporalError,
        );
        localStorage.removeItem("temporal_access_grants");
      }

      // COMMENTED OUT: Onboarding check and redirect
      // Check if onboarding is complete
      // const isOnboardingComplete = onboardingService.isOnboardingComplete();

      // Redirect to onboarding if not complete, otherwise to dashboard
      // if (!isOnboardingComplete) {
      //   setLocation('/admin/onboarding');
      // } else {
      //   setLocation('/');
      // }

      // Redirect to dashboard
      setLocation("/");
    } catch (err: any) {
      console.error("Full error object:", err);
      console.error("Error response:", err?.response);
      console.error("Error response data:", err?.response?.data);

      let errorMessage = "Login failed. Please check your credentials.";

      // Try multiple paths to extract the error message
      if (err?.response?.data?.detail?.message) {
        errorMessage = err.response.data.detail.message;
      } else if (err?.response?.data?.detail) {
        if (typeof err.response.data.detail === "string") {
          errorMessage = err.response.data.detail;
        } else if (typeof err.response.data.detail === "object") {
          errorMessage = err.response.data.detail.message || JSON.stringify(err.response.data.detail);
        }
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.response?.data) {
        errorMessage = typeof err.response.data === "string" ? err.response.data : err.response.data.message || "Invalid credentials";
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      console.error("Final error message:", errorMessage);
      setError(errorMessage);
    }
  };

  const displayError = error || authError;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${primaryColor}08 0%, ${secondaryColor}08 25%, ${primaryColor}05 50%, ${secondaryColor}12 100%)`,
      }}
    >
      {/* Decorative gradient blur background */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 20% 50%, ${primaryColor}15 0%, transparent 50%), radial-gradient(circle at 80% 80%, ${secondaryColor}15 0%, transparent 50%)`,
        }}
      />

      {/* Main Card */}
      <Card className="w-full max-w-md relative z-10 shadow-2xl backdrop-blur-sm border-0" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
        {/* Top border accent */}
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{
            background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
          }}
        />

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <img
              src={  logo}
              alt={`${name} logo`}
              className="w-16 h-16 mx-auto mb-4 rounded-lg shadow-md"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = logo; }}
            />
            <h1
              className="text-4xl font-bold mb-2"
              style={{ color: primaryColor }}
            >
              {name}
            </h1>
            <p className="text-sm tracking-wide font-medium" style={{ color: `${primaryColor}80` }}>
              TENANT MANAGEMENT PORTAL
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-transparent transition-all duration-200 focus:outline-none focus:ring-2"
                placeholder="admin@company.com"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg focus:border-transparent transition-all duration-200 focus:outline-none focus:ring-2"
                  placeholder="••••••••"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {displayError && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                {displayError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full py-3 text-white font-semibold tracking-wide hover:shadow-lg transition-all duration-200 mt-6"
              style={{
                backgroundColor: primaryColor,
              }}
              disabled={isLoading || isLoadingTenant}
            >
              <LogIn className="h-4 w-4 mr-2" />
              {isLoadingTenant
                ? "Loading..."
                : isLoading
                  ? "Signing In..."
                  : "Sign In Securely"}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-8 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-500 font-medium uppercase">SECURE & ENCRYPTED</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Security Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: primaryColor }}
              />
              <span>256-bit SSL Encryption</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: primaryColor }}
              />
              <span>Multi-factor Authentication</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: primaryColor }}
              />
              <span>Industry-Standard Compliance</span>
            </div>
          </div>

          {/* Compliance Divider */}
          <div className="my-7 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-500 font-medium uppercase">Certified & Compliant</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Compliance Certificates */}
          <div className="flex flex-col items-center">
            <p className="text-xs text-gray-600 font-semibold mb-4 tracking-wide">
              TRUSTED BY INDUSTRY LEADERS
            </p>
            <div className="flex gap-4 justify-center items-center flex-wrap">
              <img src={aicpa} alt="AICPA" className="h-24 w-auto opacity-75 hover:opacity-100 transition-opacity duration-300" />
              <img src={iso} alt="ISO" className="h-24 w-auto opacity-75 hover:opacity-100 transition-opacity duration-300" />
              <img src={nist} alt="NIST" className="h-24 w-auto opacity-75 hover:opacity-100 transition-opacity duration-300" />
              <img src={pci} alt="PCI" className="h-24 w-auto opacity-75 hover:opacity-100 transition-opacity duration-300" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
