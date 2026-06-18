import { AddressDropdowns } from "@/components/AddressDropdowns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import apiClient from "@/services/api";
import { branchService, type BranchFeature } from "@/services/branch";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Flag,
  Key,
  MapPin,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const steps = [
  { id: 1, title: "Branch Information", icon: Building2 },
  { id: 2, title: "Contact Details", icon: User },
  { id: 3, title: "API Setup", icon: Key },
  { id: 4, title: "Feature Selection", icon: Flag },
  { id: 5, title: "Review & Launch", icon: Check },
];

interface GlobalFeaturesResponse {
  features?: string[];
  data?: string[];
  [key: string]: any;
}

// Feature flag display names mapping
const featureDisplayNames: Record<string, string> = {
  auth: "Authentication",
  user_management: "User Management",
  accounts: "Accounts",
  payments: "Payments",
  reporting: "Reporting",
  notifications: "Notifications",
  loans: "Loans",
  insurance: "Insurance",
  lpo: "LPO (Loan Processing Office)",
  carbon_credits: "Carbon Credits",
};

// Feature flag descriptions mapping
const featureDescriptions: Record<string, string> = {
  auth: "Authentication and authorization services",
  user_management: "User account and role management",
  accounts: "Account management and operations",
  payments: "Payment processing capabilities",
  reporting: "Reporting and analytics features",
  notifications: "Notification and messaging services",
  loans: "Loan processing and management",
  insurance: "Insurance products and services",
  lpo: "Loan Processing Office operations",
  carbon_credits: "Carbon credits trading and management",
};

