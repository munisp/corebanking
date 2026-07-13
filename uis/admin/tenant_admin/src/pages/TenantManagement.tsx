import { AddressDropdowns } from "@/components/AddressDropdowns";
import { exportToExcel } from "@/lib/exportUtils";
import {
    Activity,
    Building2,
    Calendar,
    CreditCard,
    Download,
    FileText,
    Plus,
    Search,
    Settings,
    TrendingUp,
    X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTenantBranding } from "../contexts/TenantBrandingContext";
import apiClient from "../services/api";
import { tenantService } from "../services/tenant";

interface BillingCycle {
  id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  amount: string;
  status: string;
}

interface BillingPlanData {
  id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  plan: string;
  billing_cycles: BillingCycle[];
}

interface BillingResponse {
  message: string;
  billing: BillingPlanData;
}

interface MeteringEvent {
  id?: string;
  event_type?: string;
  event_name?: string;
  tenant_id?: string;
  resource_type?: string;
  resource_id?: string;
  quantity?: number;
  unit?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  timestamp?: string;
  [key: string]: any;
}

interface MeteringEventsResponse {
  message?: string;
  events?: MeteringEvent[];
  data?: MeteringEvent[];
  [key: string]: any;
}

interface GlobalFeature {
  id: string;
  name: string;
  description?: string;
  category?: string;
  [key: string]: any;
}

interface GlobalFeaturesResponse {
  features?: GlobalFeature[];
  data?: GlobalFeature[];
  [key: string]: any;
}

interface CreateTenantRequest {
  name: string;
  ledgerId: string;
  contact: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    uin: string;
    password: string;
    address: string;
    country: string;
    city: string;
    state: string;
    postalCode: string;
  };
  branding: {
    domain: string;
    logoUrl: string;
    faviconUrl: string;
    primaryColor: string;
    secondaryColor: string;
  };
  featureFlags: string[];
  plan: string;
}

