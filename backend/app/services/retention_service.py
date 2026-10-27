"""
SwasthyaScan AI — Retention & Cleanup Service
===============================================
Deletes expired environments and their submissions+images.
Runs on startup and every CLEANUP_INTERVAL_MINUTES (default 10).
"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from app.db.database import get_con
from app.services.auth_service import utcnow_str
from app.services.upload_service import delete_image

logger = logging.getLogger(__name__)

CLEANUP_INTERVAL_MINUTES = 10


async def cleanup_loop() -> None:
    """Background async task — runs cleanup every CLEANUP_INTERVAL_MINUTES."""
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_MINUTES * 60)
        try:
            run_cleanup()
        except Exception as exc:
            logger.warning("Retention cleanup error (non-fatal): %s", exc)


def run_cleanup() -> int:
    """
    Delete all expired environments and their associated data.
    Returns count of environments deleted.
    """
    now = utcnow_str()
    deleted = 0
    with get_con() as con:
        # Find expired environments
        expired = con.execute(
            "SELECT id FROM environments WHERE expires_at < ?", (now,)
        ).fetchall()
        for row in expired:
            env_id = row["id"]
            _delete_environment_data(con, env_id)
            deleted += 1

        # Also clean up orphaned sessions
        con.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))

    if deleted:
        logger.info("Retention cleanup: removed %d expired environment(s).", deleted)
    return deleted


def delete_environment_now(environment_id: str) -> None:
    """
    Immediately delete an environment and all its data (submissions + files).
    Called by the doctor 'Delete Environment' endpoint.
    """
    with get_con() as con:
        _delete_environment_data(con, environment_id)
    logger.info("Environment %s and all data deleted on doctor request.", environment_id)


def _delete_environment_data(con, environment_id: str) -> None:
    """Delete all submissions (and their image files), sessions, then the environment row."""
    # Get all image filenames for this environment
    rows = con.execute(
        "SELECT image_filename FROM submissions WHERE environment_id=?",
        (environment_id,),
    ).fetchall()
    for row in rows:
        if row["image_filename"]:
            delete_image(row["image_filename"])

    # Delete DB rows
    con.execute("DELETE FROM submissions WHERE environment_id=?", (environment_id,))
    con.execute("DELETE FROM sessions    WHERE environment_id=?", (environment_id,))
    con.execute("DELETE FROM environments WHERE id=?",            (environment_id,))
