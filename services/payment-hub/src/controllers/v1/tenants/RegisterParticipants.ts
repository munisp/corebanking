import fs from "fs";
import path from "path";
import logger from "../../../config/logger.config";
import { MojaloopConnectorApiClient } from "../../../lib/MojaloopConnectorApiClient";
import { asyncHandler } from "../../../middlewares/async";
import { tenantRepository } from "../../../repositories/tenantRepo";
import { CurrencyEnum, PartyIdTypeEnum } from "../../../utils/enums";

// TS-51: tenants.json is static per deployment — load and parse it once
// instead of a blocking readFileSync + JSON.parse on every body-less request.
let cachedDefaultTenants: Array<{ name: string; dfsp_id: string }> | null = null;
function loadDefaultTenants(): Array<{ name: string; dfsp_id: string }> {
  if (!cachedDefaultTenants) {
    const tenantsPath = path.resolve(
      process.cwd(),
      "services/payment-hub/tenants.json",
    );
    const content = fs.readFileSync(tenantsPath, "utf8");
    cachedDefaultTenants = JSON.parse(content) as Array<{ name: string; dfsp_id: string }>;
  }
  return cachedDefaultTenants;
}

export const register_participants = asyncHandler(async (req, res) => {
  let tenants: Array<{ name: string; dfsp_id: string }> | undefined =
    req.body?.tenants;

  if (!tenants) {
    tenants = loadDefaultTenants();
  }

  // TS-52: register tenants concurrently — iterations are independent (one
  // Mojaloop oracle call + tenant upsert per tenant). Promise.all preserves
  // input ordering in the results array.
  const results: Array<any> = await Promise.all(
    tenants.map(async (t) => {
      try {
        const input = {
          tenant_name: t.name,
          identifier: t.dfsp_id,
          identifier_type: PartyIdTypeEnum.ACCOUNT_ID,
          currency: CurrencyEnum.NGN,
        };

        await MojaloopConnectorApiClient.getInstance().register_participant(
          input,
        );

        // persist tenant if not exists
        const existing = await tenantRepository.getByName(t.name);
        if (!existing) {
          // saveEntity accepts a plain object for now
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tenant = tenantRepository.create({
            name: t.name,
            dfsp_id: t.dfsp_id,
          });
          await tenantRepository.saveEntity(tenant);
        }

        return { tenant: t.name, status: "registered" };
      } catch (error) {
        logger.error("error registering tenant", error);
        return { tenant: t.name, status: "error", error: String(error) };
      }
    }),
  );

  return res.json({ results });
});

export default register_participants;
