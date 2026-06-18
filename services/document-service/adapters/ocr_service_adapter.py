from utils import ExternalAPIClient, get_config, create_logger

logger = create_logger(__name__)
config = get_config()


class OcrServiceAdapter(ExternalAPIClient):
    """OCR Service Adapter"""

    def __init__(self):
        super().__init__(
            base_url=config.OCR_SVC_URL,
            headers={}
        )

    def upload_document(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str,
        tenant_id: str,
        document_type: str | None = None
    ):
        """
        Forward upload to OCR service.
        This service queues processing, so request is lightweight.
        """

        try:
            files = {
                "file": (filename, file_bytes, content_type)
            }

            data = {}
            if document_type:
                data["document_type"] = document_type

            headers = {
                "x-tenant-id": tenant_id
            }

            logger.info(f"Forwarding document {filename} to OCR service")

            return self._post(
                endpoint="/api/v1/documents/upload",
                data=data,
                files=files,
                headers=headers
            )

        except Exception as e:
            logger.error(f"OCR service failed: {str(e)}")
            return None
