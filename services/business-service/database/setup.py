"""Database setup and session management."""
from typing import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool

from utils.config import get_settings

settings = get_settings()

# Create database engine
engine = create_engine(
    settings.DATABASE_URI,
    poolclass=QueuePool,
    pool_pre_ping=True,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_timeout=settings.DATABASE_POOL_TIMEOUT,
    pool_recycle=settings.DATABASE_POOL_RECYCLE,
    echo=settings.DEBUG,
)

# Create session factory
SessionFactory = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_session() -> Generator[Session, None, None]:
    """Get database session for dependency injection."""
    session = SessionFactory()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db():
    """Initialize database (create tables)."""
    from models import Base
    Base.metadata.create_all(bind=engine)
