import { Request } from "express";

export interface AuthRequest extends Request {
  tenantId?: string;
  actorId?: string;
  actorRole?: string;
}
