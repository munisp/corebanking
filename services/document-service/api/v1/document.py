from fastapi import APIRouter, UploadFile, File, HTTPException, Header
from services import S3Service
from utils import get_config, create_logger
from adapters import OcrServiceAdapter
import io


document_router = APIRouter()
config = get_config()
ocr_service = OcrServiceAdapter()
logger = create_logger(__name__)

OCRABLE_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

IMAGE_PREFIX = "image/"

s3_service = S3Service(
    endpoint=config.MINIO_ENDPOINT,
    access_key=config.MINIO_ACCESS,
    secret_key=config.MINIO_SECRET,
    secure=False,
)


@document_router.post("/upload")
async def upload(
    document_type: str = "unknown",
    file: UploadFile = File(...),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """
    Accepts any media type upload and stores in MinIO.
    Returns object identifier.
    """

    try:
        # Read file ONCE
        content = await file.read()
        size = len(content)

        # upload to minio (BytesIO because put_object expects stream)
        s3_object_id = s3_service.upload_file(
            bucket_name=config.BUCKET_NAME,
            file_obj=io.BytesIO(content),
            length=size,
            tenant_id=tenant_id,
            content_type=file.content_type
        )

        # ======== OCR Handling (Non-Blocking) =========
        is_ocrable = file.content_type and (
            file.content_type in OCRABLE_MIME_TYPES
            or file.content_type.startswith(IMAGE_PREFIX)
        )

        if file.content_type and file.filename and is_ocrable:
            try:
                ocr_response = ocr_service.upload_document(
                    file_bytes=content,
                    filename=file.filename,
                    content_type=file.content_type,
                    tenant_id=tenant_id,
                    document_type=document_type
                )
            except Exception as e:
                logger.error(f"OCR dispatch failed but upload succeeds: {str(e)}")

            return {
                "url": f"{config.MINIO_ENDPOINT}/{config.BUCKET_NAME}/{s3_object_id}",
                "id": s3_object_id,
                "filename": file.filename,
                "content_type": file.content_type,
                "ocr": ocr_response if 'ocr_response' in locals() else None
            }

    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))
