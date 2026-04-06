"""
api/main.py — FastAPI wrapper that exposes your LangGraph agent as an HTTP API.

FastAPI handles:
  - Parsing incoming JSON requests
  - Routing to the right handler function
  - Serializing responses back to JSON
  - Auto-generated interactive docs at /docs (Swagger UI)

Run with:  uvicorn api.main:app --reload
Then visit: http://localhost:8000/docs to test interactively.

Docs: https://fastapi.tiangolo.com/
"""

import logging
import os

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from natsort import natsorted
from pydantic import BaseModel

from agent.graph import compiled_graph
from datetime import datetime, timezone, timedelta
from typing import Optional
import api.db as _db
from api.db import get_stats

load_dotenv()

# logging.basicConfig sets up a simple logger that writes to the terminal.
# INFO level shows normal operations; WARNING and above show problems.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def _utc_midnight_tomorrow() -> str:
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return tomorrow.isoformat()


# ---------------------------------------------------------------------------
# FastAPI app instance
# ---------------------------------------------------------------------------
# The `app` object is what uvicorn serves. All routes are registered on it.

app = FastAPI(
    title="LangGraph Agent API",
    description="Ask the agent questions. It uses Claude + a knowledge base + tools.",
    version="0.1.0",
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
# Pydantic models define the shape of JSON in/out and give you automatic
# validation and error messages for free.

class AskRequest(BaseModel):
    message: str  # The user's question
    format: str = "commander"
    history: list = []

    # Example shows up in /docs — helps you and others test the API quickly.
    model_config = {
        "json_schema_extra": {
            "examples": [{"message": "What are the rules for casting spells?"}]
        }
    }


class QuotaInfo(BaseModel):
    used: int
    limit: Optional[int] = None
    reset_at: Optional[str] = None
    is_admin: bool


class AskResponse(BaseModel):
    response: str
    retrieved_rules: list[dict] = []
    quota: Optional[QuotaInfo] = None


class RateLimitBody(BaseModel):
    daily_limit: int


class RequestBody(BaseModel):
    title: str
    description: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/me")
def me(request: Request):
    """Return the current user's identity from Authentik headers."""
    username = request.headers.get("X-Authentik-Username", "anonymous")
    email = request.headers.get("X-Authentik-Email", "")
    groups = request.headers.get("X-Authentik-Groups", "")
    is_admin = "authentik Admins" in groups
    return {"username": username, "email": email, "is_admin": is_admin}


@app.get("/quota", response_model=QuotaInfo)
def get_quota(request: Request) -> QuotaInfo:
    """Return the current user's daily quota state."""
    username = request.headers.get("X-Authentik-Username", "anonymous")
    groups = request.headers.get("X-Authentik-Groups", "")
    is_admin = "authentik Admins" in groups

    used = _db.get_today_count(username)

    if is_admin:
        return QuotaInfo(used=used, limit=None, reset_at=None, is_admin=True)

    limit = _db.get_daily_limit(username)
    return QuotaInfo(used=used, limit=limit, reset_at=_utc_midnight_tomorrow(), is_admin=False)


@app.get("/admin/stats")
def admin_stats(request: Request):
    """Return per-user message counts. Admin only."""
    groups = request.headers.get("X-Authentik-Groups", "")
    if "authentik Admins" not in groups:
        raise HTTPException(status_code=403, detail="Forbidden")
    return get_stats()


@app.post("/ask", response_model=AskResponse)
def ask(request: Request, body: AskRequest) -> AskResponse:
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    username = request.headers.get("X-Authentik-Username", "anonymous")
    groups = request.headers.get("X-Authentik-Groups", "")
    is_admin = "authentik Admins" in groups

    # Rate limit check — admins are exempt
    if not is_admin:
        used = _db.get_today_count(username)
        limit = _db.get_daily_limit(username)
        if used >= limit:
            raise HTTPException(
                status_code=429,
                detail={"message": "Rate limit exceeded", "reset_at": _utc_midnight_tomorrow()},
            )

    logger.info("ask: received message from %r (length=%d)", username, len(body.message))
    _db.log_usage(username)

    try:
        from langchain_core.messages import HumanMessage

        final_state = compiled_graph.invoke(
            {
                "messages": [HumanMessage(content=body.message)],
                "format": body.format,
                "turn_count": 0,
                "review_retry_count": 0,
                "intent": "",
                "card_names": [],
                "rule_references": [],
                "pending_response": None,
                "retrieved_context": {},
                "draft_answer": None,
                "self_review_status": None,
            }
        )
        answer = final_state["messages"][-1].content
        logger.info("ask: agent responded successfully")
    except Exception as e:
        logger.exception("ask: agent raised an exception")
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

    retrieved_rules = [
        {"rule_number": r["rule_number"], "text": r["text"]}
        for r in final_state.get("retrieved_context", {}).get("rules", [])
    ]

    # Build quota for response (admins get null)
    quota = None
    if not is_admin:
        new_used = _db.get_today_count(username)
        quota = QuotaInfo(
            used=new_used,
            limit=_db.get_daily_limit(username),
            reset_at=_utc_midnight_tomorrow(),
            is_admin=False,
        )

    return AskResponse(response=answer, retrieved_rules=retrieved_rules, quota=quota)

# ---------------------------------------------------------------------------
# Run directly for development (alternative to uvicorn CLI)
# ---------------------------------------------------------------------------

@app.post("/requests", status_code=204)
async def submit_request(body: RequestBody):
    """
    Receive a feature request from the frontend and forward it to Discord.

    Uses the DISCORD_WEBHOOK_URL environment variable set in .env.
    Returns 204 No Content on success (nothing to send back to the client).
    """
    webhook_url = os.getenv("DISCORD_WEBHOOK_URL")
    if not webhook_url:
        logger.error("requests: DISCORD_WEBHOOK_URL is not set in .env")
        raise HTTPException(status_code=503, detail="Discord webhook not configured.")

    logger.info("requests: sending feature request to Discord (title=%r)", body.title)

    # Discord's webhook API expects a JSON body with a "content" field (plain text)
    # or an "embeds" array for richer formatting. We use an embed here so it looks
    # clean in the Discord channel with a clear title and description.
    payload = {
        "embeds": [
            {
                "title": f"📬 Feature Request: {body.title}",
                "description": body.description,
                "color": 0xC9A84C,
            }
        ]
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(webhook_url, json=payload)
        if resp.status_code not in (200, 204):
            # Log the full Discord response so we can see exactly what went wrong.
            logger.error(
                "requests: Discord rejected the webhook — status=%d body=%s",
                resp.status_code,
                resp.text,
            )
            raise HTTPException(status_code=502, detail=f"Discord error {resp.status_code}: {resp.text}")

    logger.info("requests: feature request delivered to Discord successfully")


def _get_rules_collection():
    import chromadb as _chromadb
    client = _chromadb.PersistentClient(path="data/chroma_db")
    return client.get_collection("mtg_rules")


@app.get("/rules")
def get_all_rules():
    """Return all MTG rules sorted by rule number."""
    collection = _get_rules_collection()
    count = collection.count()
    result = collection.get(
        include=["metadatas"],
        limit=count,
    )
    rules = [
        {"rule_number": meta["rule_number"], "text": meta["text"]}
        for meta in result["metadatas"]
    ]
    return natsorted(rules, key=lambda r: r["rule_number"])


@app.get("/rules/{rule_number}")
def get_rule_by_number(rule_number: str):
    """Return a single rule by rule_number. Case-insensitive, strips whitespace."""
    collection = _get_rules_collection()
    count = collection.count()
    result = collection.get(include=["metadatas"], limit=count)
    target = rule_number.strip().lower()
    for meta in result["metadatas"]:
        if meta["rule_number"].strip().lower() == target:
            return {"rule_number": meta["rule_number"], "text": meta["text"]}
    raise HTTPException(status_code=404, detail=f"Rule '{rule_number}' not found.")


if __name__ == "__main__":
    import uvicorn

    # reload=True watches for file changes and restarts — great for development.
    # Set reload=False and workers>1 for production.
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
