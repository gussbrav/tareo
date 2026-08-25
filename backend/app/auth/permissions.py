"""Servicio de permisos configurable — reemplaza los role gates hardcodeados.

La matriz vive en `auth.role_permissions` (rol × permission_key → allowed).
Se cachea en memoria por 60s para evitar hits a DB en cada request. El cache
se invalida cuando alguien edita la matriz via /api/admin/permissions.
"""
from __future__ import annotations

import time
from threading import RLock
from typing import Dict, Set

from fastapi import Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.auth.schemas import UserPublic
from app.database import get_db

_TTL_SECONDS = 60
_lock = RLock()
_cache: Dict[str, Set[str]] = {}
_cache_at: float = 0.0


def _load_matrix() -> Dict[str, Set[str]]:
    """Lee toda la matriz de la DB y arma dict{role: set(permission_keys allowed)}."""
    with get_db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT role, permission_key
              FROM auth.role_permissions
             WHERE allowed = true;
            """
        )
        result: Dict[str, Set[str]] = {}
        for row in cur.fetchall():
            result.setdefault(row["role"], set()).add(row["permission_key"])
        return result


def _get_matrix() -> Dict[str, Set[str]]:
    global _cache, _cache_at
    with _lock:
        if not _cache or (time.monotonic() - _cache_at) > _TTL_SECONDS:
            _cache = _load_matrix()
            _cache_at = time.monotonic()
        return _cache


def invalidate_cache() -> None:
    """Llamar cuando la matriz cambia (POST /api/admin/permissions)."""
    global _cache, _cache_at
    with _lock:
        _cache = {}
        _cache_at = 0.0


def has_permission(role: str, permission_key: str) -> bool:
    matrix = _get_matrix()
    return permission_key in matrix.get(role, set())


def require_permission(permission_key: str):
    """Dependency factory FastAPI. Exige que el rol del usuario tenga la capability."""

    def _guard(user: UserPublic = Depends(get_current_user)) -> UserPublic:
        if not has_permission(user.role, permission_key):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Tu rol no tiene el permiso requerido: {permission_key}",
            )
        return user

    return _guard
