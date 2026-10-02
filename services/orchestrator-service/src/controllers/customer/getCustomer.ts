import httpStatus from "http-status";
import { asyncHandler } from "../../middlewares/async";
import { resolveTenantId } from "../../middlewares/auth";
import { userService } from "../../services/userService";

// GET /customer/:id — fetch the customer profile from user-service
// (id is the customer's keycloak id, as issued by the onboarding workflow).
export const getCustomer = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req, res);
  const customerId = req.params.id;

  const user = await userService.getUser(tenantId, customerId);

  return res.status(httpStatus.OK).json({ success: true, data: user });
});
