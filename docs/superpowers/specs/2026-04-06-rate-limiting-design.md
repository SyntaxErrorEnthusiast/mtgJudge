# Rate Limiting Design

**Date:** 2026-04-06  
**Status:** Approved

## Overview

Add per-user daily request limits to the `/ask` endpoint. Admins are exempt, can override limits per user, and can see average requests per day in the admin panel. Users see a proactive counter and a clear blocked state with reset time.

---

## Data Layer (`api/db.py`)

### New table

```sql
CREATE TABLE IF NOT EXISTS rate_limits (
    username    TEXT PRIMARY KEY,
    daily_limit INTEGER NOT NULL
)
```

Stores per-user overrides. If a user has no row here, the default limit of **30** applies.

### New functions

- **`get_daily_limit(username: str) -> int`**  
  Returns the per-user override from `rate_limits` if one exists, otherwise returns `30`.

- **`get_today_count(username: str) -> int`**  
  Counts rows in `usage_log` for the given user since UTC midnight today.

- **`set_rate_limit(username: str, limit: int) -> None`**  
  Upserts a row in `rate_limits` for the user. Used by the admin endpoint.

- **`get_avg_requests_per_day(username: str) -> float`**  
  Computes `total_requests / distinct_days` from `usage_log` for the user. Returns `0.0` if no data.

### Extended `get_stats()`

Returns existing fields plus:
- `daily_limit: int` — from `get_daily_limit(username)`
- `avg_per_day: float` — from `get_avg_requests_per_day(username)`

---

## API Layer (`api/main.py`)

### `POST /ask` — rate limit enforcement

Before invoking the agent:
1. Read `is_admin` from `X-Authentik-Groups` header.
2. If **not admin**: call `get_today_count` + `get_daily_limit`.
   - If `used >= limit`: return **HTTP 429** with body:
     ```json
     { "detail": "Rate limit exceeded", "reset_at": "<UTC midnight ISO string>" }
     ```
3. If allowed, proceed as normal.
4. On success, include quota in the response body:
   ```json
   { "response": "...", "retrieved_rules": [...], "quota": { "used": 5, "limit": 30, "reset_at": "2026-04-07T00:00:00Z" } }
   ```
   Admins receive `quota: null`.

### `GET /quota`

Returns quota state for the current user. No auth required beyond Authentik proxy headers.

```json
{
  "used": 5,
  "limit": 30,
  "reset_at": "2026-04-07T00:00:00Z",
  "is_admin": false
}
```

Admins receive `{ "is_admin": true, "used": 12, "limit": null, "reset_at": null }`.

### `PUT /admin/users/{username}/rate-limit`

Admin-only. Returns 403 if caller is not in `authentik Admins`.

Request body:
```json
{ "daily_limit": 50 }
```

Calls `set_rate_limit(username, daily_limit)`. Returns 204 No Content.

### `GET /admin/stats` (extended)

Each row now includes:
```json
{
  "username": "alice",
  "message_count": 120,
  "last_seen": "2026-04-06T14:00:00Z",
  "daily_limit": 30,
  "avg_per_day": 8.5
}
```

---

## Frontend

### `useQuota` hook (`frontend/src/features/chat/useQuota.js`)

- Fetches `GET /api/quota` on mount.
- After each `/ask` call (success or 429), updates `used` from the response's `quota` field or re-fetches quota on 429.
- Exposes `{ used, limit, resetAt, isAdmin, isBlocked }`.
  - `isBlocked = !isAdmin && used >= limit`

### `InputBar` changes

- Disabled when `isBlocked`.
- Shows a quota line below the input:
  - Normal: `"15 / 30 requests used today"` (hidden for admins)
  - Blocked: `"Daily limit reached. Resets at midnight UTC."` (styled as warning)

### `AdminPage` changes

- Two new columns in the stats table: **Avg/day** and **Limit**.
- The **Limit** column renders an inline editable field per row:
  - Displays current limit as text with a pencil/edit button.
  - On click: becomes a number input with Save/Cancel.
  - On save: calls `PUT /api/admin/users/{username}/rate-limit`, updates the row in local state.
- No full reload required — optimistic local state update after save.

---

## Error Handling

- **429 on `/ask`**: frontend catches this, sets `isBlocked = true`, shows reset time from response body.
- **403 on admin endpoint**: shown as an inline error in the admin table row.
- **Network errors on `/quota`**: fail silently — counter shows `—` and blocking is not enforced client-side (server still enforces).

---

## Out of Scope

- Rate limiting on endpoints other than `/ask`
- Per-hour or per-minute limits (daily only)
- Email/notification when a user hits their limit
