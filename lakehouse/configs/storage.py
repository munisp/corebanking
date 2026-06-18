"""54Bank — Lakehouse Storage Configuration
Supports local filesystem and S3-compatible object storage (MinIO, AWS S3).

Environment variables:
  LAKEHOUSE_STORAGE=local|s3          (default: local)
  LAKEHOUSE_ROOT=/path/to/data        (local mode)
  LAKEHOUSE_S3_ENDPOINT=http://minio:9000
  LAKEHOUSE_S3_BUCKET=54bank-lakehouse
  LAKEHOUSE_S3_ACCESS_KEY=...
  LAKEHOUSE_S3_SECRET_KEY=...
  LAKEHOUSE_S3_REGION=us-east-1
"""

import os
import logging
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger("54bank.lakehouse.config")


class StorageConfig:
    """Lakehouse storage configuration."""

    def __init__(self):
        self.mode = os.getenv("LAKEHOUSE_STORAGE", "local")  # local | s3
        self.local_root = Path(os.getenv(
            "LAKEHOUSE_ROOT",
            str(Path(__file__).parent.parent.parent / "lakehouse_data")
        ))
        self.s3_endpoint = os.getenv("LAKEHOUSE_S3_ENDPOINT", "")
        self.s3_bucket = os.getenv("LAKEHOUSE_S3_BUCKET", "54bank-lakehouse")
        self.s3_access_key = os.getenv("LAKEHOUSE_S3_ACCESS_KEY", "")
        self.s3_secret_key = os.getenv("LAKEHOUSE_S3_SECRET_KEY", "")
        self.s3_region = os.getenv("LAKEHOUSE_S3_REGION", "us-east-1")

    @property
    def is_s3(self) -> bool:
        return self.mode == "s3" and bool(self.s3_endpoint) and bool(self.s3_access_key)

    def storage_options(self) -> Dict[str, str]:
        if self.is_s3:
            return {
                "AWS_ENDPOINT_URL": self.s3_endpoint,
                "AWS_ACCESS_KEY_ID": self.s3_access_key,
                "AWS_SECRET_ACCESS_KEY": self.s3_secret_key,
                "AWS_REGION": self.s3_region,
                "AWS_ALLOW_HTTP": "true",
                "AWS_S3_ALLOW_UNSAFE_RENAME": "true",
            }
        return {}

    def table_uri(self, layer: str, table_name: str) -> str:
        if self.is_s3:
            return f"s3://{self.s3_bucket}/{layer}/{table_name}"
        return str(self.local_root / layer / table_name)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mode": self.mode,
            "local_root": str(self.local_root),
            "s3_endpoint": self.s3_endpoint,
            "s3_bucket": self.s3_bucket,
            "s3_region": self.s3_region,
            "is_s3": self.is_s3,
        }

    @staticmethod
    def minio_docker_compose() -> str:
        """Return a docker-compose snippet for MinIO."""
        return """
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

  createbuckets:
    image: minio/mc
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      sleep 5;
      /usr/bin/mc alias set myminio http://minio:9000 minioadmin minioadmin;
      /usr/bin/mc mb myminio/54bank-lakehouse;
      /usr/bin/mc policy set public myminio/54bank-lakehouse;
      exit 0;
      "
"""
