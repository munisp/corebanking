"""Shared authentication helpers for 54link-dev services."""

from .jwt_validation import validate_jwt

__all__ = ["validate_jwt"]
