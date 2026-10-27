"""
SwasthyaScan AI — Auth Service
==============================
Handles:
  - Join-code generation (8-char, unambiguous alphabet)
  - Passcode hashing (pbkdf2_hmac + random salt, constant-time compare)
  - Session token generation (secrets.token_hex, store sha256 hash only)
  - Session validation
  - UUID generation

All secrets stay server-side. No secret is logged or returned to clients.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone

# Unambiguous alphabet: uppercase + digits, remove O/0/I/1 for clarity
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_CODE_LENGTH   = 8

# pbkdf2 parameters
_HASH_NAME    = "sha256"
_ITERATIONS   = 260_000   # OWASP 2023 recommendation
_DK_LEN       = 32


# ─── Join code ───────────────────────────────────────────────────────────────

def generate_join_code() -> str:
    """Generate an 8-character unambiguous join code."""
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))


def new_environment_id() -> str:
    return str(uuid.uuid4())


def new_submission_id() -> str:
    return str(uuid.uuid4())


# ─── Passcode ────────────────────────────────────────────────────────────────

def hash_passcode(passcode: str) -> tuple[str, str]:
    """
    Hash a passcode with a random salt using pbkdf2_hmac.
    Returns (hex_hash, hex_salt).
    """
    salt = secrets.token_bytes(32)
    dk   = hashlib.pbkdf2_hmac(_HASH_NAME, passcode.encode(), salt, _ITERATIONS, _DK_LEN)
    return dk.hex(), salt.hex()


def verify_passcode(passcode: str, stored_hash: str, stored_salt: str) -> bool:
    """Constant-time compare. Returns True if passcode matches."""
    salt = bytes.fromhex(stored_salt)
    dk   = hashlib.pbkdf2_hmac(_HASH_NAME, passcode.encode(), salt, _ITERATIONS, _DK_LEN)
    return hmac.compare_digest(dk.hex(), stored_hash)


# ─── Session token ───────────────────────────────────────────────────────────

def generate_session_token() -> tuple[str, str]:
    """
    Returns (raw_token, token_hash).
    raw_token → sent to client once, never stored.
    token_hash → stored in DB.
    """
    raw = secrets.token_hex(32)
    return raw, hashlib.sha256(raw.encode()).hexdigest()


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


# ─── Timestamps ──────────────────────────────────────────────────────────────

def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def utcnow_str() -> str:
    return utcnow().isoformat()


def expires_str(hours: float) -> str:
    return (utcnow() + timedelta(hours=hours)).isoformat()


def is_expired(iso_str: str) -> bool:
    try:
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return utcnow() > dt
    except (ValueError, TypeError):
        return True


# ─── Session DB helpers ──────────────────────────────────────────────────────

def create_session(
    con,
    token_hash: str,
    role: str,
    environment_id: str,
    submission_id: str | None,
    hours: float,
) -> None:
    con.execute(
        """INSERT INTO sessions (token_hash, role, environment_id, submission_id, expires_at)
           VALUES (?, ?, ?, ?, ?)""",
        (token_hash, role, environment_id, submission_id, expires_str(hours)),
    )


def get_session(con, token_hash: str) -> dict | None:
    row = con.execute(
        "SELECT * FROM sessions WHERE token_hash=?", (token_hash,)
    ).fetchone()
    if row is None:
        return None
    return dict(row)


def delete_expired_sessions(con) -> None:
    con.execute("DELETE FROM sessions WHERE expires_at < ?", (utcnow_str(),))
