import { businessService } from "../../services/businessService";

export async function createBusinessRecord(payload: {
  tenant_id:   string;
  keycloak_id: string;
  name:        string;
  registration_number: string;
  business_type:       string;
  phone_number?:       string;
  email_address?:      string;
  headquarters_address?: string;
  headquarters_location?: string;
  metadata?: Record<string, unknown>;
}) {
  return businessService.createBusinessRecord(payload);
}
