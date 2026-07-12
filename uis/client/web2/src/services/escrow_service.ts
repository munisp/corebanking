import type { CreateEscrowRequest, Escrow } from "../models/escrow";
import { apiService } from "./api_service";

class EscrowService {
  async getEscrows(): Promise<Escrow[]> {
    const response = await apiService.get("/escrow/api/v1/escrow/contracts");
    const dataArr = (response.data as { data: Record<string, unknown>[] }).data;
    return dataArr.map((item) => this.parseEscrow(item));
  }

  async getEscrowById(id: string): Promise<Escrow> {
    const response = await apiService.get(`/escrow/api/v1/escrow/${id}`);
    return this.parseEscrow(response.data as Record<string, unknown>);
  }

  async createEscrow(
    request: CreateEscrowRequest | Record<string, unknown>,
  ): Promise<{ success: boolean; message: string; escrow?: Escrow }> {
    try {
      const response = await apiService.post("/escrow/api/v1/escrow/contracts", request);
      return {
        success: true,
        message: "Escrow created successfully",
        escrow: this.parseEscrow(response.data as Record<string, unknown>),
      };
    } catch (error) {
      console.error("Error creating escrow:", error);
      return {
        success: false,
        message: "Failed to create escrow",
      };
    }
  }

  async releaseEscrow(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await apiService.post(`/escrow/api/v1/escrow/${id}/release`);
      return {
        success: true,
        message: "Escrow released successfully",
      };
    } catch (error) {
      console.error("Error releasing escrow:", error);
      return {
        success: false,
        message: "Failed to release escrow",
      };
    }
  }

  async fundEscrow(id: string, amount: number): Promise<void> {
    await apiService.post(`/escrow/api/v1/escrow/${id}/fund`, { amount });
  }

  async cancelEscrow(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await apiService.post(`/escrow/api/v1/escrow/${id}/cancel`);
      return {
        success: true,
        message: "Escrow cancelled successfully",
      };
    } catch (error) {
      console.error("Error cancelling escrow:", error);
      return {
        success: false,
        message: "Failed to cancel escrow",
      };
    }
  }

  private parseEscrow(data: Record<string, unknown>): Escrow {
    // Backend sends parties as an array: [{role: "buyer"|"seller"|"agent", name, email, account_number, bank_code}, ...]
    const parties = Array.isArray(data.parties) ? (data.parties as Record<string, unknown>[]) : [];
    const byRole = (role: string) => parties.find((p) => String(p.role || "").toLowerCase() === role) ?? {};
    const buyer = byRole("buyer");
    const seller = byRole("seller");
    const agent = byRole("agent");

    return {
      id: String(data.id || data._id || ""),
      title: String(data.title || ""),
      type: String(data.use_case || data.type || ""),
      amount: Number(data.total_amount || data.amount || 0),
      status: String(data.status || ""),
      buyerName: String(buyer.name || ""),
      buyerEmail: String(buyer.email || ""),
      sellerName: String(seller.name || ""),
      sellerEmail: String(seller.email || ""),
      sellerAccountNumber: String(seller.account_number || ""),
      sellerBank: String(seller.bank_code || ""),
      agentName: agent.name ? String(agent.name) : undefined,
      agentEmail: agent.email ? String(agent.email) : undefined,
      releaseConditions: String(data.release_conditions || data.releaseConditions || ""),
      createdAt: data.created_at ? new Date(data.created_at as string) : new Date(),
      releaseDate: data.completed_at ? new Date(data.completed_at as string) : undefined,
      description: data.description ? String(data.description) : undefined,
    };
  }

  // Removed getMockEscrows: only API data is used now.
}

export const escrowService = new EscrowService();
