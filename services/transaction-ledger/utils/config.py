import os
from decimal import Decimal

from dotenv import load_dotenv

load_dotenv()

# Maximum accepted transaction amount (major units, e.g. Naira). Enforced at
# the schema boundary and again in the repository before any GL posting.
# Default: 1 billion Naira; override via MAX_TRANSACTION_AMOUNT_NAIRA.
MAX_TRANSACTION_AMOUNT_NAIRA = Decimal(
    os.getenv("MAX_TRANSACTION_AMOUNT_NAIRA", "1000000000.00")
)

class Config:
    """Base config"""

    DATABASE_URI = os.getenv("DATABASE_URI", "")
    ROOT_PATH = os.getenv("ROOT_PATH", "")
    DAPR_PUBSUB_NAME = os.getenv("DAPR_PUBSUB_NAME", "")
    ACCOUNT_SVC_URL = os.getenv("ACCOUNT_SVC_URL", "")


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
