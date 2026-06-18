import httpStatus from "http-status";
import { AppDataSource } from "../../database/dataSource";
import { KycVerificationWorkflowEntity } from "../../entity/KycVerificationWorkflowEntity";
import { asyncHandler } from "../../middlewares/async";
import { ApiError } from "../../middlewares/error";
import { KycCountryDocumentMap } from "../../utils/enums";
import { validateRequest } from "../../validations";
import { PostVerifyDocumentSchema } from "../../validations/schemas";

const NAME_FIELDS = ["name", "surname", "given_names", "full_name", "first_name", "last_name"];
const ID_FIELDS = ["id_number", "passport_number", "document_number", "license_number", "nin", "uin"];

function fieldPresent(fields: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const val = fields[key];
    if (val && typeof val === "string" && val.trim().length > 0) return key;
  }
  return null;
}

export const postVerifyDocument = asyncHandler(async (req, res) => {
  const payload = validateRequest(PostVerifyDocumentSchema, req.body);

  const session = await AppDataSource.manager.findOne(KycVerificationWorkflowEntity, {
    where: { id: payload.verificationId },
  });

  if (!session) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Invalid or expired verification session.",
      "VER-400-01",
      "verification-service",
    );
  }

  const countryConfig = KycCountryDocumentMap[payload.document.country];
  if (!countryConfig) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Country '${payload.document.country}' is not supported for document verification.`,
      "VER-400-02",
      "verification-service",
    );
  }

  const docConfig = countryConfig.documents[payload.document.type];
  if (!docConfig) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Document type '${payload.document.type}' is not valid for ${countryConfig.countryName}.`,
      "VER-400-03",
      "verification-service",
    );
  }

  const { extractedFields } = payload.document;

  const nameField = fieldPresent(extractedFields, NAME_FIELDS);
  const idField = fieldPresent(extractedFields, ID_FIELDS);
  const dobPresent = !!extractedFields["date_of_birth"] || !!extractedFields["dob"];

  const checks = {
    sessionValid: true,
    country: payload.document.country,
    documentLabel: docConfig.label,
    nameExtracted: !!nameField,
    idNumberExtracted: !!idField,
    dobExtracted: dobPresent,
    extractedFieldCount: Object.keys(extractedFields).length,
  };

  if (!nameField) {
    return res.status(httpStatus.UNPROCESSABLE_ENTITY).json({
      success: false,
      documentType: payload.document.type,
      checks,
      extractedFields,
      message:
        "Could not extract a name from the document. Please ensure the document is clear and try again.",
    });
  }

  if (!idField) {
    return res.status(httpStatus.UNPROCESSABLE_ENTITY).json({
      success: false,
      documentType: payload.document.type,
      checks,
      extractedFields,
      message:
        "Could not extract the document number. Please ensure the document is clear and try again.",
    });
  }

  return res.status(httpStatus.OK).json({
    success: true,
    documentType: payload.document.type,
    checks,
    extractedFields,
    message: "Document verified successfully. You may proceed to facial verification.",
  });
});
