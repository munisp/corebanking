import { verificationService } from "../../services/verificationService";
import { IKybVerificationPayload, IKybVerificationResponse } from "../../types/verification";

export async function initializeKyb(payload: IKybVerificationPayload): Promise<IKybVerificationResponse> {
  return verificationService.initializeKybVerification(payload);
}
