import { ApplicationFailure, proxyActivities } from "@temporalio/workflow";
import * as activities from "../activities";

export interface IDecommissionTenantWorkflow {
  tenantId: string;
}

// PL-02: tenant offboarding. Real, minimal, verifiable steps — every step is
// an actual API call:
//   1. verify the tenant record exists (tenant-management GET)
//   2. revoke all Keycloak sessions in the tenant realm (logout-all)
//   3. delete the Keycloak realm (delete_realm — previously dead code)
//   4. mark the tenant SUSPENDED in tenant-management (its terminal state;
//      no OFFBOARDED status exists there as of 1c9134e2)
//   5. publish a tenant.tombstoned event for downstream consumers
export async function decommissionTenantWorkflow(
  args: IDecommissionTenantWorkflow,
): Promise<null> {
  const {
    getTenant,
    revokeTenantSessions,
    deleteTenantRealm,
    suspendTenantRecord,
    publishTenantTombstone,
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

  const realm = `54link_${args.tenantId}`;

  try {
    // 01. Verify tenant exists
    const tenant = await getTenant(args.tenantId);
    if (!tenant) {
      throw ApplicationFailure.nonRetryable(
        `Tenant ${args.tenantId} not found.`,
        "NonRetriableApplicationError",
      );
    }

    // 02. Revoke live sessions/tokens
    await revokeTenantSessions(realm);

    // 03. Delete the realm (removes users, clients, keys)
    await deleteTenantRealm(realm);

    // 04. Suspend the tenant record (terminal state in tenant-management)
    await suspendTenantRecord(args.tenantId);

    // 05. Publish tombstone event
    await publishTenantTombstone(args.tenantId);

    return null;
  } catch (e: any) {
    if (e instanceof ApplicationFailure) throw e;
    throw new ApplicationFailure(
      `Tenant decommission workflow failed: ${e.message}`,
    );
  }
}
