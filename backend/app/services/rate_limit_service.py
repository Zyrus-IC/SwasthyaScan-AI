"""
SwasthyaScan AI — Rate Limiting Service
=========================================
Per-IP and per-code rate limiting for join-code attempts.
Max 5 attempts per 15 minutes; lockout for 15 minutes after.
All counts stored in the rate_limit table (SQLite).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from app.db.database import get_con
from app.services.auth_service import utcnow, utcnow_str

logger = logging.getLogger(__name__)

MAX_ATTEMPTS      = 5
WINDOW_MINUTES    = 15
LOCKOUT_MINUTES   = 15


def _key_ip(ip: str) -> str:
    return f"ip:{ip}"

def _key_code(code: str) -> str:
    return f"code:{code.upper()}"


def check_rate_limit(ip: str, code: str) -> tuple[bool, str]:
    """
    Returns (allowed: bool, error_message: str).
    If allowed, call record_attempt() after the attempt.
    """
    now = utcnow()
    now_str = now.isoformat()
    with get_con() as con:
        for key in (_key_ip(ip), _key_code(code)):
            row = con.execute(
                "SELECT attempts, locked_until FROM rate_limit WHERE key=?", (key,)
            ).fetchone()
            if row is None:
                continue
            locked_until = row["locked_until"]
            if locked_until:
                lu = datetime.fromisoformat(locked_until).replace(tzinfo=timezone.utc)
                if now < lu:
                    remaining = int((lu - now).total_seconds() / 60) + 1
                    return False, (
                        f"Too many failed attempts. Please wait {remaining} minute(s) before trying again."
                    )
                # Lock expired — reset
                con.execute(
                    "UPDATE rate_limit SET attempts=0, locked_until=NULL WHERE key=?", (key,)
                )
    return True, ""


def record_attempt(ip: str, code: str, success: bool) -> None:
    """Record a join attempt. Lock out if MAX_ATTEMPTS exceeded."""
    if success:
        # Clear on success
        with get_con() as con:
            for key in (_key_ip(ip), _key_code(code)):
                con.execute("DELETE FROM rate_limit WHERE key=?", (key,))
        return

    lockout_time = (utcnow() + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
    with get_con() as con:
        for key in (_key_ip(ip), _key_code(code)):
            row = con.execute(
                "SELECT attempts FROM rate_limit WHERE key=?", (key,)
            ).fetchone()
            if row is None:
                con.execute(
                    "INSERT INTO rate_limit (key, attempts, locked_until) VALUES (?,1,NULL)",
                    (key,),
                )
                new_attempts = 1
            else:
                new_attempts = row["attempts"] + 1
                con.execute(
                    "UPDATE rate_limit SET attempts=? WHERE key=?", (new_attempts, key)
                )
            if new_attempts >= MAX_ATTEMPTS:
                con.execute(
                    "UPDATE rate_limit SET locked_until=? WHERE key=?", (lockout_time, key)
                )
                logger.warning("Rate limit lockout applied: key=%s after %d attempts.", key, new_attempts)
