import { ApplicationFailure, proxyActivities } from "@temporalio/workflow";
import * as activities from "../activities";
import { ICreateEmployeeWorkflow } from "../types/workflows";
import {
  CustomerRole,
  NotificationCategory,
  NotificationType,
} from "../utils/enums";

export async function createEmployeeWorkflow(
  args: ICreateEmployeeWorkflow,
): Promise<string> {
  const {
    createAuthProfile,
    createAdminProfile,
    sendEmail,
    initializeKyc,
    setupPassword,
    saveAdminKycState,
    checkTenantBillingStatus,
    screenSanctions,
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
    // 00. Billing gate
    await checkTenantBillingStatus(args.tenantId);

    // 00a. Sanctions screening
    await screenSanctions({
      name: `${args.firstName} ${args.lastName}`,
      tenantId: args.tenantId,
      triggeredBy: "employee-onboarding",
      screenType: "onboarding",
    });

    // 01a. Create Auth Profile
    const auth = await createAuthProfile({
      email: args.email,
      user_role: CustomerRole.ADMIN,
      tenant_id: args.tenantId,
      keycloak_realm: args.keycloakRealm,
      keycloak_pub_key: args.keycloakPublicKey,
      tenant_role: args.role,
    });

    // 01b. Setup Password
    await setupPassword({
      keycloak_id: auth.auth.keycloak_id,
      password: args.password,
      confirm_password: args.password,
      tenant_id: args.tenantId,
      keycloak_realm: args.keycloakRealm,
      keycloak_pub_key: args.keycloakPublicKey,
    });

    // 02. Create Admin Profile with employee role
    await createAdminProfile({
      first_name: args.firstName,
      last_name: args.lastName,
      email: args.email,
      phone: args.phone,
      uin: args.uin,
      keycloak_id: auth.auth.keycloak_id,
      tenant_role: args.role,
      tenant_id: args.tenantId,
      branch_id: args.branchId,
    });

    // 03. Send Welcome Email
    await sendEmail({
      createSubscriber: true,
      category: NotificationCategory.EMAIL,
      payload: { url: "" },
      subscriberId: `${args.tenantId}_${auth.auth.keycloak_id}`,
      type: NotificationType.WELCOME_EMAIL,
      subscriber: {
        subscriberId: `${args.tenantId}_${auth.auth.keycloak_id}`,
        traits: {
          email: args.email,
          phone: args.phone,
          firstName: args.firstName,
          lastName: args.lastName,
        },
      },
    });

    // 04. Initialize KYC
    const kyc = await initializeKyc({
      user: {
        firstName: args.firstName,
        lastName: args.lastName,
        phone: args.phone,
        UIN: args.uin,
      },
      metadata: {
        keycloak_id: auth.auth.keycloak_id,
        tenant_id: args.tenantId,
        ledger_id: args.ledgerId,
        is_admin: true,
      },
    });

    // 05. Send KYC Email
    await sendEmail({
      createSubscriber: false,
      category: NotificationCategory.EMAIL,
      payload: {
        id: kyc.id,
        url: kyc.url,
      },
      subscriberId: `${args.tenantId}_${auth.auth.keycloak_id}`,
      type: NotificationType.KYC,
    });

    // 06. Save KYC State
    await saveAdminKycState(kyc.url, args.tenantId, auth.auth.keycloak_id);

    return kyc.url;
  } catch (e: any) {
    throw new ApplicationFailure(e.message);
  }
}
