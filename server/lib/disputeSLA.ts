/**
 * D5: Dispute SLA Tracking — automatic escalation, timer tracking, breach alerts.
 * CBN mandates: 72-hour acknowledgment, 15-day resolution for card disputes.
 */

export interface SLATimer {
  disputeId: string;
  category: string;
  acknowledgedWithin: number | null; // hours
  resolvedWithin: number | null;     // days
  slaTarget: { acknowledgmentHours: number; resolutionDays: number };
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  breached: boolean;
  escalationLevel: number; // 0=none, 1=supervisor, 2=head, 3=compliance
  nextEscalationAt: string | null;
}

const SLA_TARGETS: Record<string, { acknowledgmentHours: number; resolutionDays: number }> = {
  unauthorized_transaction: { acknowledgmentHours: 24, resolutionDays: 10 },
  service_not_rendered:     { acknowledgmentHours: 48, resolutionDays: 15 },
  duplicate_charge:         { acknowledgmentHours: 48, resolutionDays: 10 },
  wrong_amount:             { acknowledgmentHours: 48, resolutionDays: 10 },
  counterfeit_card:         { acknowledgmentHours: 24, resolutionDays: 10 },
  atm_failure:              { acknowledgmentHours: 24, resolutionDays: 5 },
  default:                  { acknowledgmentHours: 72, resolutionDays: 15 },
};

export function getSLATarget(category: string): { acknowledgmentHours: number; resolutionDays: number } {
  return SLA_TARGETS[category] ?? SLA_TARGETS.default;
}

export function computeSLAStatus(
  disputeId: string,
  category: string,
  createdAt: Date,
  acknowledgedAt: Date | null,
  resolvedAt: Date | null,
): SLATimer {
  const target = getSLATarget(category);
  const now = new Date();

  const ackHours = acknowledgedAt
    ? (acknowledgedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
    : null;

  const resolveDays = resolvedAt
    ? (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    : null;

  const elapsedHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  const elapsedDays = elapsedHours / 24;

  const ackBreached = !acknowledgedAt && elapsedHours > target.acknowledgmentHours;
  const resolveBreached = !resolvedAt && elapsedDays > target.resolutionDays;
  const breached = ackBreached || resolveBreached;

  let escalationLevel = 0;
  if (!resolvedAt) {
    if (elapsedDays > target.resolutionDays) escalationLevel = 3; // compliance
    else if (elapsedDays > target.resolutionDays * 0.75) escalationLevel = 2; // head
    else if (elapsedDays > target.resolutionDays * 0.5) escalationLevel = 1; // supervisor
  }

  const nextEscalationHours = [
    target.resolutionDays * 0.5 * 24,
    target.resolutionDays * 0.75 * 24,
    target.resolutionDays * 24,
  ].find((h) => h > elapsedHours);

  return {
    disputeId,
    category,
    acknowledgedWithin: ackHours ? Math.round(ackHours * 10) / 10 : null,
    resolvedWithin: resolveDays ? Math.round(resolveDays * 10) / 10 : null,
    slaTarget: target,
    acknowledgedAt: acknowledgedAt?.toISOString() ?? null,
    resolvedAt: resolvedAt?.toISOString() ?? null,
    breached,
    escalationLevel,
    nextEscalationAt: nextEscalationHours
      ? new Date(createdAt.getTime() + nextEscalationHours * 60 * 60 * 1000).toISOString()
      : null,
  };
}
