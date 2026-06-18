export type PricingModelInputs = {
  licenseCost: number;
  implementationCost: number;
  customizationCost: number;
  year1SupportCost: number;
  trainingAndGovernanceCost: number;
  vatAmount: number;
  recurringYear2Cost: number;
  recurringYear3Cost: number;
  recurringYear4Cost: number;
  recurringYear5Cost: number;
  requestedNamedUsers: number;
  requestedCustomerRecords: number;
  requestedBranches: number;
  requestedNonProductionEnvironments: number;
  includedNamedUsers: number;
  includedCustomerRecords: number;
  includedBranches: number;
  includedNonProductionEnvironments: number;
  userBlockSize: number;
  userBlockCharge: number;
  customerRecordBlockSize: number;
  customerRecordBlockCharge: number;
  branchChargePerExtraBranch: number;
  extraEnvironmentCharge: number;
  applyExpansionChargesToRenewalYears: boolean;
};

export type PricingModelResult = {
  year1BaseTotal: number;
  year1ExpansionTotal: number;
  year1Total: number;
  renewalBaseTotal: number;
  renewalExpansionAnnual: number;
  renewalExpansionTotal: number;
  years2To5Total: number;
  fiveYearTotal: number;
  overageBreakdown: {
    additionalNamedUsers: number;
    additionalUserBlocks: number;
    namedUserCharge: number;
    additionalCustomerRecords: number;
    additionalCustomerRecordBlocks: number;
    customerRecordCharge: number;
    additionalBranches: number;
    branchCharge: number;
    additionalNonProductionEnvironments: number;
    environmentCharge: number;
  };
  yearlyTotals: Array<{
    year: 1 | 2 | 3 | 4 | 5;
    baseCost: number;
    expansionCost: number;
    totalCost: number;
  }>;
};

export const defaultPricingModelInputs: PricingModelInputs = {
  licenseCost: 14_000_000,
  implementationCost: 18_500_000,
  customizationCost: 9_500_000,
  year1SupportCost: 14_000_000,
  trainingAndGovernanceCost: 6_000_000,
  vatAmount: 8_000_000,
  recurringYear2Cost: 9_000_000,
  recurringYear3Cost: 9_000_000,
  recurringYear4Cost: 10_000_000,
  recurringYear5Cost: 10_000_000,
  requestedNamedUsers: 150,
  requestedCustomerRecords: 200_000,
  requestedBranches: 25,
  requestedNonProductionEnvironments: 2,
  includedNamedUsers: 150,
  includedCustomerRecords: 200_000,
  includedBranches: 25,
  includedNonProductionEnvironments: 2,
  userBlockSize: 25,
  userBlockCharge: 1_250_000,
  customerRecordBlockSize: 50_000,
  customerRecordBlockCharge: 2_000_000,
  branchChargePerExtraBranch: 350_000,
  extraEnvironmentCharge: 1_500_000,
  applyExpansionChargesToRenewalYears: true,
};

