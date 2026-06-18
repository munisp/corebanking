import { Router } from "express";
import { asyncHandler } from "../../middlewares/async";
import { AppDataSource } from "../../database/dataSource";
import httpStatus from "http-status";

const router = Router();

router.get("/v1/events", asyncHandler(async (req, res) => {
  try {
    const rows = await AppDataSource.query(
      `SELECT id, tenant_id, source_service, event_type, meter_key, product_key, quantity, unit_amount, processing_status, created_at
       FROM billing_event_processor.metering_events
       ORDER BY created_at DESC LIMIT 100`,
    );
    return res.status(httpStatus.OK).json({ items: rows, total: rows.length });
  } catch {
    return res.status(httpStatus.OK).json({ items: [], total: 0 });
  }
}));

export default router;
