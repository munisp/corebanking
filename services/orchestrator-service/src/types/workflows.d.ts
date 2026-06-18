import z from "zod";
import { BillingPlan, CustomerRole, TenantType } from "../utils/enums";
import { ICreateAccountResponse } from "./account";
import { ITenant } from "./tenant";

export interface ICreateCustomerWorkflow {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  uin: string;
  role?: CustomerRole;
  tenantId: string;
  keycloakRealm: string;
  keycloakPublicKey: string;
  ledgerId: string;
  password: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface ICreateAdminWorkflow {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  uin: string;
  tenantId: string;
  keycloakRealm: string;
  keycloakPublicKey: string;
  ledgerId: string;
  platformRole?: string;
  tenantRole?: string;
  branchId?: string;
  password: string;
}

export interface ICreateEmployeeWorkflow {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  uin: string;
  role: string;
  branchId: string;
  tenantId: string;
  keycloakRealm: string;
  keycloakPublicKey: string;
  ledgerId: string;
  password: string;
}

export interface ICreateAgentWorkflow {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  uin: string;
  tenantId: string;
  keycloakRealm: string;
  keycloakPublicKey: string;
  ledgerId: string;
  password: string;
  agentRole?: string;
  businessName?: string;
  businessAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  lga?: string;
}

export interface IContact {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  uin: string;
  role?: CustomerRole;
  password: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface ICreateTenantWorkflow {
  name: string;
  type: TenantType;
  tenantId: string;
  ledgerId: string;
  contact: IContact;
  cacCertificateUrl?: string;
  cbnLicenseUrl?: string;
  branding?: {
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    domain?: string;
  };
  featureFlags?: TenantFeatureFlag[];
  plan?: BillingPlan;
  apiConfiguration?: {
    webhookUrl?: string;
    callbackUrl?: string;
  };
}

export interface ICreateBusinessWorkflow {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  uin: string;
  businessName: string;
  tin: string;
  cac: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  tenantId: string;
  keycloakRealm: string;
  keycloakPublicKey: string;
  password: string;
}

export interface ICompleteCustomerOnboardingWorkflow {
  id: string;
  score?: number;
  faceVerificationResult?: {
    success: boolean;
    similarity: number;
  };
  dataVerificationResult?: {
    firstName: boolean;
    lastName: boolean;
    phone: boolean;
    dateOfBirth: boolean;
    UIN: boolean;
  };
  metadata: {
    keycloak_id: string;
    tenant_id: string;
    ledger_id?: string;
    is_admin?: boolean;
  };
}

export interface ICompleteAgentOnboardingWorkflow {
  metadata: {
    keycloak_id: string;
    tenant_id: string;
    ledger_id?: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface WorkflowOptions<T> {
  args: T;
  workflowId: string;
  defaultErrorMessage?: string;
  withTimeOut?: number;
  timeOutFn?: () => any | Promise<any>;
}
