import hashlib
import hmac
import secrets
import string
import logging

from utils import UserRole

def generate_api_key(length=16) -> str:
    characters = string.ascii_letters + string.digits
    api_key = ''.join(secrets.choice(characters) for _ in range(length))
    return api_key

def hash_api_secret(secret: str) -> str:
    """Hash an API secret for at-rest storage as '<salt_hex>$<sha256_hex>'.

    The plaintext secret is only ever returned once at creation time.
    """
    salt = secrets.token_hex(16)
    digest = hashlib.sha256((salt + secret).encode("utf-8")).hexdigest()
    return f"{salt}${digest}"

def verify_api_secret(secret: str, stored: str) -> bool:
    """Constant-time verification of a presented secret against a stored
    '<salt>$<sha256>' hash. Fails closed on malformed stored values."""
    if not secret or not stored:
        return False
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    candidate = hashlib.sha256((salt + secret).encode("utf-8")).hexdigest()
    return hmac.compare_digest(candidate, digest)

def create_logger(module: str):
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)

    logging.basicConfig(level=logging.INFO)
    return logging.getLogger(module)
