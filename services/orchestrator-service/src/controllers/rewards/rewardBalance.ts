import { AppDataSource } from "../../database/dataSource";
import { RewardEventEntity } from "../../entity/RewardEvent";
import { RewardRedemptionEntity } from "../../entity/RewardRedemption";

export interface RewardBalance {
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  earnedThisMonth: number;
  redeemedThisMonth: number;
}

/** Aggregate a customer's earned vs redeemed reward points (real DB sums). */
export async function computeRewardBalance(tenantId: string, userId: string): Promise<RewardBalance> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const earnedRepo = AppDataSource.getRepository(RewardEventEntity);
  const redeemedRepo = AppDataSource.getRepository(RewardRedemptionEntity);

  const [earnedRows, redeemedRows] = await Promise.all([
    earnedRepo
      .createQueryBuilder("e")
      .select("COALESCE(SUM(e.points), 0)", "total")
      .addSelect("COALESCE(SUM(CASE WHEN e.created_at >= :monthStart THEN e.points ELSE 0 END), 0)", "month")
      .where("e.tenant_id = :tenantId AND e.user_id = :userId", { tenantId, userId, monthStart })
      .getRawOne<{ total: string; month: string }>(),
    redeemedRepo
      .createQueryBuilder("r")
      .select("COALESCE(SUM(r.points_spent), 0)", "total")
      .addSelect(
        "COALESCE(SUM(CASE WHEN r.created_at >= :monthStart THEN r.points_spent ELSE 0 END), 0)",
        "month",
      )
      .where("r.tenant_id = :tenantId AND r.user_id = :userId AND r.status != :failed", {
        tenantId,
        userId,
        monthStart,
        failed: "failed",
      })
      .getRawOne<{ total: string; month: string }>(),
  ]);

  return {
    lifetimeEarned: Number(earnedRows?.total ?? 0),
    lifetimeRedeemed: Number(redeemedRows?.total ?? 0),
    earnedThisMonth: Number(earnedRows?.month ?? 0),
    redeemedThisMonth: Number(redeemedRows?.month ?? 0),
  };
}
