import os

from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base config"""

    DATABASE_URI = os.getenv("DATABASE_URI", "")
    ROOT_PATH = os.getenv("ROOT_PATH", "")
    DAPR_PUBSUB_NAME = os.getenv("DAPR_PUBSUB_NAME", "")
    ACCOUNT_SVC_URL = os.getenv("ACCOUNT_SVC_URL", "")
    # AU-01: shared secret authorizing service-to-service audit ingestion
    # (X-Audit-Ingest-Token header). Empty disables the header path (fail-closed).
    AUDIT_INGEST_TOKEN = os.getenv("AUDIT_INGEST_TOKEN", "")
    # CP-07: HMAC key for signed regulator export bundles. Empty = export
    # endpoint fails fast with 503.
    AUDIT_EXPORT_SECRET = os.getenv("AUDIT_EXPORT_SECRET", "")
    # PL-10: retention/archival policy for scripts/archive_audit.py.
    AUDIT_RETENTION_MONTHS = int(os.getenv("AUDIT_RETENTION_MONTHS", "84"))
    AUDIT_ARCHIVE_S3_BUCKET = os.getenv("AUDIT_ARCHIVE_S3_BUCKET", "")
    AUDIT_ARCHIVE_LOCAL_DIR = os.getenv("AUDIT_ARCHIVE_LOCAL_DIR", "/var/backups/audit")


class DevelopmentConfig(Config):
    """Development specific config"""

    DEBUG = True


class ProductionConfig(Config):
    """Production specific config"""

    DEBUG = False


config = {"development": DevelopmentConfig, "production": ProductionConfig}

config_name = os.getenv("FLASK_ENV", "development")

def get_config() -> Config:
    config_data = config.get(config_name)

    if config_data is None:
        raise Exception("Config {} not found".format(config_name))
    
    return config_data
