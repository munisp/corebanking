import { ApplicationFailure, proxyActivities } from "@temporalio/workflow";
import * as activities from "../activities";
import { ICreateCustomerWorkflow } from "../types/workflows";
import { CustomerRole, NotificationCategory, NotificationType } from "../utils/enums";

export async function createCustomerWorkflow(args: ICreateCustomerWorkflow): Promise<string> {
  const { createAuthProfile, deleteAuthProfile, createUserProfile, sendEmail, initializeKyc, setupPassword, saveKycState, checkTenantBillingStatus, screenSanctions } =
    proxyActivities<typeof activities>({
      retry: {
        initialInterval: "1s",
        maximumInterval: "1m",
        backoffCoefficient: 2,
        maximumAttempts: 3,
        nonRetryableErrorTypes: ["NonRetriableApplicationError"],
      },
      startToCloseTimeout: "1m",
    });

  // OB-08: saga state — track side effects that need compensation on failure.
  let createdAuthProfile: { keycloak_id: string } | null = null;

  try {
    // 00. Billing gate
    await checkTenantBillingStatus(args.tenantId);

    // 00a. Sanctions screening — block onboarding if name matches watchlist
    await screenSanctions({
      name: `${args.firstName} ${args.lastName}`,
      tenantId: args.tenantId,
      triggeredBy: "onboarding",
      screenType: "onboarding",
    });

    // 01a. Create Auth Profile
    const auth = await createAuthProfile({
      email: args.email,
      user_role: args.role || CustomerRole.USER,
      tenant_id: args.tenantId,
      keycloak_realm: args.keycloakRealm,
      keycloak_pub_key: args.keycloakPublicKey,
    });
    createdAuthProfile = { keycloak_id: auth.auth.keycloak_id };

    // 01b. Setup Password
    await setupPassword({
      keycloak_id: auth.auth.keycloak_id,
      password: args.password,
      confirm_password: args.password,
      tenant_id: args.tenantId,
      keycloak_realm: args.keycloakRealm,
      keycloak_pub_key: args.keycloakPublicKey,
    });

    // 02. Create Customer Profile
    await createUserProfile({
      first_name: args.firstName,
      last_name: args.lastName,
      email: args.email,
      phone: args.phone,
      uin: args.uin,
      keycloak_id: auth.auth.keycloak_id,
      tenant_id: args.tenantId,
      address: args.address,
      city: args.city,
      state: args.state,
      postal_code: args.postalCode,
    });

    // 03. Create Notification Profile & Send Password Update Email
    await sendEmail({
      createSubscriber: true,
      category: NotificationCategory.EMAIL,
      payload: {
        url: "",
      },
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

    // 04. Initialize Kyc with verification service
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
    await saveKycState(kyc.url, args.tenantId, auth.auth.keycloak_id);

    return kyc.url;
  } catch (e: any) {
    // OB-08: saga compensation — roll back the Keycloak/auth identity created
    // above so a retry (same deterministic workflow id) is not deadlocked by
    // auth-service's 409 email dedup. Best-effort: never masks the failure.
    if (createdAuthProfile) {
      await deleteAuthProfile({
        tenant_id: args.tenantId,
        keycloak_id: createdAuthProfile.keycloak_id,
        keycloak_realm: args.keycloakRealm,
      });
    }
    throw new ApplicationFailure(e.message);
  }
}
