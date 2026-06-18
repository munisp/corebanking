import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    KAFKA_SECURITY_PROTOCOL = os.getenv("KAFKA_SECURITY_PROTOCOL", "PLAINTEXT")
    KAFKA_SASL_MECHANISM = os.getenv("KAFKA_SASL_MECHANISM", "")
    KAFKA_SASL_USERNAME = os.getenv("KAFKA_SASL_USERNAME", "")
    KAFKA_SASL_PASSWORD = os.getenv("KAFKA_SASL_PASSWORD", "")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


_configs = {"development": DevelopmentConfig, "production": ProductionConfig}

_config_name = os.getenv("FLASK_ENV", "development")


def get_config() -> Config:
    config_data = _configs.get(_config_name)
    if config_data is None:
        raise Exception("Config {} not found".format(_config_name))
    return config_data
