import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { useAuth } from "@/services/auth";
import {
    onboardingService,
    TENANT_ROLE_LABELS,
    TENANT_ROLES,
    type OnboardingData,
} from "@/services/onboarding";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    MapPin,
    Shield,
    User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const steps = [
  { id: 1, title: "Personal Information", icon: User },
  { id: 2, title: "Address", icon: MapPin },
  { id: 3, title: "Identity Verification", icon: Shield },
];

export default function AdminOnboarding() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { primaryColor, secondaryColor, name, logoUrl } = useTenantBranding();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<OnboardingData>({
    name: "",
    email: user?.email || "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "Nigeria",
    postalCode: "",
    bvn: "",
    nin: "",
    tenant_role: "support_agent", // Default to Support Agent
  });

  // Validation errors
  type OnboardingErrors = Partial<Record<keyof OnboardingData, string>> & {
    submit?: string;
  };
  const [errors, setErrors] = useState<OnboardingErrors>({});

  // Validation loading states
  const [validating, setValidating] = useState<
    Partial<Record<keyof OnboardingData, boolean>>
  >({});

  // Load existing data if available
  useEffect(() => {
    const existingData = onboardingService.getOnboardingData();
    if (existingData) {
      setFormData(existingData);
    }
  }, []);

  // Set email from user if available
  useEffect(() => {
    if (user?.email && !formData.email) {
      setFormData((prev) => ({ ...prev, email: user.email }));
    }
  }, [user?.email]);

  const validateStep1 = async (): Promise<boolean> => {
    const newErrors: Partial<Record<keyof OnboardingData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    // Validate email with async validation
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else {
      setValidating((prev) => ({ ...prev, email: true }));
      try {
        const emailValidation = await onboardingService.validateEmailAsync(
          formData.email,
        );
        if (!emailValidation.valid) {
          newErrors.email = emailValidation.error;
        }
      } catch (error) {
        console.log(error);
        newErrors.email = "Failed to validate email. Please try again";
      } finally {
        setValidating((prev) => ({ ...prev, email: false }));
      }
    }

    // Validate phone with async validation
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else {
      setValidating((prev) => ({ ...prev, phone: true }));
      try {
        const phoneValidation =
          await onboardingService.validatePhoneNumberAsync(formData.phone);
        if (!phoneValidation.valid) {
          newErrors.phone = phoneValidation.error;
        }
      } catch (error) {
        console.log(error);
        newErrors.phone = "Failed to validate phone number. Please try again";
      } finally {
        setValidating((prev) => ({ ...prev, phone: false }));
      }
    }

    // Validate tenant role
    if (!formData.tenant_role) {
      newErrors.tenant_role = "Tenant role is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Partial<Record<keyof OnboardingData, string>> = {};

    if (!formData.address.trim()) {
      newErrors.address = "Address is required";
    }

    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }

    if (!formData.state.trim()) {
      newErrors.state = "State is required";
    }

    if (!formData.country.trim()) {
      newErrors.country = "Country is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = async (): Promise<boolean> => {
    const newErrors: Partial<Record<keyof OnboardingData, string>> = {};

    // Validate BVN with async validation
    if (!formData.bvn.trim()) {
      newErrors.bvn = "BVN is required";
    } else {
      setValidating((prev) => ({ ...prev, bvn: true }));
      try {
        const bvnValidation = await onboardingService.validateBVNAsync(
          formData.bvn,
        );
        if (!bvnValidation.valid) {
          newErrors.bvn = bvnValidation.error;
        }
      } catch (error) {
        console.log(error);

        newErrors.bvn = "Failed to validate BVN. Please try again";
      } finally {
        setValidating((prev) => ({ ...prev, bvn: false }));
      }
    }

    // Validate NIN with async validation
    if (!formData.nin.trim()) {
      newErrors.nin = "NIN is required";
    } else {
      setValidating((prev) => ({ ...prev, nin: true }));
      try {
        const ninValidation = await onboardingService.validateNINAsync(
          formData.nin,
        );
        if (!ninValidation.valid) {
          newErrors.nin = ninValidation.error;
        }
      } catch (error) {
        console.log(error);
        newErrors.nin = "Failed to validate NIN. Please try again";
      } finally {
        setValidating((prev) => ({ ...prev, nin: false }));
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = async () => {
    let isValid = false;

    if (currentStep === 1) {
      isValid = await validateStep1();
    } else if (currentStep === 2) {
      isValid = validateStep2();
    }

    if (isValid && currentStep < 3) {
      setCurrentStep(currentStep + 1);
      setErrors({});
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    // Validate step 3 first
    const isValid = await validateStep3();
    if (!isValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Ensure tenant_role is set (default to 'support_agent' if missing)
      const submissionData = {
        ...formData,
        tenant_role: formData.tenant_role || "support_agent",
      };
      const response = await onboardingService.submitOnboarding(submissionData);

      // Check if there are validation errors from the API
      if (!response.success && response.errors) {
        const apiErrors: Partial<Record<keyof OnboardingData, string>> = {};
        response.errors.forEach((error) => {
          apiErrors[error.field as keyof OnboardingData] = error.message;
        });
        setErrors(apiErrors);
        setIsSubmitting(false);
        return;
      }

      // Navigate to KYC screen (onboarding is already marked as complete in the service)
      setLocation("/kyc");
    } catch (error) {
      console.error("Error submitting onboarding:", error);
      setErrors({
        submit: "Failed to submit onboarding data. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
    setErrors({
      submit: "Failed to submit onboarding data. Please try again.",
    });

    const updateField = (field: keyof OnboardingData, value: string) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value || (field === "tenant_role" ? "support_agent" : ""),
      }));
      // Clear error for this field when user starts typing
      if (errors[field]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
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
                  Personal Information
                </h2>
                <p className="text-muted-foreground">
                  Let's start with your basic information
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Enter your full name"
                    className={errors.name ? "border-destructive" : ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="Enter your email"
                      className={errors.email ? "border-destructive" : ""}
                      disabled={!!user?.email || validating.email}
                    />
                    {validating.email && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {user?.email && (
                    <p className="text-sm text-muted-foreground mt-1">
                      This is your login email address
                    </p>
                  )}
                  {errors.email && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="relative">
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="08012345678 or +2348012345678"
                      className={errors.phone ? "border-destructive" : ""}
                      disabled={validating.phone}
                    />
                    {validating.phone && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {errors.phone && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.phone}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter a valid Nigerian phone number
                  </p>
                </div>

                <div>
                  <Label htmlFor="tenant_role">Staff Role *</Label>
                  <select
                    id="tenant_role"
                    value={formData.tenant_role}
                    onChange={(e) => updateField("tenant_role", e.target.value)}
                    className={`w-full mt-1 p-2 rounded border ${errors.tenant_role ? "border-destructive" : "border-input"}`}
                  >
                    {TENANT_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {TENANT_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Defines what this staff member can do within the bank.
                  </p>
                  {errors.tenant_role && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.tenant_role}
                    </p>
                  )}
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
                  Address Information
                </h2>
                <p className="text-muted-foreground">
                  Please provide your residential address
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="address">Street Address *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="Enter your street address"
                    className={errors.address ? "border-destructive" : ""}
                  />
                  {errors.address && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.address}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      placeholder="Enter your city"
                      className={errors.city ? "border-destructive" : ""}
                    />
                    {errors.city && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.city}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => updateField("state", e.target.value)}
                      placeholder="Enter your state"
                      className={errors.state ? "border-destructive" : ""}
                    />
                    {errors.state && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.state}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => updateField("country", e.target.value)}
                      placeholder="Enter your country"
                      className={errors.country ? "border-destructive" : ""}
                    />
                    {errors.country && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.country}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={formData.postalCode}
                      onChange={(e) =>
                        updateField("postalCode", e.target.value)
                      }
                      placeholder="Enter postal code (optional)"
                    />
                  </div>
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
                  Identity Verification
                </h2>
                <p className="text-muted-foreground">
                  Please provide your BVN and NIN for verification
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="bvn">Bank Verification Number (BVN) *</Label>
                  <div className="relative">
                    <Input
                      id="bvn"
                      type="text"
                      value={formData.bvn}
                      onChange={(e) =>
                        updateField("bvn", e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="Enter your 11-digit BVN"
                      maxLength={11}
                      className={errors.bvn ? "border-destructive" : ""}
                      disabled={validating.bvn}
                    />
                    {validating.bvn && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {errors.bvn && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.bvn}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter your 11-digit BVN
                  </p>
                </div>

                <div>
                  <Label htmlFor="nin">
                    National Identification Number (NIN) *
                  </Label>
                  <div className="relative">
                    <Input
                      id="nin"
                      type="text"
                      value={formData.nin}
                      onChange={(e) =>
                        updateField("nin", e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="Enter your 11-digit NIN"
                      maxLength={11}
                      className={errors.nin ? "border-destructive" : ""}
                      disabled={validating.nin}
                    />
                    {validating.nin && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {errors.nin && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.nin}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter your 11-digit NIN
                  </p>
                </div>

                {errors.submit && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
                    {errors.submit}
                  </div>
                )}
              </div>
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <div
        className="min-h-screen flex flex-col"
        style={{
          background: `linear-gradient(to bottom right, ${primaryColor}15, ${secondaryColor}15)`,
        }}
      >
        {/* Header with Logo */}
        <div className="w-full py-6 px-4 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            {logoUrl && (
              <img
                src={logoUrl}
                alt={`${name} logo`}
                className="w-12 h-12 rounded object-contain"
              />
            )}
            <div>
              <h1
                className="text-2xl font-bold"
                style={{ color: primaryColor }}
              >
                {name}
              </h1>
              <p className="text-sm text-muted-foreground">Admin Onboarding</p>
            </div>
          </div>
        </div>

        <div className="flex-1 container py-8">
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
                            ? "bg-primary text-primary-foreground"
                            : isCurrent
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                        }`}
                        style={
                          isCurrent
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
                        className={`text-sm font-medium mt-2 transition-colors ${
                          isCurrent ? "font-semibold" : "text-muted-foreground"
                        }`}
                        style={isCurrent ? { color: primaryColor } : undefined}
                      >
                        {step.title}
                      </p>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`flex-1 h-1 mx-4 transition-all rounded-full ${
                          isCompleted ? "bg-primary" : "bg-muted"
                        }`}
                        style={
                          isCompleted && !isCurrent
                            ? { backgroundColor: primaryColor }
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
            <Card className="p-8 shadow-lg border-0 bg-card/95 backdrop-blur-sm">
              {renderStepContent()}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8 pt-6 border-t border-border">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="flex items-center gap-2 min-w-30"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Previous
                </Button>

                {currentStep < 3 ? (
                  <Button
                    onClick={nextStep}
                    className="flex items-center gap-2 min-w-30 text-primary-foreground hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: primaryColor || "#2563eb" }}
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 min-w-45 text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: primaryColor || "#2563eb" }}
                  >
                    {isSubmitting ? "Submitting..." : "Complete Onboarding"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  };
}
