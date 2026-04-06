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


# --- set_rate_limit ---

def test_set_rate_limit_inserts_new_row(db):
    from api.db import set_rate_limit
    set_rate_limit('alice', 50)
    assert get_daily_limit('alice') == 50


def test_set_rate_limit_updates_existing_row(db):
    from api.db import set_rate_limit
    set_rate_limit('alice', 50)
    set_rate_limit('alice', 10)
    assert get_daily_limit('alice') == 10


# --- get_avg_requests_per_day ---

def test_get_avg_requests_per_day_returns_zero_with_no_data(db):
    from api.db import get_avg_requests_per_day
    assert get_avg_requests_per_day('alice') == 0.0


def test_get_avg_requests_per_day_single_day(db):
    from api.db import get_avg_requests_per_day
    log_usage('alice')
    log_usage('alice')
    log_usage('alice')
    assert get_avg_requests_per_day('alice') == 3.0


def test_get_avg_requests_per_day_multiple_days(db):
    from api.db import get_avg_requests_per_day
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    conn = db_module._conn()
    conn.execute("INSERT INTO usage_log (username, ts) VALUES (?, ?)", ('alice', yesterday))
    conn.execute("INSERT INTO usage_log (username, ts) VALUES (?, ?)", ('alice', yesterday))
    conn.commit()
    conn.close()
    log_usage('alice')  # today: 1 request
    # 3 total requests across 2 days = 1.5 avg
    assert get_avg_requests_per_day('alice') == 1.5


# --- get_stats extension ---

def test_get_stats_includes_daily_limit_and_avg_per_day(db):
    from api.db import get_stats, set_rate_limit
    log_usage('alice')
    log_usage('alice')
    set_rate_limit('alice', 40)

    stats = get_stats()
    alice = next(s for s in stats if s['username'] == 'alice')
    assert alice['daily_limit'] == 40
    assert alice['avg_per_day'] == 2.0


def test_get_stats_uses_default_limit_when_no_override(db):
    from api.db import get_stats
    log_usage('bob')

    stats = get_stats()
    bob = next(s for s in stats if s['username'] == 'bob')
    assert bob['daily_limit'] == 30


# --- GET /quota ---

from unittest.mock import patch
from fastapi.testclient import TestClient
from api.main import app

api_client = TestClient(app)


def test_quota_returns_used_limit_reset_for_regular_user():
    with patch('api.db.get_today_count', return_value=5), \
         patch('api.db.get_daily_limit', return_value=30):
        resp = api_client.get(
            '/quota',
            headers={'X-Authentik-Username': 'alice', 'X-Authentik-Groups': ''}
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data['used'] == 5
    assert data['limit'] == 30
    assert data['is_admin'] is False
    assert data['reset_at'] is not None


def test_quota_for_admin_has_no_limit():
    with patch('api.db.get_today_count', return_value=100):
        resp = api_client.get(
            '/quota',
            headers={
                'X-Authentik-Username': 'superuser',
                'X-Authentik-Groups': 'authentik Admins',
            }
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data['is_admin'] is True
    assert data['limit'] is None
    assert data['reset_at'] is None
