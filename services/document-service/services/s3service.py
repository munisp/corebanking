from minio import Minio
from minio.error import S3Error
from typing import Optional
from urllib.parse import urlparse
import uuid


class S3Service:
    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        secure: bool = False,
    ):
        parsed = urlparse(endpoint)
        if parsed.scheme in ("http", "https"):
            minio_endpoint = parsed.netloc
            secure = parsed.scheme == "https"
        else:
            minio_endpoint = endpoint

        self.client = Minio(
            endpoint=minio_endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
        )

    def ensure_bucket(self, bucket_name: str):
        exists = self.client.bucket_exists(bucket_name)
        if not exists:
            self.client.make_bucket(bucket_name)

    def upload_file(
        self,
        bucket_name: str,
        file_obj,
        length: int,
        tenant_id: str,
        content_type: Optional[str] = None,
        object_name: Optional[str] = None
    ) -> str:
        """
        Upload file to MinIO and return object identifier
        """
        self.ensure_bucket(bucket_name)

        if not object_name:
            object_name = tenant_id + "/" + str(uuid.uuid4())

        self.client.put_object(
            bucket_name=bucket_name,
            object_name=object_name,
            data=file_obj,
            length=length,
            content_type=content_type
        )

        return object_name