function safePositiveInteger(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function safeCurrency(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function calculateBlocks(excess: number, blockSize: number) {
  if (excess <= 0) return 0;
  if (blockSize <= 0) return 0;
  return Math.ceil(excess / blockSize);
}

export function formatNaira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function calculatePlatformPricing(rawInputs: PricingModelInputs): PricingModelResult {
  const inputs: PricingModelInputs = {
    ...rawInputs,
    licenseCost: safeCurrency(rawInputs.licenseCost),
    implementationCost: safeCurrency(rawInputs.implementationCost),
    customizationCost: safeCurrency(rawInputs.customizationCost),
    year1SupportCost: safeCurrency(rawInputs.year1SupportCost),
    trainingAndGovernanceCost: safeCurrency(rawInputs.trainingAndGovernanceCost),
    vatAmount: safeCurrency(rawInputs.vatAmount),
    recurringYear2Cost: safeCurrency(rawInputs.recurringYear2Cost),
    recurringYear3Cost: safeCurrency(rawInputs.recurringYear3Cost),
    recurringYear4Cost: safeCurrency(rawInputs.recurringYear4Cost),
    recurringYear5Cost: safeCurrency(rawInputs.recurringYear5Cost),
    requestedNamedUsers: safePositiveInteger(rawInputs.requestedNamedUsers),
    requestedCustomerRecords: safePositiveInteger(rawInputs.requestedCustomerRecords),
    requestedBranches: safePositiveInteger(rawInputs.requestedBranches),
    requestedNonProductionEnvironments: safePositiveInteger(rawInputs.requestedNonProductionEnvironments),
    includedNamedUsers: safePositiveInteger(rawInputs.includedNamedUsers),
    includedCustomerRecords: safePositiveInteger(rawInputs.includedCustomerRecords),
    includedBranches: safePositiveInteger(rawInputs.includedBranches),
    includedNonProductionEnvironments: safePositiveInteger(rawInputs.includedNonProductionEnvironments),
    userBlockSize: safePositiveInteger(rawInputs.userBlockSize),
    userBlockCharge: safeCurrency(rawInputs.userBlockCharge),
    customerRecordBlockSize: safePositiveInteger(rawInputs.customerRecordBlockSize),
    customerRecordBlockCharge: safeCurrency(rawInputs.customerRecordBlockCharge),
    branchChargePerExtraBranch: safeCurrency(rawInputs.branchChargePerExtraBranch),
    extraEnvironmentCharge: safeCurrency(rawInputs.extraEnvironmentCharge),
  };

  const additionalNamedUsers = Math.max(0, inputs.requestedNamedUsers - inputs.includedNamedUsers);
  const additionalCustomerRecords = Math.max(0, inputs.requestedCustomerRecords - inputs.includedCustomerRecords);
  const additionalBranches = Math.max(0, inputs.requestedBranches - inputs.includedBranches);
  const additionalNonProductionEnvironments = Math.max(
    0,
    inputs.requestedNonProductionEnvironments - inputs.includedNonProductionEnvironments,
  );

  const additionalUserBlocks = calculateBlocks(additionalNamedUsers, inputs.userBlockSize);
  const additionalCustomerRecordBlocks = calculateBlocks(additionalCustomerRecords, inputs.customerRecordBlockSize);

  const namedUserCharge = additionalUserBlocks * inputs.userBlockCharge;
  const customerRecordCharge = additionalCustomerRecordBlocks * inputs.customerRecordBlockCharge;
  const branchCharge = additionalBranches * inputs.branchChargePerExtraBranch;
  const environmentCharge = additionalNonProductionEnvironments * inputs.extraEnvironmentCharge;

  const year1ExpansionTotal = namedUserCharge + customerRecordCharge + branchCharge + environmentCharge;
  const year1BaseTotal =
    inputs.licenseCost +
    inputs.implementationCost +
    inputs.customizationCost +
    inputs.year1SupportCost +
    inputs.trainingAndGovernanceCost +
    inputs.vatAmount;
  const year1Total = year1BaseTotal + year1ExpansionTotal;

  const renewalBaseTotal =
    inputs.recurringYear2Cost +
    inputs.recurringYear3Cost +
    inputs.recurringYear4Cost +
    inputs.recurringYear5Cost;
  const renewalExpansionAnnual = inputs.applyExpansionChargesToRenewalYears ? year1ExpansionTotal : 0;
  const renewalExpansionTotal = renewalExpansionAnnual * 4;
  const years2To5Total = renewalBaseTotal + renewalExpansionTotal;
  const fiveYearTotal = year1Total + years2To5Total;

  return {
    year1BaseTotal,
    year1ExpansionTotal,
    year1Total,
    renewalBaseTotal,
    renewalExpansionAnnual,
    renewalExpansionTotal,
    years2To5Total,
    fiveYearTotal,
    overageBreakdown: {
      additionalNamedUsers,
      additionalUserBlocks,
      namedUserCharge,
      additionalCustomerRecords,
      additionalCustomerRecordBlocks,
      customerRecordCharge,
      additionalBranches,
      branchCharge,
      additionalNonProductionEnvironments,
      environmentCharge,
    },
    yearlyTotals: [
      { year: 1, baseCost: year1BaseTotal, expansionCost: year1ExpansionTotal, totalCost: year1Total },
      {
        year: 2,
        baseCost: inputs.recurringYear2Cost,
        expansionCost: renewalExpansionAnnual,
        totalCost: inputs.recurringYear2Cost + renewalExpansionAnnual,
      },
      {
        year: 3,
        baseCost: inputs.recurringYear3Cost,
        expansionCost: renewalExpansionAnnual,
        totalCost: inputs.recurringYear3Cost + renewalExpansionAnnual,
      },
      {
        year: 4,
        baseCost: inputs.recurringYear4Cost,
        expansionCost: renewalExpansionAnnual,
        totalCost: inputs.recurringYear4Cost + renewalExpansionAnnual,
      },
      {
        year: 5,
        baseCost: inputs.recurringYear5Cost,
        expansionCost: renewalExpansionAnnual,
        totalCost: inputs.recurringYear5Cost + renewalExpansionAnnual,
      },
    ],
  };
}
