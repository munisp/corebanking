/**
 * Reward redemption catalog — the purchasable options offered to customers.
 * Static configuration; redemptions against it are persisted in
 * reward_redemptions (see redeemReward.ts).
 */
export interface RewardCatalogOption {
  id: string;
  title: string;
  description: string;
  points_required: number;
  category: string;
  image_url?: string;
  is_available: boolean;
}

export const REWARD_CATALOG: RewardCatalogOption[] = [
  {
    id: "cashback_1000",
    title: "₦1,000 Cashback",
    description: "Convert points into ₦1,000 cashback credited to your primary account.",
    points_required: 1000,
    category: "cashback",
    is_available: true,
  },
  {
    id: "cashback_5000",
    title: "₦5,000 Cashback",
    description: "Convert points into ₦5,000 cashback credited to your primary account.",
    points_required: 4500,
    category: "cashback",
    is_available: true,
  },
  {
    id: "airtime_500",
    title: "₦500 Airtime",
    description: "Top up any Nigerian mobile number with ₦500 airtime.",
    points_required: 600,
    category: "bonus",
    is_available: true,
  },
  {
    id: "data_bundle_1gb",
    title: "1GB Data Bundle",
    description: "1GB data bundle on any supported Nigerian network.",
    points_required: 800,
    category: "bonus",
    is_available: true,
  },
  {
    id: "fee_waiver_month",
    title: "One-Month Fee Waiver",
    description: "No account maintenance or transfer fees for one month.",
    points_required: 2500,
    category: "milestone",
    is_available: true,
  },
];

export function findRewardOption(optionId: string): RewardCatalogOption | undefined {
  return REWARD_CATALOG.find((o) => o.id === optionId);
}