export default function TenantManagement() {
  const { tenant, primaryColor } = useTenantBranding();
  const [activeTab, setActiveTab] = useState<
    "overview" | "billing" | "metering" | "create"
  >("overview");
  const [searchTerm, setSearchTerm] = useState("");

  // Billing state
  const [billingData, setBillingData] = useState<BillingPlanData | null>(null);
  const [billingPlanLoading, setBillingPlanLoading] = useState(true);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [newPlan, setNewPlan] = useState("");
  const [changingPlan, setChangingPlan] = useState(false);

  // Metering state
  const [meteringEvents, setMeteringEvents] = useState<MeteringEvent[]>([]);
  const [meteringLoading, setMeteringLoading] = useState(true);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    event_type: "",
    event_name: "",
    resource_type: "",
    resource_id: "",
    quantity: 1,
    unit: "",
    metadata: {} as Record<string, any>,
  });

  // Tenant creation state
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false);
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [newTenant, setNewTenant] = useState<CreateTenantRequest>({
    name: "",
    ledgerId: "",
    contact: {
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      uin: "",
      password: "",
      address: "",
      country: "",
      city: "",
      state: "",
      postalCode: "",
    },
    branding: {
      domain: "",
      logoUrl: "",
      faviconUrl: "",
      primaryColor: "#3b82f6",
      secondaryColor: "#8b5cf6",
    },
    featureFlags: [],
    plan: "premium",
  });

  // Global features state
  const [globalFeatures, setGlobalFeatures] = useState<string[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featuresFetched, setFeaturesFetched] = useState(false);

  // Fetch billing plan
  const fetchBillingPlan = async () => {
    try {
      const response = await apiClient.get<BillingResponse>(
        `/tenant-management/billing`,
      );
      if (response.data.billing) {
        setBillingData(response.data.billing);
      }
    } catch (error: any) {
      console.error("Error fetching billing plan:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to fetch billing plan";
      toast.error(errorMessage);
    } finally {
      setBillingPlanLoading(false);
    }
  };

  // Fetch metering events
  const fetchMeteringEvents = async (setLoading = true) => {
    if (setLoading) {
      setMeteringLoading(true);
    }
    try {
      const response = await apiClient.put<MeteringEventsResponse>(
        `/tenant-management/system/metering/event`,
      );
      const data = response.data;

      // Handle different response structures
      let events: MeteringEvent[] = [];
      if (Array.isArray(data)) {
        events = data;
      } else if (data.events && Array.isArray(data.events)) {
        events = data.events;
      } else if (data.data && Array.isArray(data.data)) {
        events = data.data;
      }

      setMeteringEvents(events);
    } catch (error: any) {
      console.error("Error fetching metering events:", error);
      if (setLoading) {
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          "Failed to fetch metering events";
        toast.error(errorMessage);
        setMeteringEvents([]);
      }
    } finally {
      if (setLoading) {
        setMeteringLoading(false);
      }
    }
  };

  // Fetch global features
  const fetchGlobalFeatures = async () => {
    setFeaturesLoading(true);
    try {
      const response = await apiClient.get<GlobalFeaturesResponse>(
        `/tenant-management/tenant/features/global`,
      );
      const data = response.data;

      // Handle different response structures
      let features: GlobalFeature[] = [];
      if (Array.isArray(data)) {
        features = data;
      } else if (data.features && Array.isArray(data.features)) {
        features = data.features;
      } else if (data.data && Array.isArray(data.data)) {
        features = data.data;
      }

      // Extract feature IDs/names - assuming features have 'id' or 'name' field
      const featureIds = features
        .map((f) => f.id || f.name || f)
        .filter(Boolean) as string[];
      setGlobalFeatures(featureIds);
      setFeaturesFetched(true);
    } catch (error: any) {
      console.error("Error fetching global features:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to fetch global features";
      toast.error(errorMessage);
      // Fallback to hardcoded features if API fails
      setGlobalFeatures([
        "auth",
        "user_management",
        "accounts",
        "payments",
        "reporting",
        "notifications",
        "loans",
        "insurance",
        "lpo",
        "carbon_credits",
      ]);
      setFeaturesFetched(true);
    } finally {
      setFeaturesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "billing") {
      fetchBillingPlan();
    } else if (activeTab === "metering") {
      fetchMeteringEvents(true);
      // Auto-refresh every 10 seconds (silently in background)
      const interval = setInterval(() => fetchMeteringEvents(false), 10000);
      return () => clearInterval(interval);
    } else if (activeTab === "create" && !featuresFetched) {
      // Fetch global features when create tab is active (only once)
      fetchGlobalFeatures();
    }
  }, [activeTab, featuresFetched]);

  // Also fetch features when modal opens (if not already fetched)
  useEffect(() => {
    if (showCreateTenantModal && !featuresFetched) {
      fetchGlobalFeatures();
    }
  }, [showCreateTenantModal, featuresFetched]);

  // Change billing plan
  const handleChangePlan = async () => {
    if (!newPlan.trim()) {
      toast.error("Please select a plan");
      return;
    }

    setChangingPlan(true);
    try {
      await apiClient.put(`/tenant-management/billing`, { plan: newPlan });
      toast.success(`Billing plan changed to ${newPlan}`);
      setShowChangePlanModal(false);
      setNewPlan("");
      await fetchBillingPlan();
    } catch (error: any) {
      console.error("Error changing billing plan:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to change billing plan";
      toast.error(errorMessage);
    } finally {
      setChangingPlan(false);
    }
  };

  // Create metering event
  const handleCreateEvent = async () => {
    if (!newEvent.event_type || !newEvent.event_name) {
      toast.error("Please fill in required fields");
      return;
    }

    setCreatingEvent(true);
    try {
      await apiClient.put(`/tenant-management/system/metering/event`, {
        event_type: newEvent.event_type,
        event_name: newEvent.event_name,
        resource_type: newEvent.resource_type || undefined,
        resource_id: newEvent.resource_id || undefined,
        quantity: newEvent.quantity || 1,
        unit: newEvent.unit || undefined,
        metadata:
          Object.keys(newEvent.metadata).length > 0
            ? newEvent.metadata
            : undefined,
      });
      toast.success("Metering event created successfully");
      setShowCreateEventModal(false);
      setNewEvent({
        event_type: "",
        event_name: "",
        resource_type: "",
        resource_id: "",
        quantity: 1,
        unit: "",
        metadata: {},
      });
      await fetchMeteringEvents();
    } catch (error: any) {
      console.error("Error creating metering event:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to create metering event";
      toast.error(errorMessage);
    } finally {
      setCreatingEvent(false);
    }
  };

  // Filter metering events
  const filteredMeteringEvents = useMemo(() => {
    return meteringEvents.filter((event) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        !searchTerm ||
        event.event_type?.toLowerCase().includes(searchLower) ||
        event.event_name?.toLowerCase().includes(searchLower) ||
        event.resource_type?.toLowerCase().includes(searchLower) ||
        event.resource_id?.toLowerCase().includes(searchLower) ||
        event.tenant_id?.toLowerCase().includes(searchLower)
      );
    });
  }, [meteringEvents, searchTerm]);

  // Get tenant config
  const tenantConfig = tenantService.getTenantConfig();

  // Create tenant
  const handleCreateTenant = async () => {
    if (
      !newTenant.name ||
      !newTenant.ledgerId ||
      !newTenant.contact.email ||
      !newTenant.contact.password
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate plan
    const validPlans = ["standard", "premium", "enterprise"];
    if (!validPlans.includes(newTenant.plan)) {
      toast.error(`Invalid plan. Must be one of: ${validPlans.join(", ")}`);
      return;
    }

    // Filter feature flags to only include valid ones from global features
    const validFeatureFlags =
      globalFeatures.length > 0
        ? globalFeatures
        : [
            "auth",
            "user_management",
            "accounts",
            "payments",
            "reporting",
            "notifications",
            "loans",
            "insurance",
            "lpo",
            "carbon_credits",
          ];
    const filteredFeatureFlags = newTenant.featureFlags.filter((flag) =>
      validFeatureFlags.includes(flag),
    );

    setCreatingTenant(true);
    try {
      const tenantData = {
        ...newTenant,
        featureFlags: filteredFeatureFlags,
      };
      await apiClient.post(`/orchestrator/tenant`, tenantData);
      toast.success(`Tenant "${newTenant.name}" created successfully`);
      setShowCreateTenantModal(false);
      setNewTenant({
        name: "",
        ledgerId: "",
        contact: {
          email: "",
          firstName: "",
          lastName: "",
          phone: "",
          uin: "",
          password: "",
          address: "",
          country: "",
          city: "",
          state: "",
          postalCode: "",
        },
        branding: {
          domain: "",
          logoUrl: "",
          faviconUrl: "",
          primaryColor: "#3b82f6",
          secondaryColor: "#8b5cf6",
        },
        featureFlags: [],
        plan: "premium",
      });
      // Optionally switch to overview tab to see the new tenant
      setActiveTab("overview");
    } catch (error: any) {
      console.error("Error creating tenant:", error);

      // Parse validation errors from the response
      let errorMessage = "Failed to create tenant";
      if (error?.response?.data?.message) {
        try {
          const validationErrors = JSON.parse(error.response.data.message);
          if (Array.isArray(validationErrors) && validationErrors.length > 0) {
            const errorDetails = validationErrors
              .map((err: any) => {
                if (err.path && err.message) {
                  return `${err.path.join(".")}: ${err.message}`;
                }
                return err.message || JSON.stringify(err);
              })
              .join("\n");
            errorMessage = `Validation errors:\n${errorDetails}`;
          } else {
            errorMessage = error.response.data.message;
          }
        } catch {
          errorMessage =
            error.response.data.message ||
            error?.message ||
            "Failed to create tenant";
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage, {
        duration: 10000, // Show for 10 seconds to read validation errors
      });
    } finally {
      setCreatingTenant(false);
    }
  };

  const toggleFeatureFlag = (feature: string) => {
    setNewTenant((prev) => ({
      ...prev,
      featureFlags: prev.featureFlags.includes(feature)
        ? prev.featureFlags.filter((f) => f !== feature)
        : [...prev.featureFlags, feature],
    }));
  };

  const handleExportExcel = () => {
    if (activeTab === "metering") {
      const data = filteredMeteringEvents.map((event) => ({
        "Event Type": event.event_type || "N/A",
        "Event Name": event.event_name || "N/A",
        "Resource Type": event.resource_type || "N/A",
        "Resource ID": event.resource_id || "N/A",
        Quantity: event.quantity || 0,
        Unit: event.unit || "N/A",
        "Tenant ID": event.tenant_id || "N/A",
        Created:
          event.created_at || event.timestamp
            ? new Date(
                event.created_at || event.timestamp || "",
              ).toLocaleString()
            : "N/A",
      }));
      exportToExcel(data, "metering-events");
    }
  };

  // Use global features from API, fallback to hardcoded if not loaded
  const availableFeatures =
    globalFeatures.length > 0
      ? globalFeatures
      : [
          "auth",
          "user_management",
          "accounts",
          "payments",
          "reporting",
          "notifications",
          "loans",
          "insurance",
          "lpo",
          "carbon_credits",
        ];

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-background ">
      {/* Header */}
      <div className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Settings className="w-8 h-8" style={{ color: primaryColor }} />
                Tenant Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your tenant configuration, billing, and metering
              </p>
            </div>
            <button
              onClick={() => {
                setActiveTab("create");
                setShowCreateTenantModal(true);
              }}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 flex items-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus className="w-5 h-5" />
              Create Tenant
            </button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Tabs */}
        <div className="bg-card rounded-xl shadow-lg border border-border mb-8">
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-6 py-4 font-semibold transition-colors ${
                activeTab === "overview"
                  ? "border-b-2 text-foreground"
                  : "text-muted-foreground hover:text-slate-900 dark:hover:text-white"
              }`}
              style={
                activeTab === "overview"
                  ? { borderBottomColor: primaryColor }
                  : {}
              }
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("billing")}
              className={`px-6 py-4 font-semibold transition-colors ${
                activeTab === "billing"
                  ? "border-b-2 text-foreground"
                  : "text-muted-foreground hover:text-slate-900 dark:hover:text-white"
              }`}
              style={
                activeTab === "billing"
                  ? { borderBottomColor: primaryColor }
                  : {}
              }
            >
              Billing
            </button>
            <button
              onClick={() => setActiveTab("metering")}
              className={`px-6 py-4 font-semibold transition-colors ${
                activeTab === "metering"
                  ? "border-b-2 text-foreground"
                  : "text-muted-foreground hover:text-slate-900 dark:hover:text-white"
              }`}
              style={
                activeTab === "metering"
                  ? { borderBottomColor: primaryColor }
                  : {}
              }
            >
              Metering Events
            </button>
            <button
              onClick={() => {
                setActiveTab("create");
                setShowCreateTenantModal(true);
              }}
              className={`px-6 py-4 font-semibold transition-colors ${
                activeTab === "create"
                  ? "border-b-2 text-foreground"
                  : "text-muted-foreground hover:text-slate-900 dark:hover:text-white"
              }`}
              style={
                activeTab === "create"
                  ? { borderBottomColor: primaryColor }
                  : {}
              }
            >
              Create Tenant
            </button>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tenant Information */}
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 border border-border">
                    <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Building2
                        className="w-5 h-5"
                        style={{ color: primaryColor }}
                      />
                      Tenant Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Tenant ID
                        </label>
                        <p className="text-sm font-medium text-foreground font-mono">
                          {tenantConfig?.tenant_id ||
                            (tenantConfig as any)?.id ||
                            "N/A"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Tenant Name
                        </label>
                        <p className="text-sm font-medium text-foreground">
                          {tenantConfig?.name || tenant?.name || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Status
                        </label>
                        <p className="text-sm font-medium text-foreground capitalize">
                          {tenantConfig?.status || "N/A"}
                        </p>
                      </div>
                      {tenantConfig?.contact && (
                        <div>
                          <label className="text-xs text-muted-foreground">
                            Contact Email
                          </label>
                          <p className="text-sm font-medium text-foreground">
                            {tenantConfig.contact.email || "N/A"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 border border-border">
                    <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                      <TrendingUp
                        className="w-5 h-5"
                        style={{ color: primaryColor }}
                      />
                      Quick Stats
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Feature Flags
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {Array.isArray(tenantConfig?.feature_flags)
                            ? tenantConfig.feature_flags.length
                            : 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Created
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {tenantConfig?.created_at
                            ? new Date(
                                tenantConfig.created_at,
                              ).toLocaleDateString()
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Billing Tab */}
            {activeTab === "billing" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Current Plan */}
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 border border-border">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${primaryColor}15` }}
                        >
                          <CreditCard
                            className="w-6 h-6"
                            style={{ color: primaryColor }}
                          />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            Current Plan
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Your active subscription plan
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowChangePlanModal(true)}
                        className="px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Change Plan
                      </button>
                    </div>
                    {billingPlanLoading ? (
                      <div className="animate-pulse">
                        <div className="h-8 w-32 bg-muted rounded mb-2"></div>
                        <div className="h-4 w-24 bg-muted rounded"></div>
                      </div>
                    ) : billingData ? (
                      <div>
                        <div
                          className="text-3xl font-bold capitalize mb-2"
                          style={{ color: primaryColor }}
                        >
                          {billingData.plan}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Plan ID: {billingData.id}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Created:{" "}
                          {new Date(
                            billingData.created_at,
                          ).toLocaleDateString()}
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        No billing plan found
                      </div>
                    )}
                  </div>

                  {/* Active Billing Cycles */}
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 border border-border">
                    <div className="flex items-center gap-4 mb-4">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${primaryColor}15` }}
                      >
                        <Calendar
                          className="w-6 h-6"
                          style={{ color: primaryColor }}
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          Billing Cycles
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Active billing cycles
                        </p>
                      </div>
                    </div>
                    {billingPlanLoading ? (
                      <div className="animate-pulse">
                        <div className="h-4 w-full bg-muted rounded mb-2"></div>
                        <div className="h-4 w-3/4 bg-muted rounded"></div>
                      </div>
                    ) : billingData?.billing_cycles &&
                      billingData.billing_cycles.length > 0 ? (
                      <div className="space-y-3">
                        {billingData.billing_cycles.map((cycle) => (
                          <div
                            key={cycle.id}
                            className="p-4 rounded-lg border border-border"
                            style={{
                              backgroundColor:
                                cycle.status === "RUNNING"
                                  ? `${primaryColor}05`
                                  : "transparent",
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                    cycle.status === "RUNNING"
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                      : "bg-muted text-foreground"
                                  }`}
                                >
                                  {cycle.status}
                                </span>
                              </div>
                              <div className="text-lg font-bold text-foreground">
                                ₦{parseFloat(cycle.amount).toLocaleString()}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Cycle ID: {cycle.id} • Created:{" "}
                              {new Date(cycle.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-sm">
                        No active billing cycles
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Metering Events Tab */}
            {activeTab === "metering" && (
              <div className="space-y-6">
                {/* Search and Actions */}
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search metering events..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                      style={
                        {
                          "--tw-ring-color": primaryColor,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCreateEventModal(true)}
                      className="px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 flex items-center gap-2"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Plus className="w-4 h-4" />
                      Create Event
                    </button>
                    <button
                      onClick={handleExportExcel}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-muted flex items-center gap-2"
                      disabled={meteringLoading}
                    >
                      <Download className="w-5 h-5" />
                      Excel
                    </button>
                  </div>
                </div>

                {/* Metering Events Table */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg border border-border overflow-hidden">
                  {meteringLoading ? (
                    <div className="p-12 text-center">
                      <Activity className="w-12 h-12 text-muted-foreground animate-spin mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Loading metering events...
                      </p>
                    </div>
                  ) : filteredMeteringEvents.length === 0 ? (
                    <div className="p-12 text-center">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        No metering events found
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-100 dark:bg-slate-800 border-b border-border">
                          <tr>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                              Event Type
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                              Event Name
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                              Resource Type
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                              Resource ID
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                              Quantity
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                              Unit
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                              Created
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {filteredMeteringEvents.map((event, index) => (
                            <tr
                              key={event.id || index}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                              <td className="px-6 py-4 font-semibold text-foreground">
                                {event.event_type || "N/A"}
                              </td>
                              <td className="px-6 py-4 text-muted-foreground">
                                {event.event_name || "N/A"}
                              </td>
                              <td className="px-6 py-4 text-muted-foreground">
                                {event.resource_type || "N/A"}
                              </td>
                              <td className="px-6 py-4 font-mono text-sm text-muted-foreground">
                                {event.resource_id || "N/A"}
                              </td>
                              <td className="px-6 py-4 font-semibold text-foreground">
                                {event.quantity || 0}
                              </td>
                              <td className="px-6 py-4 text-muted-foreground">
                                {event.unit || "N/A"}
                              </td>
                              <td className="px-6 py-4 text-muted-foreground">
                                {event.created_at || event.timestamp
                                  ? new Date(
                                      event.created_at || event.timestamp || "",
                                    ).toLocaleString()
                                  : "N/A"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Create Tenant Tab */}
            {activeTab === "create" && (
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Plus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                      Create New Tenant
                    </h3>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Fill out the form below to create a new tenant. All required
                    fields must be completed.
                  </p>
                  <button
                    onClick={() => setShowCreateTenantModal(true)}
                    className="mt-4 px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Open Creation Form
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Change Plan Modal */}
      {showChangePlanModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-lg border border-border w-full max-w-md">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Change Billing Plan
              </h3>
              <button
                onClick={() => {
                  setShowChangePlanModal(false);
                  setNewPlan("");
                }}
                className="text-muted-foreground hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Select Plan
                </label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                  style={
                    { "--tw-ring-color": primaryColor } as React.CSSProperties
                  }
                >
                  <option value="">Select a plan...</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleChangePlan}
                  disabled={changingPlan || !newPlan}
                  className="flex-1 px-4 py-2 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: primaryColor }}
                >
                  {changingPlan ? (
                    <>
                      <Activity className="w-4 h-4 animate-spin inline mr-2" />
                      Changing...
                    </>
                  ) : (
                    "Change Plan"
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowChangePlanModal(false);
                    setNewPlan("");
                  }}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateEventModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-lg border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Create Metering Event
              </h3>
              <button
                onClick={() => {
                  setShowCreateEventModal(false);
                  setNewEvent({
                    event_type: "",
                    event_name: "",
                    resource_type: "",
                    resource_id: "",
                    quantity: 1,
                    unit: "",
                    metadata: {},
                  });
                }}
                className="text-muted-foreground hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Event Type *
                  </label>
                  <input
                    type="text"
                    value={newEvent.event_type}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, event_type: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                    placeholder="e.g., usage, transaction"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Event Name *
                  </label>
                  <input
                    type="text"
                    value={newEvent.event_name}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, event_name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                    placeholder="e.g., api_call, transaction_processed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Resource Type
                  </label>
                  <input
                    type="text"
                    value={newEvent.resource_type}
                    onChange={(e) =>
                      setNewEvent({
                        ...newEvent,
                        resource_type: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                    placeholder="e.g., api, storage"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Resource ID
                  </label>
                  <input
                    type="text"
                    value={newEvent.resource_id}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, resource_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                    placeholder="Resource identifier"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={newEvent.quantity}
                    onChange={(e) =>
                      setNewEvent({
                        ...newEvent,
                        quantity: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={newEvent.unit}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, unit: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                    placeholder="e.g., requests, bytes"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateEvent}
                  disabled={
                    creatingEvent ||
                    !newEvent.event_type ||
                    !newEvent.event_name
                  }
                  className="flex-1 px-4 py-2 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: primaryColor }}
                >
                  {creatingEvent ? (
                    <>
                      <Activity className="w-4 h-4 animate-spin inline mr-2" />
                      Creating...
                    </>
                  ) : (
                    "Create Event"
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowCreateEventModal(false);
                    setNewEvent({
                      event_type: "",
                      event_name: "",
                      resource_type: "",
                      resource_id: "",
                      quantity: 1,
                      unit: "",
                      metadata: {},
                    });
                  }}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Tenant Modal */}
      {showCreateTenantModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-lg border border-border w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h3 className="text-lg font-semibold text-foreground">
                Create New Tenant
              </h3>
              <button
                onClick={() => {
                  setShowCreateTenantModal(false);
                  if (activeTab === "create") {
                    setActiveTab("overview");
                  }
                }}
                className="text-muted-foreground hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div>
                <h4 className="text-md font-semibold text-foreground mb-4">
                  Basic Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Tenant Name *
                    </label>
                    <input
                      type="text"
                      value={newTenant.name}
                      onChange={(e) =>
                        setNewTenant({ ...newTenant, name: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                      placeholder="e.g., bpmgd"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Ledger ID *
                    </label>
                    <input
                      type="text"
                      value={newTenant.ledgerId}
                      onChange={(e) =>
                        setNewTenant({ ...newTenant, ledgerId: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                      placeholder="e.g., 1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Billing Plan *
                    </label>
                    <select
                      value={newTenant.plan}
                      onChange={(e) =>
                        setNewTenant({ ...newTenant, plan: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                    >
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h4 className="text-md font-semibold text-foreground mb-4">
                  Contact Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={newTenant.contact.email}
                      onChange={(e) =>
                        setNewTenant({
                          ...newTenant,
                          contact: {
                            ...newTenant.contact,
                            email: e.target.value,
                          },
                        })
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                      placeholder="email@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={newTenant.contact.password}
                      onChange={(e) =>
                        setNewTenant({
                          ...newTenant,
                          contact: {
                            ...newTenant.contact,
                            password: e.target.value,
                          },
                        })
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                      placeholder="Password"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={newTenant.contact.firstName}
                      onChange={(e) =>
                        setNewTenant({
                          ...newTenant,
                          contact: {
                            ...newTenant.contact,
                            firstName: e.target.value,
                          },
                        })
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                      placeholder="First Name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={newTenant.contact.lastName}
                      onChange={(e) =>
                        setNewTenant({
                          ...newTenant,
                          contact: {
                            ...newTenant.contact,
                            lastName: e.target.value,
                          },
                        })
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                      placeholder="Last Name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      value={newTenant.contact.phone}
                      onChange={(e) =>
                        setNewTenant({
                          ...newTenant,
                          contact: {
                            ...newTenant.contact,
                            phone: e.target.value,
                          },
                        })
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                      placeholder="+2349039517507"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      UIN *
                    </label>
                    <input
                      type="text"
                      value={newTenant.contact.uin}
                      onChange={(e) =>
                        setNewTenant({
                          ...newTenant,
                          contact: {
                            ...newTenant.contact,
                            uin: e.target.value,
                          },
                        })
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                      placeholder="1234567890"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Address *
                    </label>
                    <input
                      type="text"
                      value={newTenant.contact.address}
                      onChange={(e) =>
                        setNewTenant({
                          ...newTenant,
                          contact: {
                            ...newTenant.contact,
                            address: e.target.value,
                          },
                        })
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                      placeholder="Street Address"
                      required
                    />
                  </div>
                </div>

                {/* Location Dropdowns */}
                <AddressDropdowns
                  country={newTenant.contact.country}
                  state={newTenant.contact.state}
                  city={newTenant.contact.city}
                  onCountryChange={(value) =>
                    setNewTenant({
                      ...newTenant,
                      contact: { ...newTenant.contact, country: value },
                    })
                  }
                  onStateChange={(value) =>
                    setNewTenant({
                      ...newTenant,
                      contact: { ...newTenant.contact, state: value },
                    })
                  }
                  onCityChange={(value) =>
                    setNewTenant({
                      ...newTenant,
                      contact: { ...newTenant.contact, city: value },
                    })
                  }
                  required
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Postal Code *
                    </label>
                    <input
                      type="text"
                      value={newTenant.contact.postalCode}
                      onChange={(e) =>
                        setNewTenant({
                          ...newTenant,
                          contact: {
                            ...newTenant.contact,
                            postalCode: e.target.value,
                          },
                        })
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                      placeholder="Postal Code"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Branding */}
              <div>
                <h4 className="text-md font-semibold text-foreground mb-4">
                  Branding
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Domain *
                    </label>
                    <input
                      type="text"
                      value={newTenant.branding.domain}
                      onChange={(e) =>
                        setNewTenant({
                          ...newTenant,
                          branding: {
                            ...newTenant.branding,
                            domain: e.target.value,
                          },
                        })
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                      placeholder="test.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Logo URL *
                    </label>
                    <input
                      type="url"
                      value={newTenant.branding.logoUrl}
                      onChange={(e) =>
                        setNewTenant({
                          ...newTenant,
                          branding: {
                            ...newTenant.branding,
                            logoUrl: e.target.value,
                          },
                        })
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                      placeholder="test.com/logo"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Favicon URL *
                    </label>
                    <input
                      type="url"
                      value={newTenant.branding.faviconUrl}
                      onChange={(e) =>
                        setNewTenant({
                          ...newTenant,
                          branding: {
                            ...newTenant.branding,
                            faviconUrl: e.target.value,
                          },
                        })
                      }
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                      placeholder="test.com/favicon"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Primary Color *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={newTenant.branding.primaryColor}
                        onChange={(e) =>
                          setNewTenant({
                            ...newTenant,
                            branding: {
                              ...newTenant.branding,
                              primaryColor: e.target.value,
                            },
                          })
                        }
                        className="w-16 h-10 border border-border rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={newTenant.branding.primaryColor}
                        onChange={(e) =>
                          setNewTenant({
                            ...newTenant,
                            branding: {
                              ...newTenant.branding,
                              primaryColor: e.target.value,
                            },
                          })
                        }
                        className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                        placeholder="#3b82f6"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Secondary Color *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={newTenant.branding.secondaryColor}
                        onChange={(e) =>
                          setNewTenant({
                            ...newTenant,
                            branding: {
                              ...newTenant.branding,
                              secondaryColor: e.target.value,
                            },
                          })
                        }
                        className="w-16 h-10 border border-border rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={newTenant.branding.secondaryColor}
                        onChange={(e) =>
                          setNewTenant({
                            ...newTenant,
                            branding: {
                              ...newTenant.branding,
                              secondaryColor: e.target.value,
                            },
                          })
                        }
                        className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2"
                        placeholder="#8b5cf6"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature Flags */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-semibold text-foreground">
                    Feature Flags
                  </h4>
                  {featuresLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="w-4 h-4 animate-spin" />
                      Loading features...
                    </div>
                  )}
                </div>
                {featuresLoading && availableFeatures.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-8 h-8 animate-spin mx-auto mb-2" />
                    <p>Loading available features...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {availableFeatures.map((feature) => (
                      <label
                        key={feature}
                        className="flex items-center gap-2 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          checked={newTenant.featureFlags.includes(feature)}
                          onChange={() => toggleFeatureFlag(feature)}
                          className="w-4 h-4 rounded border-border"
                          style={{ accentColor: primaryColor }}
                        />
                        <span className="text-sm font-medium text-foreground capitalize">
                          {feature.replace(/_/g, " ")}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  onClick={handleCreateTenant}
                  disabled={
                    creatingTenant ||
                    !newTenant.name ||
                    !newTenant.ledgerId ||
                    !newTenant.contact.email ||
                    !newTenant.contact.password
                  }
                  className="flex-1 px-4 py-2 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: primaryColor }}
                >
                  {creatingTenant ? (
                    <>
                      <Activity className="w-4 h-4 animate-spin inline mr-2" />
                      Creating Tenant...
                    </>
                  ) : (
                    "Create Tenant"
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowCreateTenantModal(false);
                    if (activeTab === "create") {
                      setActiveTab("overview");
                    }
                  }}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
