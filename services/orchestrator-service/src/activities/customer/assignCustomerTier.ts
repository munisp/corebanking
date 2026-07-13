import { userService } from "../../services/userService";
import { bvnNinService } from "../../services/bvnNinService";

export async function assignCustomerTier(
  tenant_id: string,
  keycloak_id: string,
  face_verified: boolean,
): Promise<void> {
  try {
    const user = await userService.getUser(tenant_id, keycloak_id);
    const nin = user.uin;

    if (!nin) {
      await userService.assignTier(tenant_id, keycloak_id, 1);
      return;
    }

    // Verify NIN — the NIN record carries the linked BVN and residential address.
    const ninResult = await bvnNinService.verifyNIN(nin, tenant_id, keycloak_id);
    if (!ninResult.verified || !ninResult.linkedBVN) {
      await userService.assignTier(tenant_id, keycloak_id, 1);
      return;
    }

    // Verify BVN using the linked BVN from the NIN record.
    const bvnResult = await bvnNinService.verifyBVN(ninResult.linkedBVN, tenant_id, keycloak_id);
    if (!bvnResult.verified) {
      await userService.assignTier(tenant_id, keycloak_id, 1);
      return;
    }

    // Cross-check BVN ↔ NIN linkage (name, DOB, gender consistency).
    const linkage = await bvnNinService.checkLinkage(ninResult.linkedBVN, nin, tenant_id, keycloak_id);
    const bvnNinLinked = linkage.linkageStatus === "verified";

    if (!bvnNinLinked) {
      await userService.assignTier(tenant_id, keycloak_id, 1);
      return;
    }

    // Tier 3: BVN + NIN linked, face verification passed, residential address present.
    const addressVerified = !!ninResult.residentialAddress;
    const tier = face_verified && addressVerified ? 3 : 2;

    await userService.assignTier(tenant_id, keycloak_id, tier);
  } catch {
    // Non-retryable path: if the BVN/NIN service is unavailable, default to Tier 1.
    await userService.assignTier(tenant_id, keycloak_id, 1);
  }
}
