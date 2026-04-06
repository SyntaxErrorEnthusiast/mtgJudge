"""
api/db.py — SQLite helpers for usage logging.
"""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

_DB_PATH = Path("data/stats/usage.db")
_DEFAULT_DAILY_LIMIT = 30


def _conn() -> sqlite3.Connection:
    Path("data/stats").mkdir(parents=True, exist_ok=True)
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
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS rate_limits (
            username    TEXT PRIMARY KEY,
            daily_limit INTEGER NOT NULL
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
    """Return per-user message counts, last seen, daily limit, and avg requests per day."""
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
    finally:
        conn.close()

    return [
        {
            "username": r[0],
            "message_count": r[1],
            "last_seen": r[2],
            "daily_limit": get_daily_limit(r[0]),
            "avg_per_day": get_avg_requests_per_day(r[0]),
        }
        for r in rows
    ]


def set_rate_limit(username: str, limit: int) -> None:
    """Set or update the per-user daily request limit."""
    conn = _conn()
    try:
        conn.execute(
            """
            INSERT INTO rate_limits (username, daily_limit) VALUES (?, ?)
            ON CONFLICT(username) DO UPDATE SET daily_limit = excluded.daily_limit
            """,
            (username, limit),
        )
        conn.commit()
    finally:
        conn.close()


def get_avg_requests_per_day(username: str) -> float:
    """Return the average number of requests per day for a user."""
    conn = _conn()
    try:
        row = conn.execute(
            """
            SELECT
                CAST(COUNT(*) AS REAL) / COUNT(DISTINCT substr(ts, 1, 10))
            FROM usage_log
            WHERE username = ?
            """,
            (username,),
        ).fetchone()
        val = row[0]
        return round(val, 2) if val else 0.0
    finally:
        conn.close()


def get_daily_limit(username: str) -> int:
    """Return the per-user daily limit, or the default if no override is set."""
    conn = _conn()
    try:
        row = conn.execute(
            "SELECT daily_limit FROM rate_limits WHERE username = ?", (username,)
        ).fetchone()
        return row[0] if row else _DEFAULT_DAILY_LIMIT
    finally:
        conn.close()


def get_today_count(username: str) -> int:
    """Count how many requests this user has made since UTC midnight today."""
    conn = _conn()
    try:
        row = conn.execute(
            """
            SELECT COUNT(*) FROM usage_log
            WHERE username = ?
            AND substr(ts, 1, 10) = strftime('%Y-%m-%d', 'now')
            """,
            (username,),
        ).fetchone()
        return row[0]
    finally:
        conn.close()
