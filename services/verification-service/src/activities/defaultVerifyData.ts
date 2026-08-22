import * as z from "zod";
import { PostInitializeKycVerificationValidationSchema } from "../validations/schemas";
import { IVerifyFaceResult } from "../types/verification";
import logger from "../config/logger.config";
import { maskIdentifier } from "../utils/piiMask";

/**
 * Compare the data submitted by the client with the data returned after verification.
 * @param clientUser The user details submitted by the client requesting verification
 * @param user The user data returned from the verification activity
 * @returns
 */
export async function defaultVerifyData(
  clientUser: z.infer<typeof PostInitializeKycVerificationValidationSchema>["user"],
  user: IVerifyFaceResult["ninData"]
) {
  logger.info(`[defaultVerifyData] comparing client vs extracted:`);
  logger.info(`[defaultVerifyData]   firstName : "${clientUser.firstName}" vs "${user.firstName}"`);
  logger.info(`[defaultVerifyData]   lastName  : "${clientUser.lastName}" vs "${user.lastName}"`);
  // M-52: never log full NIN/UIN — masked (last 3 chars only).
  logger.info(`[defaultVerifyData]   UIN       : "${maskIdentifier(clientUser.UIN)}" vs "${maskIdentifier(user.nin)}"`);
  logger.info(`[defaultVerifyData]   phone     : "${clientUser.phone}" vs "${user.phone}"`);
  logger.info(`[defaultVerifyData]   dateOfBirth: "${clientUser.dateOfBirth ?? ""}" vs "${user.dateOfBirth}"`);

  const result = {
    firstName:   clientUser.firstName.toLocaleLowerCase()   == user.firstName.toLocaleLowerCase(),
    lastName:    clientUser.lastName.toLocaleLowerCase()    == user.lastName.toLocaleLowerCase(),
    dateOfBirth: clientUser.dateOfBirth
      ? clientUser.dateOfBirth.toLocaleLowerCase() == user.dateOfBirth.toLocaleLowerCase()
      : false,
    phone: clientUser.phone.toLocaleLowerCase() == user.phone.toLocaleLowerCase(),
    UIN:   clientUser.UIN.toLocaleLowerCase()   == user.nin.toLocaleLowerCase(),
  };

  logger.info(`[defaultVerifyData] result: ${JSON.stringify(result)}`);
  return result;
}
