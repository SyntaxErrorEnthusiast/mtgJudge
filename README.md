# MTG Judge Agent

An AI-powered Magic: The Gathering rules judge. Ask rules questions in plain English and get cited, verified answers grounded in the official comprehensive rules and Scryfall card data.

---

## Setup

> Setup documentation is a work in progress and will be added soon.

---

## What it does

- Answers MTG rules questions using a ChromaDB vector knowledge base built from the official comprehensive rules
- Looks up card oracle text, type lines, rulings, and legality via the Scryfall API
- Checks card legality per format and prepends ban/restriction notices automatically
- Verifies its own answers before responding (self-review node)
- Streams responses token-by-token via SSE with per-node progress events
- Per-user daily rate limiting (default 30/day) with admin overrides via Authentik
- Stateless backend — the frontend sends full conversation history on every request

---

## Tech stack

| Layer | Technology |
|---|---|
| LLM | Claude Sonnet (Anthropic) |
| Agent framework | LangGraph |
| Embeddings | Voyage AI (`voyage-3`) |
| Vector store | ChromaDB (local, persistent) |
| Card data | Scryfall API (SQLite-cached, rate-limited) |
| Backend API | FastAPI + Uvicorn |
| Frontend | React 19 + Vite + Bootstrap 5 |
| Testing | Pytest + Hypothesis (property-based) |

---

## Project structure

```
mtgJudge/
├── agent/
│   ├── graph.py              # LangGraph pipeline — wires all five nodes
│   ├── state.py              # AgentState TypedDict
│   ├── nodes/
│   │   ├── understand.py     # Classify intent, extract card names + rule refs
│   │   ├── retrieve.py       # Query ChromaDB + Scryfall
│   │   ├── reason.py         # Synthesize cited answer from context
│   │   ├── self_review.py    # Verify citations and legality before responding
│   │   └── respond.py        # Format and emit final AIMessage
│   ├── embeddings/
│   │   ├── base.py           # Abstract EmbeddingProvider interface
│   │   └── voyage.py         # Voyage AI implementation
│   ├── knowledge_base/
│   │   ├── parser.py         # Split rules TXT into chunks by rule number
│   │   ├── indexer.py        # Embed chunks and write to ChromaDB atomically
│   │   └── updater.py        # Download → SHA-256 diff → re-index pipeline
│   └── tools/
│       ├── rules_search.py   # ChromaDB semantic search wrapper
│       └── scryfall.py       # Rate-limited, SQLite-cached Scryfall client
├── api/
│   └── main.py               # FastAPI app — /ask, /rules, /admin/refresh-rules
├── frontend/
│   └── src/
│       ├── features/
│       │   ├── chat/         # Chat UI (ChatWindow, InputBar, useChat, MessageList)
│       │   └── rules/        # Rules browser (RulesPage, RulesPanel)
│       └── api/client.js     # All HTTP calls to the backend
├── scripts/
│   └── refresh_rules.py      # Standalone cron script to refresh the knowledge base
├── tests/
│   ├── property/             # Hypothesis property-based tests (20 properties)
│   └── unit/
├── data/
│   ├── chroma_db/            # Persistent ChromaDB vector store
│   ├── cache/
│   │   └── scryfall_cache.db # SQLite cache for Scryfall responses (7-day TTL)
│   ├── stats/
│   │   └── usage.db          # SQLite usage log for rate limiting
│   └── rules_hash.txt        # SHA-256 of last indexed rules file
└── requirements.txt
```

---

## Agent pipeline

Five-node LangGraph directed graph:

```
START → understand → retrieve → reason → self_review → respond → END
                ↓                              ↓
            (unclear)                     (needs_fix,
                                           retry = 0)
                ↓                              ↓
             respond                         reason
```

| Node | What it does |
|---|---|
| `understand` | Classifies intent (`rules_question`, `card_question`, `combo_question`, `unclear`, `rule_lookup`) and extracts card names + rule references. Short-circuits to `respond` on unclear intent. |
| `retrieve` | Queries ChromaDB for top 6 relevant rule chunks. Calls Scryfall for each extracted card name. |
| `reason` | Answers using only retrieved context. Cites rules as `rule XXX.Xa`. Prepends legality notes for banned/restricted cards. |
| `self_review` | Verifies citations exist in context, answer doesn't contradict rules, and legality is correct. Returns `approved`, `needs_fix`, or `uncertain`. |
| `respond` | Emits the final `AIMessage`. |

Self-review routes back to `reason` at most once per invocation. On `uncertain`, the answer is prefixed with a warning to verify with a certified judge.

---

## API reference

### `POST /ask`

```json
{
  "message": "Does deathtouch work with trample?",
  "format": "commander",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

Valid formats: `commander`, `standard`, `pioneer`, `modern`, `legacy`, `vintage`, `pauper`, `brawl`

```json
{
  "response": "Yes — according to rule 702.2b...",
  "retrieved_rules": [{ "rule_number": "702.2b", "text": "..." }],
  "quota": { "used": 3, "limit": 30, "reset_at": "...", "is_admin": false }
}
```

Errors: `400` empty message · `429` rate limit exceeded · `500` agent error

### `POST /ask/stream`

Same request body as `/ask`. Returns an SSE stream with the following event types:

- `step` — `{"step": "understand"|"retrieve"|"reason"|"self_review"|"respond"}`
- `token` — `{"token": "..."}` (streamed tokens from the reason node)
- `done` — `{"retrieved_rules": [...], "quota": {...}|null}`
- `error` — `{"message": "..."}`

### `GET /rules`

Returns all rules sorted by rule number.

### `GET /rules/{rule_number}`

Returns a single rule. Case-insensitive. `404` if not found.

### `GET /me`

Returns the current user's identity from Authentik headers: `{username, email, is_admin}`.

### `GET /quota`

Returns the current user's daily quota: `{used, limit, reset_at, is_admin}`. Admins get `limit: null`.

### `GET /admin/stats`

Returns per-user message counts and rate limit info. Admin only (`403` otherwise).

### `PUT /admin/users/{username}/rate-limit`

Sets a per-user daily request limit. Body: `{"daily_limit": 50}`. Admin only. Returns `204`.

### `POST /requests`

Submits a feature request to Discord. Body: `{"title": "...", "description": "..."}`. Returns `204`. Requires `DISCORD_WEBHOOK_URL` to be set.

### `GET /health`

Returns `{"status": "ok"}`.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key for Claude |
| `VOYAGE_API_KEY` | Yes | — | Voyage AI key for embeddings |
| `EMBEDDING_PROVIDER` | No | `voyage` | Embedding backend |
| `EMBEDDING_MODEL` | No | `voyage-3` | Voyage AI model name |
| `DISCORD_WEBHOOK_URL` | No | — | Discord webhook for feature requests |

---

## Running tests

```bash
pytest                  # all tests
pytest tests/property/  # property-based only
pytest tests/unit/      # unit only
```

Frontend:
```bash
cd frontend && npm test -- --run
```
