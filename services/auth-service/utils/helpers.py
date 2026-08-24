import hashlib
import hmac
import ipaddress
import os
import secrets
import string
import logging

def _trusted_proxy_networks():
    """Parse TRUSTED_PROXY_CIDRS (comma-separated CIDRs) into networks.

    Empty/unset => no proxy is trusted: X-Forwarded-For is never honored.
    """
    raw = os.getenv("TRUSTED_PROXY_CIDRS", "")
    networks = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            networks.append(ipaddress.ip_network(part, strict=False))
        except ValueError:
            logging.getLogger(__name__).warning(
                "Ignoring invalid TRUSTED_PROXY_CIDRS entry: %r", part
            )
    return networks

def get_client_ip(request) -> str:
    """Resolve the client IP for security controls (login throttling, VPN
    detection, audit). Fail-closed against XFF spoofing (M-44):

    - default: the direct peer IP (request.client.host) is used;
    - X-Forwarded-For is honored ONLY when the direct peer falls inside
      TRUSTED_PROXY_CIDRS, in which case the leftmost untrusted entry is used.
    """
    peer = request.client.host if request.client else None
    if not peer:
        return None
    xff = request.headers.get("x-forwarded-for")
    if not xff:
        return peer
    try:
        peer_ip = ipaddress.ip_address(peer)
    except ValueError:
        return peer
    if not any(peer_ip in net for net in _trusted_proxy_networks()):
        # Peer is not a trusted proxy — ignore spoofable XFF entirely.
        return peer
    candidates = [p.strip() for p in xff.split(",") if p.strip()]
    if not candidates:
        return peer
    return candidates[0]

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
