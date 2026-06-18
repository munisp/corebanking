import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Config:
    KAFKA_BOOTSTRAP_SERVERS: str = field(default_factory=lambda: os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"))
    KAFKA_SECURITY_PROTOCOL: str = field(default_factory=lambda: os.getenv("KAFKA_SECURITY_PROTOCOL", "PLAINTEXT"))
    KAFKA_SASL_MECHANISM: Optional[str] = field(default_factory=lambda: os.getenv("KAFKA_SASL_MECHANISM", ""))
    KAFKA_SASL_USERNAME: Optional[str] = field(default_factory=lambda: os.getenv("KAFKA_SASL_USERNAME", ""))
    KAFKA_SASL_PASSWORD: Optional[str] = field(default_factory=lambda: os.getenv("KAFKA_SASL_PASSWORD", ""))


def get_config() -> Config:
    return Config()
