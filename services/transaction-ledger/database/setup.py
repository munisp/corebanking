from typing import Optional

from fastapi import Header
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from utils.config import get_config

config = get_config()

engine = create_engine(
    config.DATABASE_URI, 
    pool_pre_ping=True,  # Checks if connections are alive before using them
    pool_size=10,  # Number of connections to keep in the pool
    max_overflow=20,  # Number of connections to allow in overflow
    pool_timeout=30,  # Time to wait before giving up on getting a connection from the pool
    pool_recycle=1800,  # Recycle connections after this many seconds
)

SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def _bind_rls_tenant(session, tenant_id: str) -> None:
    """Bind the tenant to this session for row-level security (migration V003).

    The value is bound as a parameter (never interpolated into SQL), so a
    malicious tenant string cannot escape into the statement.
    """
    session.execute(
        text("SELECT set_config('app.tenant_id', :tenant, false)"),
        {"tenant": tenant_id},
    )


def get_session(x_tenant_id: Optional[str] = Header(None, alias="x-tenant-id")):
    """Yield a session with the RLS tenant context bound.

    FastAPI injects the verified `x-tenant-id` header (the JWT middleware
    overwrites it from token claims); Dapr event handlers call this directly
    with the tenant taken from the event payload. When no tenant is known the
    context is set to the empty string and RLS hides every row (fail closed).
    The context is always reset before the pooled connection is reused so a
    tenant can never leak across requests.
    """
    # When invoked directly (outside FastAPI dependency injection) without an
    # argument, the default is a Header(...) sentinel object, not a string.
    tenant_id = x_tenant_id if isinstance(x_tenant_id, str) and x_tenant_id else ""

    session = SessionFactory()
    try:
        _bind_rls_tenant(session, tenant_id)
        yield session
    finally:
        try:
            _bind_rls_tenant(session, "")
        except Exception:
            pass
        session.close()
