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
from fastapi import FastAPI, HTTPException
from natsort import natsorted
from pydantic import BaseModel

from agent.graph import run_agent

load_dotenv()

# logging.basicConfig sets up a simple logger that writes to the terminal.
# INFO level shows normal operations; WARNING and above show problems.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

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

    # Example shows up in /docs — helps you and others test the API quickly.
    model_config = {
        "json_schema_extra": {
            "examples": [{"message": "What are the rules for casting spells?"}]
        }
    }


class AskResponse(BaseModel):
    response: str  # The agent's answer


class RequestBody(BaseModel):
    title: str
    description: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    """
    Simple liveness check. Hit this to confirm the server is running.
    Returns 200 OK with a JSON body.
    """
    return {"status": "ok"}


@app.post("/ask", response_model=AskResponse)
def ask(request: AskRequest) -> AskResponse:
    """
    Send a message to the agent and get a response.

    The agent will:
      1. Decide if it needs to search the knowledge base
      2. Decide if it needs to call any external APIs
      3. Return a final answer

    This is synchronous — the request blocks until the agent finishes.
    For long-running agents, consider making this async or adding a job queue.
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    logger.info("ask: received message (length=%d)", len(request.message))
    try:
        answer = run_agent(request.message)
        logger.info("ask: agent responded successfully")
    except Exception as e:
        logger.exception("ask: agent raised an exception")
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

    return AskResponse(response=answer)


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
    result = collection.get(
        include=["metadatas"],
        limit=collection.count(),
    )
    rules = [
        {"rule_number": meta["rule_number"], "text": meta["text"]}
        for meta in result["metadatas"]
    ]
    return natsorted(rules, key=lambda r: r["rule_number"])


if __name__ == "__main__":
    import uvicorn

    # reload=True watches for file changes and restarts — great for development.
    # Set reload=False and workers>1 for production.
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
