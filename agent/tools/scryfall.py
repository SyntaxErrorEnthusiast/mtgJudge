"""
Scryfall API client with rate limiting (200ms gap) and SQLite caching (24h TTL).

Cards are cached. Callers are
responsible for deriving per-format legality from card["legalities"][format].
"""

import json
import logging
import sqlite3
import threading
import time
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rate-limiting state
# ---------------------------------------------------------------------------
_lock = threading.Lock()
_last_request_time: float = 0.0
_MIN_GAP_SECONDS = 0.2  # 200ms

# ---------------------------------------------------------------------------
# Cache constants
# ---------------------------------------------------------------------------
_DB_PATH = Path("data/cache/scryfall_cache.db")
_CACHE_TTL = 604800  # 7 days in seconds

# ---------------------------------------------------------------------------
# Scryfall base URL
# ---------------------------------------------------------------------------
_BASE_URL = "https://api.scryfall.com"


def _ensure_db() -> sqlite3.Connection:
    """Create the data/cache/ directory and the cache DB/schema if needed."""
    Path("data/cache").mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS card_cache (
            name_lower TEXT PRIMARY KEY,
            data       TEXT,
            cached_at  INTEGER
        )
        """
    )
    conn.commit()
    return conn


def _rate_limited_get(url: str, params: dict | None = None) -> httpx.Response:
    """Perform a GET request, enforcing a 200ms minimum gap between requests."""
    global _last_request_time
    with _lock:
        now = time.monotonic()
        elapsed = now - _last_request_time
        if elapsed < _MIN_GAP_SECONDS:
            time.sleep(_MIN_GAP_SECONDS - elapsed)
        response = httpx.get(url, params=params, timeout=10.0)
        _last_request_time = time.monotonic()
    return response


def _cache_get(conn: sqlite3.Connection, key: str) -> dict | None:
    """Return cached data if it exists and is less than 24h old, else None."""
    row = conn.execute(
        "SELECT data, cached_at FROM card_cache WHERE name_lower = ?", (key,)
    ).fetchone()
    if row is None:
        return None
    data_json, cached_at = row
    if time.time() - cached_at < _CACHE_TTL:
        return json.loads(data_json)
    return None  # expired


def _cache_set(conn: sqlite3.Connection, key: str, data: dict) -> None:
    """Insert or replace a cache entry."""
    conn.execute(
        "INSERT OR REPLACE INTO card_cache (name_lower, data, cached_at) VALUES (?, ?, ?)",
        (key, json.dumps(data), int(time.time())),
    )
    conn.commit()


def get_card(name: str) -> dict | None:
    """
    Look up a card by name.

    Returns a dict with shape:
        {name, oracle_text, type_line, legalities, rulings}
    or None if the card is not found / ambiguous / network error.

    The full legalities dict is stored so a single cache entry covers all formats.
    Callers should derive legality via card["legalities"].get(format, "unknown").

    Cache lookup is performed first; HTTP is only called on a cache miss or
    expired entry.
    """
    key = name.lower()
    conn = _ensure_db()

    try:
        # --- Cache hit ---
        cached = _cache_get(conn, key)
        if cached is not None:
            return cached

        # --- Fetch card ---
        try:
            resp = _rate_limited_get(f"{_BASE_URL}/cards/named", params={"fuzzy": name})
        except Exception as exc:
            logger.error("Network error fetching card %r: %s", name, exc)
            return None

        if resp.status_code == 404:
            return None

        if resp.status_code == 400:
            # Scryfall returns 400 for ambiguous matches
            body = resp.json() if resp.content else {}
            details = body.get("details", "").lower()
            if "too many cards" in details or "ambiguous" in details or details:
                # Any 400 from /cards/named is treated as ambiguous/not found
                return None

        if not resp.is_success:
            logger.error("Scryfall /cards/named returned %d for %r", resp.status_code, name)
            return None

        card_data = resp.json()
        card_id = card_data.get("id")

        # --- Fetch rulings ---
        rulings: list[dict] = []
        if card_id:
            try:
                rulings_resp = _rate_limited_get(f"{_BASE_URL}/cards/{card_id}/rulings")
                if rulings_resp.is_success:
                    rulings_data = rulings_resp.json().get("data", [])
                    rulings = [
                        {"date": r.get("published_at", ""), "comment": r.get("comment", "")}
                        for r in rulings_data
                    ]
            except Exception as exc:
                logger.error("Network error fetching rulings for %r: %s", name, exc)
                # Continue with empty rulings rather than failing entirely

        # --- Build merged dict ---
        result: dict = {
            "name": card_data.get("name", name),
            "oracle_text": card_data.get("oracle_text", ""),
            "type_line": card_data.get("type_line", ""),
            "legalities": card_data.get("legalities", {}),
            "rulings": rulings,
        }

        # --- Write to cache ---
        _cache_set(conn, key, result)

        return result

    finally:
        conn.close()
