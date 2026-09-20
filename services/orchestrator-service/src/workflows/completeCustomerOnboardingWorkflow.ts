import { ApplicationFailure, proxyActivities } from "@temporalio/workflow";
import * as activities from "../activities";
import { ICompleteCustomerOnboardingWorkflow } from "../types/workflows";

export async function completeCustomerOnboardingWorkflow(
  args: ICompleteCustomerOnboardingWorkflow,
): Promise<null> {
  const {
    createAccountProfile,
    getUserProfile,
    markCustomerKycComplete,
    markCustomerKycFailed,
    markAdminKycComplete,
    assignCustomerTier,
  } = proxyActivities<typeof activities>({
    retry: {
      initialInterval: "1s",
      maximumInterval: "1m",
      backoffCoefficient: 2,
      maximumAttempts: 3,
      nonRetryableErrorTypes: ["NonRetriableApplicationError"],
    },
    startToCloseTimeout: "1m",
  });

  try {
    if (args.metadata.is_admin) {
      // 01. Mark Admin KYC status complete
      await markAdminKycComplete(
        args.metadata.tenant_id,
        args.metadata.keycloak_id,
      );
    } else {
      // 01. Get user details
      const user = await getUserProfile(
        args.metadata.tenant_id,
        args.metadata.keycloak_id,
      );

      // 02. Create user account
      await createAccountProfile({
        name: user.name || user.first_name + " " + user.last_name,
        keycloak_id: args.metadata.keycloak_id,
        tenant_id: user.tenant_id,
        ledger_id: args.metadata.ledger_id ?? "1",
      });

      // 03. Mark KYC status complete
      await markCustomerKycComplete(
        args.metadata.tenant_id,
        args.metadata.keycloak_id,
      );

      // 04. Assign KYC tier — activity calls BVN/NIN service to determine tier
      await assignCustomerTier(
        args.metadata.tenant_id,
        args.metadata.keycloak_id,
        args.faceVerificationResult?.success === true,
      );
    }

    return null;
  } catch (e: any) {
    // OR-22: failure path wiring — a customer whose onboarding completion
    // failed must not stay PENDING forever; mark the KYC as failed so the
    // directory state matches reality (user-service /user/kyc/fail).
    if (!args.metadata.is_admin) {
      try {
        await markCustomerKycFailed(
          args.metadata.tenant_id,
          args.metadata.keycloak_id,
        );
      } catch {
        // Never mask the original failure with a failure-path update error.
      }
    }
    throw new ApplicationFailure(e.message);
  }
}
