"""
tests/test_rate_limiting.py — tests for rate limiting db functions and API endpoints.
"""

import pytest
from pathlib import Path
from datetime import datetime, timezone, timedelta
import api.db as db_module
from api.db import get_daily_limit, get_today_count, log_usage


@pytest.fixture
def db(tmp_path, monkeypatch):
    """Redirect all db operations to a temp file for each test."""
    monkeypatch.setattr(db_module, '_DB_PATH', tmp_path / 'test.db')


# --- get_daily_limit ---

def test_get_daily_limit_returns_default_when_no_override(db):
    assert get_daily_limit('alice') == 30


def test_get_daily_limit_returns_override_when_set(db):
    from api.db import set_rate_limit
    set_rate_limit('alice', 50)
    assert get_daily_limit('alice') == 50


# --- get_today_count ---

def test_get_today_count_returns_zero_with_no_logs(db):
    assert get_today_count('alice') == 0


def test_get_today_count_counts_only_todays_logs(db):
    # Log 2 requests today
    log_usage('alice')
    log_usage('alice')
    assert get_today_count('alice') == 2


def test_get_today_count_ignores_other_users(db):
    log_usage('alice')
    log_usage('bob')
    assert get_today_count('alice') == 1


def test_get_today_count_ignores_yesterday(db):
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    # Manually insert a row with yesterday's timestamp
    conn = db_module._conn()
    conn.execute("INSERT INTO usage_log (username, ts) VALUES (?, ?)", ('alice', yesterday))
    conn.commit()
    conn.close()

    log_usage('alice')  # today
    assert get_today_count('alice') == 1
