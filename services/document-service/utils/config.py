import os

from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base config"""

    DATABASE_URI = os.getenv("DATABASE_URI", "")
    ROOT_PATH = os.getenv("ROOT_PATH", "/")
    DAPR_PUBSUB_NAME = os.getenv("DAPR_PUBSUB_NAME", "")
    MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "")
    MINIO_ACCESS = os.getenv("MINIO_ACCESS", "")
    MINIO_SECRET = os.getenv("MINIO_SECRET", "")
    BUCKET_NAME = os.getenv("BUCKET_NAME", "")
    OCR_SVC_URL = os.getenv("OCR_SVC_URL", "")


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
