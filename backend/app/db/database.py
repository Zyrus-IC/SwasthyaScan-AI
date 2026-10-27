"""
SwasthyaScan AI — Environment Database Layer
=============================================
Plain sqlite3, no ORM. Creates tables on first connection.
Thread-safe via check_same_thread=False + WAL mode.
"""
from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

_DB_PATH: Path | None = None
_lock = threading.Lock()


def init_db(db_path: Path) -> None:
    """Call once at startup with the resolved DB path."""
    global _DB_PATH
    db_path.parent.mkdir(parents=True, exist_ok=True)
    _DB_PATH = db_path
    with _connect() as con:
        con.executescript(_SCHEMA)


@contextmanager
def _connect():
    assert _DB_PATH, "Database not initialised — call init_db() first."
    con = sqlite3.connect(str(_DB_PATH), check_same_thread=False,
                          detect_types=sqlite3.PARSE_DECLTYPES)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def get_con():
    """Context manager — yields an open, committed connection."""
    return _connect()


_SCHEMA = """
CREATE TABLE IF NOT EXISTS environments (
    id           TEXT PRIMARY KEY,          -- UUID4
    join_code    TEXT UNIQUE NOT NULL,      -- 8-char plaintext (stored, not secret)
    passcode_hash TEXT NOT NULL,            -- pbkdf2 hex
    passcode_salt TEXT NOT NULL,            -- hex salt
    created_at   TEXT NOT NULL,             -- ISO-8601 UTC
    expires_at   TEXT NOT NULL,             -- ISO-8601 UTC
    closed       INTEGER NOT NULL DEFAULT 0 -- 0=open, 1=closed
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash   TEXT PRIMARY KEY,          -- sha256 hex of raw token
    role         TEXT NOT NULL,             -- 'doctor' | 'patient'
    environment_id TEXT NOT NULL,
    submission_id  TEXT,                    -- set for patient sessions
    expires_at   TEXT NOT NULL              -- ISO-8601 UTC
);

CREATE TABLE IF NOT EXISTS submissions (
    id                  TEXT PRIMARY KEY,   -- UUID4
    environment_id      TEXT NOT NULL REFERENCES environments(id),
    pseudonym           TEXT NOT NULL,      -- patient-chosen ID (no PII)
    image_filename      TEXT,               -- random UUID filename in uploads dir
    questionnaire_json  TEXT,               -- JSON string
    model_output_json   TEXT,               -- JSON string or NULL
    reliability_flags_json TEXT,            -- JSON string or NULL
    gradcam_data        TEXT,               -- base64 PNG data URI or NULL
    priority_label      TEXT NOT NULL DEFAULT 'Unable to assess',
    priority_reasons    TEXT,               -- JSON array string
    override_label      TEXT,               -- doctor override
    override_reason     TEXT,               -- required when override set
    doctor_notes        TEXT,
    status              TEXT NOT NULL DEFAULT 'Pending',  -- Pending|Reviewed|Follow-up needed
    released_guidance   TEXT,               -- doctor-released note visible to patient
    created_at          TEXT NOT NULL       -- ISO-8601 UTC
);

CREATE TABLE IF NOT EXISTS rate_limit (
    key          TEXT PRIMARY KEY,          -- 'ip:<ip>' or 'code:<code>'
    attempts     INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT                       -- ISO-8601 UTC or NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_env ON submissions(environment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_env    ON sessions(environment_id, expires_at);
"""
