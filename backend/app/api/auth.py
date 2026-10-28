"""
SwasthyaScan AI — Authentication & Security Gateway
===================================================
Endpoints:
  POST /api/auth/send-otp        — Generate & dispatch rate-limited 6-digit OTP (Gmail)
  POST /api/auth/verify-otp      — Constant-time verification & persistent session issuance
  POST /api/auth/set-profile     — Set username and optional password
  POST /api/auth/login-password  — Sign in directly with Username/Email + Password
  GET  /api/auth/me              — Validate current session & fetch profile
  POST /api/auth/logout          — Invalidate current session

Security Guardrails:
  - Strict input sanitization (RFC email validation, rejects XSS/SQLi)
  - Rate limiting (max 5 requests per 10 min per identifier/IP)
  - Max 3 verification attempts before lockout
  - 5-minute cryptographic OTP expiration
  - Cryptographically secure 256-bit session tokens (secrets.token_urlsafe)
  - Timing-attack safe comparisons (hmac.compare_digest)
  - Persistent SQLite user store with unique username & email indexing
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import re
import secrets
import socket
import time
from collections import defaultdict
from typing import Literal, Optional

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from app.db.database import get_con

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)

# ── Security Constants ────────────────────────────────────────────────────────

OTP_LIFETIME_SECONDS = 300      # 5 minutes
MAX_OTP_ATTEMPTS     = 3        # Max failed attempts per OTP
RATE_LIMIT_MAX_REQ   = 5        # Max OTP requests
RATE_LIMIT_WINDOW_S  = 600      # Per 10 minutes
SESSION_LIFETIME_S   = 7 * 86400  # 7 days

# ── In-Memory Security Storage ────────────────────────────────────────────────

# identifier -> { "hash": str, "salt": str, "expires_at": float, "attempts_left": int, "plain_preview": str, "type": str }
_otp_store: dict[str, dict] = {}

# In-memory cache for fast session checks
_session_store: dict[str, dict] = {}

# ip_or_ident -> [timestamp, ...]
_rate_limits: dict[str, list[float]] = defaultdict(list)

# ── Validation Regexes ────────────────────────────────────────────────────────

PHONE_REGEX = re.compile(r"^[6-9]\d{9}$")
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$")
USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9_]{3,24}$")
DANGEROUS_CHARS = re.compile(r"[<>'\"`;\\]")

TYPO_DOMAINS = {
    "gmai.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "yaho.com": "yahoo.com",
    "hotmial.com": "hotmail.com",
    "outlok.com": "outlook.com",
}
VOWEL_OR_DIGIT_PATTERN = re.compile(r"[aeiou0123456789]")
CONSONANT_MASH_PATTERN = re.compile(r"[bcdfghjklmnpqrstvwxyz]{7,}")


def _sanitize(val: str) -> str:
    cleaned = DANGEROUS_CHARS.sub("", val).strip()
    return cleaned


def _validate_email_address(email: str) -> str:
    cleaned = _sanitize(email.strip().lower())
    if not EMAIL_REGEX.match(cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid email address (e.g., yourname@gmail.com).",
        )
    parts = cleaned.split("@")
    if len(parts) != 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email format.")

    username, domain = parts[0], parts[1]
    if len(username) < 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email username is too short.")

    if domain in TYPO_DOMAINS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Did you mean @{TYPO_DOMAINS[domain]}? Please check your email address.",
        )

    # Detect random keyboard mash / fake emails like cjhghcgcghc
    if len(username) >= 6 and not VOWEL_OR_DIGIT_PATTERN.search(username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email address appears to be invalid or mistyped. Please enter your real email.",
        )
    if CONSONANT_MASH_PATTERN.search(username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email username pattern. Please enter a valid, active email address.",
        )

    # Verify domain exists in DNS
    try:
        socket.gethostbyname(domain)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The email domain '@{domain}' could not be reached. Please check the spelling.",
        )
    return cleaned


def _hash_otp(code: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{code}".encode("utf-8")).hexdigest()


def _hash_password(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()


def _check_rate_limit(key: str) -> None:
    now = time.monotonic()
    window_start = now - RATE_LIMIT_WINDOW_S
    # Purge old records
    _rate_limits[key] = [t for t in _rate_limits[key] if t > window_start]
    if len(_rate_limits[key]) >= RATE_LIMIT_MAX_REQ:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication requests. For security, please wait a few minutes before trying again.",
        )
    _rate_limits[key].append(now)


# ── Request / Response Schemas ────────────────────────────────────────────────

class SendOtpRequest(BaseModel):
    type: Literal["phone", "email"] = "email"
    identifier: str = Field(..., min_length=3, max_length=100)

    @field_validator("identifier")
    @classmethod
    def validate_identifier(cls, v: str, info) -> str:
        cleaned = _sanitize(v)
        if not cleaned:
            raise ValueError("Identifier cannot be empty or contain invalid characters.")
        return cleaned


class VerifyOtpRequest(BaseModel):
    type: Literal["phone", "email"] = "email"
    identifier: str = Field(..., min_length=3, max_length=100)
    code: str = Field(..., min_length=6, max_length=6)

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        s = v.strip()
        if not s.isdigit() or len(s) != 6:
            raise ValueError("Verification code must be exactly 6 digits.")
        return s


class SetProfileRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=24)
    password: Optional[str] = Field(None, min_length=6, max_length=64)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        cleaned = _sanitize(v).strip().lower()
        if not USERNAME_REGEX.match(cleaned):
            raise ValueError("Username must be 3-24 characters and contain only letters, numbers, and underscores.")
        return cleaned


class LoginPasswordRequest(BaseModel):
    username_or_email: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=1, max_length=100)

    @field_validator("username_or_email")
    @classmethod
    def validate_ident(cls, v: str) -> str:
        cleaned = _sanitize(v).strip().lower()
        if not cleaned:
            raise ValueError("Please enter your username or email address.")
        return cleaned


class UserProfile(BaseModel):
    id: str
    identifier: str
    email: str
    username: Optional[str] = None
    type: str = "email"
    maskedIdentifier: str
    createdAt: str
    needsUsername: bool = False


class AuthResponse(BaseModel):
    status: str
    message: str
    token: Optional[str] = None
    user: Optional[UserProfile] = None
    dev_otp: Optional[str] = None
    expires_in: Optional[int] = None
    needs_username: Optional[bool] = None


# ── Helper to mask identifier for privacy ──────────────────────────────────────

def _mask_identifier(ident: str, ident_type: str = "email") -> str:
    if ident_type == "phone":
        return f"+91 {ident[:2]}••••••{ident[-2:]}"
    if "@" in ident:
        parts = ident.split("@")
        name = parts[0]
        domain = parts[1]
        masked_name = name[0] + "•••" + (name[-1] if len(name) > 1 else "")
        return f"{masked_name}@{domain}"
    return ident


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/send-otp", response_model=AuthResponse)
async def send_otp(req: SendOtpRequest, http_request: Request) -> AuthResponse:
    client_ip = (
        http_request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or (http_request.client.host if http_request.client else "unknown")
    )

    if req.type == "phone":
        digits = re.sub(r"\D", "", req.identifier)
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]
        elif digits.startswith("0") and len(digits) == 11:
            digits = digits[1:]
        if not PHONE_REGEX.match(digits):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please enter a valid 10-digit Indian mobile number (e.g., 9876543210).",
            )
        identifier = digits
    else:
        identifier = _validate_email_address(req.identifier)

    # Rate limiting
    _check_rate_limit(f"{client_ip}:{identifier}")

    # Cryptographically secure 6-digit OTP
    code = f"{secrets.randbelow(900000) + 100000:06d}"
    salt = secrets.token_hex(16)
    code_hash = _hash_otp(code, salt)

    _otp_store[identifier] = {
        "hash": code_hash,
        "salt": salt,
        "expires_at": time.time() + OTP_LIFETIME_SECONDS,
        "attempts_left": MAX_OTP_ATTEMPTS,
        "plain_preview": code,
        "type": req.type,
    }

    logger.info("OTP generated for %s [%s] — expires in %ds",
                _mask_identifier(identifier, req.type), req.type, OTP_LIFETIME_SECONDS)

    masked = _mask_identifier(identifier, req.type)

    real_sent = False
    dispatch_msg = ""
    returned_dev_otp: Optional[str] = None

    if req.type == "phone":
        try:
            from app.services.sms_service import send_real_phone_otp  # noqa: PLC0415
            sms_ok, sms_msg = send_real_phone_otp(identifier, code)
            real_sent = sms_ok
            dispatch_msg = sms_msg
            if not sms_ok:
                logger.warning("SMS dispatch failed (%s) — falling back to dev_otp", sms_msg)
                returned_dev_otp = code
        except Exception as exc:
            logger.error("SMS service error: %s — returning dev_otp for local testing", exc)
            returned_dev_otp = code
    else:
        try:
            from app.services.email_service import send_real_email_otp  # noqa: PLC0415
            email_ok, email_msg = send_real_email_otp(identifier, code)
            real_sent = email_ok
            dispatch_msg = email_msg
            if not email_ok:
                logger.warning("Email dispatch failed (%s) — falling back to dev_otp", email_msg)
                returned_dev_otp = code
        except Exception as exc:
            logger.error("Email service error: %s — returning dev_otp for local testing", exc)
            returned_dev_otp = code

    if real_sent:
        message = f"A 6-digit verification code was sent to {masked}. Please check your {'phone' if req.type == 'phone' else 'inbox'}."
    else:
        message = f"{dispatch_msg or 'Gateway pending'}. Fallback code provided below."

    return AuthResponse(
        status="sent",
        message=message,
        dev_otp=returned_dev_otp,
        expires_in=OTP_LIFETIME_SECONDS,
    )


@router.post("/verify-otp", response_model=AuthResponse)
async def verify_otp(req: VerifyOtpRequest) -> AuthResponse:
    if req.type == "phone":
        digits = re.sub(r"\D", "", req.identifier)
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]
        elif digits.startswith("0") and len(digits) == 11:
            digits = digits[1:]
        identifier = digits
    else:
        identifier = req.identifier.strip().lower()

    record = _otp_store.get(identifier)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active verification code found. Please request a new code.",
        )

    # Check expiration
    if time.time() > record["expires_at"]:
        _otp_store.pop(identifier, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    # Check remaining attempts
    if record["attempts_left"] <= 0:
        _otp_store.pop(identifier, None)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Maximum verification attempts exceeded for security. Please request a new code.",
        )

    # Constant-time comparison
    computed_hash = _hash_otp(req.code, record["salt"])
    if not hmac.compare_digest(computed_hash, record["hash"]):
        record["attempts_left"] -= 1
        attempts_left = record["attempts_left"]
        if attempts_left > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid verification code. {attempts_left} attempt(s) remaining.",
            )
        else:
            _otp_store.pop(identifier, None)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid code. Maximum attempts reached. Code has been invalidated.",
            )

    # Successful verification
    _otp_store.pop(identifier, None)

    # Persistent user in SQLite
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with get_con() as con:
        user_row = con.execute("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", (identifier,)).fetchone()
        if not user_row:
            user_id = f"usr_{secrets.token_hex(6)}"
            con.execute(
                "INSERT INTO users (id, email, username, password_hash, password_salt, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (user_id, identifier, None, None, None, now_iso, now_iso),
            )
            username = None
            created_at = now_iso
        else:
            user_id = user_row["id"]
            username = user_row["username"]
            created_at = user_row["created_at"]

    # Issue session token
    session_token = secrets.token_urlsafe(32)
    expires_at = time.time() + SESSION_LIFETIME_S

    with get_con() as con:
        con.execute(
            "INSERT OR REPLACE INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (session_token, user_id, now_iso, expires_at),
        )

    # In-memory cache
    _session_store[session_token] = {
        "user_id": user_id,
        "identifier": identifier,
        "type": req.type,
        "username": username,
        "created_at": time.time(),
        "expires_at": expires_at,
        "created_at_iso": created_at,
    }

    needs_username = (username is None or len(username) == 0)

    user = UserProfile(
        id=user_id,
        identifier=identifier,
        email=identifier,
        username=username,
        type=req.type,
        maskedIdentifier=_mask_identifier(identifier, req.type),
        createdAt=created_at,
        needsUsername=needs_username,
    )

    logger.info("User verified successfully: %s [%s] (needsUsername=%s)",
                _mask_identifier(identifier, req.type), user_id, needs_username)

    return AuthResponse(
        status="verified",
        message="Authentication successful. Welcome to SwasthyaScan AI!",
        token=session_token,
        user=user,
        needs_username=needs_username,
    )


@router.post("/set-profile", response_model=UserProfile)
async def set_profile(
    req: SetProfileRequest,
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None),
) -> UserProfile:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif x_session_token:
        token = x_session_token.strip()

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please sign in to set your username.")

    with get_con() as con:
        session = con.execute("SELECT * FROM auth_sessions WHERE token = ?", (token,)).fetchone()
        if not session or time.time() > session["expires_at"]:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please sign in again.")

        user_id = session["user_id"]

        # Check if username is already taken by another user
        existing = con.execute(
            "SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?",
            (req.username, user_id),
        ).fetchone()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '@{req.username}' is already taken. Please choose another username.",
            )

        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        if req.password:
            salt = secrets.token_hex(16)
            pwd_hash = _hash_password(req.password, salt)
            con.execute(
                "UPDATE users SET username = ?, password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?",
                (req.username, pwd_hash, salt, now_iso, user_id),
            )
        else:
            con.execute(
                "UPDATE users SET username = ?, updated_at = ? WHERE id = ?",
                (req.username, now_iso, user_id),
            )

        user_row = con.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

    # Update in-memory session
    if token in _session_store:
        _session_store[token]["username"] = req.username

    return UserProfile(
        id=user_row["id"],
        identifier=user_row["email"],
        email=user_row["email"],
        username=user_row["username"],
        type="email",
        maskedIdentifier=_mask_identifier(user_row["email"], "email"),
        createdAt=user_row["created_at"],
        needsUsername=False,
    )


@router.post("/login-password", response_model=AuthResponse)
async def login_password(req: LoginPasswordRequest, http_request: Request) -> AuthResponse:
    client_ip = (
        http_request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or (http_request.client.host if http_request.client else "unknown")
    )
    _check_rate_limit(f"pwd:{client_ip}")

    ident = req.username_or_email.strip().lower()
    with get_con() as con:
        user_row = con.execute(
            "SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)",
            (ident, ident),
        ).fetchone()

    if not user_row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No account found with this username or email. Please sign in with Email OTP first to register.",
        )

    if not user_row["password_hash"] or not user_row["password_salt"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No password has been set for this account yet. Please sign in via Email OTP to set up your password.",
        )

    computed_hash = _hash_password(req.password, user_row["password_salt"])
    if not hmac.compare_digest(computed_hash, user_row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password. Please try again or sign in via Email OTP.",
        )

    # Issue session
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    session_token = secrets.token_urlsafe(32)
    expires_at = time.time() + SESSION_LIFETIME_S

    with get_con() as con:
        con.execute(
            "INSERT OR REPLACE INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (session_token, user_row["id"], now_iso, expires_at),
        )

    _session_store[session_token] = {
        "user_id": user_row["id"],
        "identifier": user_row["email"],
        "type": "email",
        "username": user_row["username"],
        "created_at": time.time(),
        "expires_at": expires_at,
        "created_at_iso": user_row["created_at"],
    }

    user = UserProfile(
        id=user_row["id"],
        identifier=user_row["email"],
        email=user_row["email"],
        username=user_row["username"],
        type="email",
        maskedIdentifier=_mask_identifier(user_row["email"], "email"),
        createdAt=user_row["created_at"],
        needsUsername=False,
    )

    logger.info("Password login successful for @%s [%s]", user_row["username"], user_row["id"])

    return AuthResponse(
        status="verified",
        message=f"Welcome back, @{user_row['username']}!",
        token=session_token,
        user=user,
        needs_username=False,
    )


@router.get("/me", response_model=UserProfile)
async def get_current_user(
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None),
) -> UserProfile:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif x_session_token:
        token = x_session_token.strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please sign in again.",
        )

    with get_con() as con:
        row = con.execute(
            "SELECT s.token, s.expires_at, u.* FROM auth_sessions s "
            "JOIN users u ON s.user_id = u.id WHERE s.token = ?",
            (token,),
        ).fetchone()

    if not row or time.time() > row["expires_at"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please sign in again.",
        )

    username = row["username"]
    needs_username = (username is None or len(username) == 0)

    return UserProfile(
        id=row["id"],
        identifier=row["email"],
        email=row["email"],
        username=username,
        type="email",
        maskedIdentifier=_mask_identifier(row["email"], "email"),
        createdAt=row["created_at"],
        needsUsername=needs_username,
    )


@router.post("/logout")
async def logout(
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None),
) -> dict:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif x_session_token:
        token = x_session_token.strip()

    if token:
        with get_con() as con:
            con.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))
        _session_store.pop(token, None)

    return {"status": "logged_out", "message": "Successfully signed out."}
