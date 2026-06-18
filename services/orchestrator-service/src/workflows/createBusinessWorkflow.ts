import { ApplicationFailure, proxyActivities } from "@temporalio/workflow";
import * as activities from "../activities";
import { ICreateBusinessWorkflow } from "../types/workflows";
import {
  CustomerRole,
  NotificationCategory,
  NotificationType,
} from "../utils/enums";

export async function createBusinessWorkflow(
  args: ICreateBusinessWorkflow,
): Promise<string> {
  const {
    createAuthProfile,
    createUserProfile,
    createBusinessRecord,
    sendEmail,
    initializeKyb,
    saveKybState,
    setupPassword,
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

    // 00a. Sanctions screening — screen business name and director name
    await screenSanctions({
      name: args.businessName,
      tenantId: args.tenantId,
      triggeredBy: "business-onboarding",
      screenType: "onboarding",
    });
    await screenSanctions({
      name: `${args.firstName} ${args.lastName}`,
      tenantId: args.tenantId,
      triggeredBy: "business-onboarding",
      screenType: "onboarding",
    });

    // 01a. Create Auth Profile
    const auth = await createAuthProfile({
      email: args.email,
      user_role: CustomerRole.USER,
      tenant_id: args.tenantId,
      keycloak_realm: args.keycloakRealm,
      keycloak_pub_key: args.keycloakPublicKey,
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

    // 02. Create Business User Profile
    await createUserProfile({
      first_name: args.firstName,
      last_name: args.lastName,
      business_name: args.businessName,
      email: args.email,
      phone: args.phone,
      tin: args.tin,
      cac: args.cac,
      uin: args.uin,
      keycloak_id: auth.auth.keycloak_id,
      tenant_id: args.tenantId,
      address: args.address,
      city: args.city,
      state: args.state,
      postal_code: args.postalCode,
    });

    // 02b. Create Business record in business-service
    await createBusinessRecord({
      tenant_id:           args.tenantId,
      keycloak_id:         auth.auth.keycloak_id,
      name:                args.businessName,
      registration_number: args.cac,
      business_type:       "limited_company",
      phone_number:        args.phone,
      email_address:       args.email,
      headquarters_address: args.address,
      headquarters_location: [args.city, args.state].filter(Boolean).join(", "),
    });

    // 03. Send Welcome Email
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
        },
      },
    });

    // 04. Initialize KYB
    const kyb = await initializeKyb({
      business_name: args.businessName,
      cac: args.cac,
      tin: args.tin,
      tenant_id: args.tenantId,
      metadata: {
        keycloak_id:  auth.auth.keycloak_id,
        tenant_id:    args.tenantId,
        is_business:  true,
      },
    });

    // 05. Send KYB link email
    await sendEmail({
      createSubscriber: false,
      category: NotificationCategory.EMAIL,
      payload: {
        id: kyb.id,
        url: kyb.url,
      },
      subscriberId: `${args.tenantId}_${auth.auth.keycloak_id}`,
      type: NotificationType.BUSINESS_KYB_INIT,
      subscriber: {
        subscriberId: `${args.tenantId}_${auth.auth.keycloak_id}`,
        traits: {
          email: args.email,
          phone: args.phone,
        },
      },
    });

    // 06. Persist KYB URL
    await saveKybState(kyb.url, args.tenantId, auth.auth.keycloak_id);

    return kyb.url;
  } catch (e: any) {
    throw new ApplicationFailure(e.message);
  }
}
