import httpStatus from "http-status";
import { asyncHandler } from "../../middlewares/async";
import { resolveTenantId } from "../../middlewares/auth";
import { ApiError } from "../../middlewares/error";
import { accountService } from "../../services/accountService";
import { tenantService } from "../../services/tenantService";

// POST /customer/:id/pin — set the transaction PIN for a newly onboarded
// customer by delegating to account-service POST /account/setup-pin.
export const postCustomerPin = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req, res);
  const customerId = req.params.id;

  const pin = req.body?.pin;
  if (typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "pin must be a 4-6 digit string.");
  }

  const ledgerId = await tenantService.getLedgerId(tenantId);
  await accountService.setupPin(tenantId, customerId, ledgerId, pin);

  return res.status(httpStatus.OK).json({ success: true, message: "PIN set successfully." });
});
