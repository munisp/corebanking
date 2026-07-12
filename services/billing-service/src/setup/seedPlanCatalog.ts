import { billingPlanCatalogRepository } from "../repositories/billingPlanCatalogRepository";
import { generateId } from "../utils/id";
import logger from "../config/logger.config";

/**
 * Placeholder pricing — finance/product must confirm real numbers before production.
 * Annual price = 10x monthly (2 months free); annual included calls = 12x monthly.
 */
const CATALOG_SEED: Array<{
  plan: "standard" | "premium" | "enterprise";
  billingPeriod: "monthly" | "annual";
  basePrice: number;
  includedApiCalls: number;
  overagePricePerCall: number;
}> = [
  { plan: "standard", billingPeriod: "monthly", basePrice: 25_000, includedApiCalls: 10_000, overagePricePerCall: 2 },
  { plan: "standard", billingPeriod: "annual", basePrice: 250_000, includedApiCalls: 120_000, overagePricePerCall: 2 },
  { plan: "premium", billingPeriod: "monthly", basePrice: 75_000, includedApiCalls: 50_000, overagePricePerCall: 1.5 },
  { plan: "premium", billingPeriod: "annual", basePrice: 750_000, includedApiCalls: 600_000, overagePricePerCall: 1.5 },
  { plan: "enterprise", billingPeriod: "monthly", basePrice: 200_000, includedApiCalls: 250_000, overagePricePerCall: 1 },
  { plan: "enterprise", billingPeriod: "annual", basePrice: 2_000_000, includedApiCalls: 3_000_000, overagePricePerCall: 1 },
];

export async function seedPlanCatalog(): Promise<void> {
  for (const entry of CATALOG_SEED) {
    const existing = await billingPlanCatalogRepository.findByPlanAndPeriod(entry.plan, entry.billingPeriod);
    if (existing) continue;
    await billingPlanCatalogRepository.save({
      id: generateId("plc"),
      currency: "NGN",
      isActive: true,
      ...entry,
    });
  }
  logger.info("[billing-service] Plan catalog seeded");
}
