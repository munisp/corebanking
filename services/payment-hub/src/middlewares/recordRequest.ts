import { Request, Response, NextFunction } from "express";
import { PrometheusService } from "../services/prometheus";

const recordRequest = (req: Request, res: Response, next: NextFunction) => {
  res.on("finish", () => {
    // TS-47: use the matched route template (not the raw req.path, which embeds
    // entity IDs) so Prometheus label cardinality stays bounded.
    const routePath = typeof req.route?.path === "string" ? req.route.path : "unmatched";
    const template = `${req.baseUrl ?? ""}${routePath}` || "unmatched";
    PrometheusService.getInstance().recordRequest(req.method, template, res.statusCode);
  });
  next();
};

export default recordRequest;
