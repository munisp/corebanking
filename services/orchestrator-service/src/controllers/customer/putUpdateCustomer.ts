import httpStatus from "http-status";
import { asyncHandler } from "../../middlewares/async";
import { resolveTenantId } from "../../middlewares/auth";
import { ApiError } from "../../middlewares/error";
import { userService } from "../../services/userService";

const ALLOWED_FIELDS = new Set([
  "first_name",
  "last_name",
  "phone_number",
  "address",
  "city",
  "state",
  "country",
]);

// PUT /customer/:id — update the customer profile in user-service.
export const putUpdateCustomer = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req, res);
  const customerId = req.params.id;

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(req.body ?? {})) {
    if (ALLOWED_FIELDS.has(key) && value !== undefined) payload[key] = value;
  }
  if (Object.keys(payload).length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No updatable fields supplied.");
  }

  // user-service updates by its internal user id — resolve it first.
  const user = (await userService.getUser(tenantId, customerId)) as { id?: string };
  if (!user?.id) {
    throw new ApiError(httpStatus.NOT_FOUND, "Customer not found.");
  }

  const updated = await userService.updateUserById(tenantId, customerId, user.id, payload);

  return res.status(httpStatus.OK).json({
    success: true,
    message: "Customer updated successfully",
    data: updated,
  });
});
