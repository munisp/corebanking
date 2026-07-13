import { ApplicationFailure } from "@temporalio/activity";
import { sanctionsService } from "../../services/sanctionsService";

export async function screenSanctions(args: {
  name: string;
  tenantId: string;
  triggeredBy: string;
  customerId?: string;
  screenType?: string;
}): Promise<void> {
  const result = await sanctionsService.screen(args);

  if (result.action === "block" || result.action === "hold_and_review") {
    const matchSummary = result.matches
      .map((m) => `${m.list_name}: ${m.matched_name} (score ${m.similarity_score.toFixed(2)})`)
      .join("; ");
    throw ApplicationFailure.nonRetryable(
      `Onboarding blocked: sanctions match for "${args.name}" — ${matchSummary || result.action}`
    );
  }
}