export default function BranchOnboarding() {
  const [, setLocation] = useLocation();
  const { primaryColor, tenant } = useTenantBranding();
  const tenantPrefix = tenant?.tenant_id ? `${tenant.tenant_id}-` : "";
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Support both string and object for available features
  const [availableFeatures, setAvailableFeatures] = useState<any[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [formData, setFormData] = useState({
    // Step 1: Branch Information
    name: "",
    code: "",
    country: "Nigeria",
    state: "",
    city: "",
    location: "",
    // Step 2: Contact Details
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    // Step 3: API Setup
    webhookUrl: "",
    callbackUrl: "",
    // Step 4: Features - Essential features selected by default
    features: ["auth", "user_management", "accounts", "payments"] as string[],
  });

  // Fetch global features on component mount
  useEffect(() => {
    const fetchGlobalFeatures = async () => {
      setFeaturesLoading(true);
      try {
        const response = await apiClient.get<GlobalFeaturesResponse>(
          "/tenant-management/tenant/features",
        );
        const data = response.data;

        // If API returns array of objects (with name, is_enabled, etc)
        let features: any[] = [];
        if (Array.isArray(data?.features)) {
          features = data.features;
        } else if (Array.isArray(data)) {
          features = data;
        } else if (Array.isArray(data?.data)) {
          features = data.data;
        }

        setAvailableFeatures(features);
      } catch (error: any) {
        console.error("Error fetching global features:", error);
        // Fallback to valid enum values if API fails
        const fallbackFeatures = [
          { name: "auth" },
          { name: "user_management" },
          { name: "accounts" },
          { name: "payments" },
          { name: "reporting" },
          { name: "notifications" },
          { name: "loans" },
          { name: "insurance" },
          { name: "lpo" },
          { name: "carbon_credits" },
        ];
        setAvailableFeatures(fallbackFeatures);
        toast.error("Failed to fetch feature flags. Using default features.");
      } finally {
        setFeaturesLoading(false);
      }
    };

    fetchGlobalFeatures();
  }, []);

  const nextStep = () => {
    if (currentStep < steps.length) {
      if (validateStep(currentStep)) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (
          !formData.name ||
          !formData.code ||
          !formData.country ||
          !formData.state ||
          !formData.city ||
          !formData.location
        ) {
          toast.error(
            "Please fill in all branch information fields, including address",
          );
          return false;
        }
        return true;
      case 2:
        if (
          !formData.contactName ||
          !formData.contactEmail ||
          !formData.contactPhone
        ) {
          toast.error("Please fill in all contact details");
          return false;
        }
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.contactEmail)) {
          toast.error("Please enter a valid email address");
          return false;
        }
        return true;
      case 3:
        if (!formData.webhookUrl || !formData.callbackUrl) {
          toast.error("Please provide both webhook and callback URLs");
          return false;
        }
        // Basic URL validation
        try {
          new URL(formData.webhookUrl);
          new URL(formData.callbackUrl);
        } catch {
          toast.error("Please enter valid URLs");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const toggleFeature = (featureFlag: string) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.includes(featureFlag)
        ? prev.features.filter((f) => f !== featureFlag)
        : [...prev.features, featureFlag],
    }));
  };

  const handleSubmit = async () => {
    // Validate all steps
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      toast.error("Please complete all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      // Transform features array to match API format
      const features: BranchFeature[] = formData.features.map((flag) => ({
        flag,
        config: {},
      }));

      const payload = {
        name: formData.name,
        code: tenantPrefix ? `${tenantPrefix}${formData.code}` : formData.code,
        location: `${formData.location}, ${formData.city}, ${formData.state}, ${formData.country}`,
        webhookUrl: formData.webhookUrl,
        callbackUrl: formData.callbackUrl,
        contact: {
          email: formData.contactEmail,
          name: formData.contactName,
          phone: formData.contactPhone,
        },
        features,
      };

      await branchService.createBranch(payload);
      toast.success("Branch created successfully!");

      // Redirect to branches page after successful creation
      setTimeout(() => {
        setLocation("/branches");
      }, 1500);
    } catch (error: any) {
      console.error("Error creating branch:", error);
      toast.error(
        error.message || "Failed to create branch. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="mb-6">
              <h2
                className="text-2xl font-bold mb-2"
                style={{ color: primaryColor }}
              >
                Branch Information
              </h2>
              <p className="text-muted-foreground">
                Enter basic information about the branch
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Branch Name *</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Central Branch"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Branch Code *</Label>
                <div className="flex items-center">
                  {tenantPrefix && (
                    <span className="flex items-center h-9 px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm font-mono select-none">
                      {tenantPrefix}
                    </span>
                  )}
                  <Input
                    id="code"
                    type="text"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    placeholder="e.g., ikoyi, yaba, lekki"
                    className={tenantPrefix ? "rounded-l-none" : ""}
                  />
                </div>
                {tenantPrefix && (
                  <p className="text-xs text-muted-foreground">
                    Full code: <span className="font-mono font-medium">{tenantPrefix}{formData.code || "..."}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Branch Address *</Label>
                <AddressDropdowns
                  country={formData.country || ""}
                  state={formData.state || ""}
                  city={formData.city || ""}
                  onCountryChange={(value) =>
                    setFormData((prev) => ({ ...prev, country: value }))
                  }
                  onStateChange={(value) =>
                    setFormData((prev) => ({ ...prev, state: value }))
                  }
                  onCityChange={(value) =>
                    setFormData((prev) => ({ ...prev, city: value }))
                  }
                  required
                />
                <div className="mt-4">
                  <Label htmlFor="location">Street Address *</Label>
                  <Input
                    id="location"
                    type="text"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        location: e.target.value,
                      }))
                    }
                    placeholder="e.g., 123 Main Street, Building 5"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="mb-6">
              <h2
                className="text-2xl font-bold mb-2"
                style={{ color: primaryColor }}
              >
                Contact Details
              </h2>
              <p className="text-muted-foreground">
                Provide contact information for the branch manager
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="contactName">Contact Name *</Label>
                <Input
                  id="contactName"
                  type="text"
                  value={formData.contactName}
                  onChange={(e) =>
                    setFormData({ ...formData, contactName: e.target.value })
                  }
                  placeholder="e.g., John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, contactEmail: e.target.value })
                  }
                  placeholder="e.g., manager@centralbranch.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone *</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) =>
                    setFormData({ ...formData, contactPhone: e.target.value })
                  }
                  placeholder="e.g., +2348012345678"
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="mb-6">
              <h2
                className="text-2xl font-bold mb-2"
                style={{ color: primaryColor }}
              >
                API Configuration
              </h2>
              <p className="text-muted-foreground">
                Configure API endpoints for webhooks and callbacks
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Webhook URL *</Label>
                <Input
                  id="webhookUrl"
                  type="url"
                  value={formData.webhookUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, webhookUrl: e.target.value })
                  }
                  placeholder="https://example.com/webhook"
                />
                <p className="text-sm text-muted-foreground">
                  We'll send transaction notifications to this URL
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="callbackUrl">Callback URL *</Label>
                <Input
                  id="callbackUrl"
                  type="url"
                  value={formData.callbackUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, callbackUrl: e.target.value })
                  }
                  placeholder="https://example.com/callback"
                />
                <p className="text-sm text-muted-foreground">
                  Redirect URL after authentication
                </p>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="mb-6">
              <h2
                className="text-2xl font-bold mb-2"
                style={{ color: primaryColor }}
              >
                Select Features
              </h2>
              <p className="text-muted-foreground">
                Choose the features you want to enable for this branch.
                Essential features are pre-selected.
              </p>
            </div>

            {featuresLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p className="text-muted-foreground">
                  Loading available features...
                </p>
              </div>
            ) : availableFeatures.length === 0 ? (
              <div className="text-center py-12">
                <Flag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No features available</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableFeatures.map((featureObj) => {
                  // Support both string and object
                  const featureName =
                    typeof featureObj === "string"
                      ? featureObj
                      : featureObj.name;
                  const displayName =
                    featureDisplayNames[featureName] ||
                    featureName
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l: string) => l.toUpperCase());
                  const description =
                    featureDescriptions[featureName] ||
                    `Enable ${displayName} features`;
                  const isSelected = formData.features.includes(featureName);

                  return (
                    <button
                      key={featureName}
                      type="button"
                      onClick={() => toggleFeature(featureName)}
                      className={`p-4 border-2 rounded-lg text-left transition-all focus-visible:outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] ${
                        isSelected
                          ? "border-primary bg-primary/10 hover:bg-primary/15"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground mb-1">
                            {displayName}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {description}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="w-6 h-6 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="mb-6">
              <h2
                className="text-2xl font-bold mb-2"
                style={{ color: primaryColor }}
              >
                Review & Launch
              </h2>
              <p className="text-muted-foreground">
                Review your configuration before creating the branch
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Branch Information
                </h3>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Branch Name</dt>
                    <dd className="font-semibold text-foreground mt-1">
                      {formData.name || "Not provided"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Branch Code</dt>
                    <dd className="font-semibold text-foreground mt-1 font-mono">
                      {formData.code ? `${tenantPrefix}${formData.code}` : "Not provided"}
                    </dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-muted-foreground flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Location
                    </dt>
                    <dd className="font-semibold text-foreground mt-1">
                      {formData.location || "Not provided"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Contact Details
                </h3>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Name</dt>
                    <dd className="font-semibold text-foreground mt-1">
                      {formData.contactName || "Not provided"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="font-semibold text-foreground mt-1">
                      {formData.contactEmail || "Not provided"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd className="font-semibold text-foreground mt-1">
                      {formData.contactPhone || "Not provided"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  API Configuration
                </h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Webhook URL</dt>
                    <dd className="font-semibold text-foreground mt-1 break-all">
                      {formData.webhookUrl || "Not provided"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Callback URL</dt>
                    <dd className="font-semibold text-foreground mt-1 break-all">
                      {formData.callbackUrl || "Not provided"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Flag className="w-5 h-5" />
                  Selected Features ({formData.features.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {formData.features.length > 0 ? (
                    formData.features.map((f) => (
                      <span
                        key={f}
                        className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
                      >
                        {featureDisplayNames[f] ||
                          f
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    ))
                  ) : (
                    <p className="text-muted-foreground">
                      No features selected
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = step.id < currentStep;
              const isCurrent = step.id === currentStep;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isCompleted
                          ? "text-primary-foreground"
                          : isCurrent
                            ? "text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                      style={
                        isCompleted || isCurrent
                          ? { backgroundColor: primaryColor || "#2563eb" }
                          : undefined
                      }
                    >
                      {isCompleted ? (
                        <Check className="w-6 h-6" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </div>
                    <p
                      className={`text-sm font-medium mt-2 ${
                        isCurrent ? "" : "text-muted-foreground"
                      }`}
                      style={isCurrent ? { color: primaryColor } : undefined}
                    >
                      {step.title}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-4 transition-all ${
                        isCompleted ? "" : "bg-muted"
                      }`}
                      style={
                        isCompleted
                          ? { backgroundColor: primaryColor || "#2563eb" }
                          : undefined
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-card rounded-xl shadow-lg border border-border p-8">
            {renderStepContent()}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-border">
              <Button
                onClick={prevStep}
                disabled={currentStep === 1}
                variant="outline"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              {currentStep < steps.length ? (
                <Button
                  onClick={nextStep}
                  className="text-primary-foreground focus-visible:ring-ring/50"
                  style={{ backgroundColor: primaryColor || "#2563eb" }}
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="text-primary-foreground hover:opacity-90 focus-visible:ring-ring/50 transition-opacity"
                  style={{ backgroundColor: primaryColor || "#10b981" }}
                >
                  {isSubmitting ? "Creating..." : "Create Branch"}
                  <Check className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
