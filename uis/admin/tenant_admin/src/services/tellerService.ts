import {
  tellerService as apiTellerService,
  tillService as apiTillService,
  transferService as apiTransferService,
  transactionService,
  vaultService as apiVaultService,
} from "@/api/tellerApi";
import type {
  CreateTillTransferRequest,
  DenominationBreakdown,
  ListTellersParams,
  ListTillsParams,
  ListVaultsParams,
  StructuredDenominationBreakdown,
  Teller,
  Till,
  Vault,
} from "@/types/teller";

const getCurrentUserId = (): string => {
  const explicit = localStorage.getItem("keycloak_id");
  if (explicit) return explicit;

  const authUserRaw = localStorage.getItem("auth_user");
  if (!authUserRaw) return "system";

  try {
    const authUser = JSON.parse(authUserRaw) as {
      id?: string;
      keycloak_id?: string;
    };
    return authUser.keycloak_id || authUser.id || "system";
  } catch {
    return "system";
  }
};

const toFlatDenominationBreakdown = (
  breakdown?: StructuredDenominationBreakdown,
): DenominationBreakdown => {
  const mapped: DenominationBreakdown = {
    n1000: 0,
    n500: 0,
    n200: 0,
    n100: 0,
    n50: 0,
    n20: 0,
    n10: 0,
    n5: 0,
  };

  if (!breakdown?.denominations) return mapped;

  for (const denom of breakdown.denominations) {
    const nairaValue = Math.round(denom.value / 100);
    const key = `n${nairaValue}` as keyof DenominationBreakdown;
    if (key in mapped) {
      mapped[key] = denom.count;
    }
  }

  return mapped;
};

export const tellerService = {
  async listTellers(params?: ListTellersParams): Promise<Teller[]> {
    const response = await apiTellerService.listTellers(params);
    return response.data;
  },

  async getTeller(tellerId: string) {
    return apiTellerService.getTeller(tellerId);
  },

  async registerTeller(data: Parameters<typeof apiTellerService.registerTeller>[0]) {
    return apiTellerService.registerTeller(data);
  },

  async updateTellerStatus(tellerId: string, status: Teller["status"]) {
    return apiTellerService.updateTellerStatus(tellerId, { status });
  },

  async updateTellerAssignment(
    tellerId: string,
    windowNumber: number | string | null,
    tillId: string | null,
  ) {
    return apiTellerService.updateTellerAssignment(tellerId, {
      window_number:
        windowNumber === null || windowNumber === undefined
          ? undefined
          : String(windowNumber),
      assigned_till_id: tillId || undefined,
    });
  },
};

export const tillService = {
  async listTills(params?: ListTillsParams): Promise<Till[]> {
    const response = await apiTillService.listTills(params);
    return response.data;
  },

  async createTill(data: Parameters<typeof apiTillService.createTill>[0]) {
    return apiTillService.createTill(data);
  },

  async getTill(tillId: string) {
    return apiTillService.getTill(tillId);
  },

  async createTillTransfer(data: Partial<CreateTillTransferRequest> & {
    source_type: "till" | "vault";
    source_id: string;
    dest_type: "till" | "vault";
    dest_id: string;
    amount: number;
    currency?: string;
    denomination_breakdown?: StructuredDenominationBreakdown;
    reason?: string;
  }) {
    const transferType =
      data.source_type === "till" && data.dest_type === "vault"
        ? "till_to_vault"
        : data.source_type === "vault" && data.dest_type === "till"
          ? "vault_to_till"
          : "till_to_till";

    return apiTransferService.createTillTransfer({
      transfer_type: transferType,
      source_type: data.source_type,
      source_id: data.source_id,
      destination_type: data.dest_type,
      destination_id: data.dest_id,
      dest_type: data.dest_type,
      dest_id: data.dest_id,
      amount: data.amount,
      currency: data.currency || "NGN",
      denomination_breakdown: data.denomination_breakdown,
      notes: data.reason,
    });
  },
};

export const vaultService = {
  async listVaults(params?: ListVaultsParams): Promise<Vault[]> {
    const response = await apiVaultService.listVaults(params);
    return response.data;
  },

  async startVaultCount(vaultId: string) {
    return apiVaultService.startVaultCount(vaultId, {
      custodian_1_id: getCurrentUserId(),
    });
  },

  async completeVaultCount(
    vaultId: string,
    actualBalance: number,
    _currency: string,
    breakdown: StructuredDenominationBreakdown,
  ): Promise<{ discrepancy: number } & Record<string, unknown>> {
    const response = await apiVaultService.completeVaultCount(vaultId, {
      actual_balance: actualBalance,
      denomination_breakdown: toFlatDenominationBreakdown(breakdown),
      custodian_1_id: getCurrentUserId(),
    });
    const responseAny = response as unknown as { discrepancy?: number } & Record<string, unknown>;

    return {
      discrepancy: typeof responseAny.discrepancy === "number" ? responseAny.discrepancy : 0,
      ...responseAny,
    };
  },
};

export { transactionService };
