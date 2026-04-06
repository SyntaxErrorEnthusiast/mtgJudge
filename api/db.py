"""
api/db.py — SQLite helpers for usage logging.
"""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

_DB_PATH = Path("data/usage.db")


def _conn() -> sqlite3.Connection:
    Path("data").mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS usage_log (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            username  TEXT    NOT NULL,
            ts        TEXT    NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def log_usage(username: str) -> None:
    conn = _conn()
    try:
        conn.execute(
            "INSERT INTO usage_log (username, ts) VALUES (?, ?)",
            (username, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
    finally:
        conn.close()


def get_stats() -> list[dict]:
    """Return message counts and last seen per user, descending by message count."""
    conn = _conn()
    try:
        rows = conn.execute(
            """
            SELECT username, COUNT(*) as message_count, MAX(ts) as last_seen
            FROM usage_log
            GROUP BY username
            ORDER BY message_count DESC
            """
        ).fetchall()
        return [{"username": r[0], "message_count": r[1], "last_seen": r[2]} for r in rows]
    finally:
        conn.close()
