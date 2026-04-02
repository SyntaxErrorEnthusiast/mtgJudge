# MTG Judge Agent

An AI-powered Magic: The Gathering rules judge. Ask rules questions in plain English and get cited, verified answers grounded in the official comprehensive rules and Scryfall card data.

---

## What it does

- Answers MTG rules questions using a self-hosted ChromaDB vector knowledge base built from the official comprehensive rules
- Looks up card oracle text, type lines, rulings, and legality via the Scryfall API
- Checks card legality per format and prepends ban/restriction notices automatically
- Verifies its own answers before responding (self-review node)
- Caps conversations at 10 turns to prevent runaway sessions
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
│   └── unit/                 # Unit tests
├── data/
│   ├── chroma_db/            # Persistent ChromaDB vector store
│   ├── scryfall_cache.db     # SQLite cache for Scryfall responses
│   └── rules_hash.txt        # SHA-256 of last indexed rules file
└── requirements.txt
```

---

## Agent pipeline

The agent is a five-node LangGraph directed graph:

```
START → understand → retrieve → reason → self_review → respond → END
                ↓                              ↓
            (unclear/                    (needs_fix,
           turn limit)                   retry = 0)
                ↓                              ↓
             respond                         reason
```

| Node | What it does |
|---|---|
| `understand` | Calls Claude with structured output to classify intent (`rules_question`, `card_question`, `combo_question`, `unclear`) and extract card names + rule references. Short-circuits to `respond` when `turn_count >= 10`. |
| `retrieve` | Queries ChromaDB for the top 6 relevant rule chunks. Calls Scryfall for each extracted card name. |
| `reason` | Calls Claude instructed to answer using only retrieved context. Cites rules as `rule XXX.Xa`. Prepends legality notes for banned/restricted cards. |
| `self_review` | Calls Claude to verify citations exist in context, answer doesn't contradict rules, and legality is correct. Returns `approved`, `needs_fix`, or `uncertain`. |
| `respond` | Emits the final `AIMessage`. Increments `turn_count` on normal and clarifying paths. Turn-limit path does not increment. |

Self-review can route back to `reason` at most once per invocation. On `uncertain`, the answer is prefixed with a warning to verify with a certified judge.

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- A [Voyage AI API key](https://www.voyageai.com/)

### 1. Clone and install Python dependencies

```bash
git clone <repo-url>
cd mtgJudge
pip install -r requirements.txt
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...

# Optional — defaults shown
EMBEDDING_PROVIDER=voyage
EMBEDDING_MODEL=voyage-3
ADMIN_SECRET=your-secret-key-here

# Optional — Discord webhook for feature requests
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### 3. Build the knowledge base

Download and index the MTG comprehensive rules into ChromaDB:

```bash
python scripts/refresh_rules.py
```

This downloads the latest rules from Wizards of the Coast, parses them into chunks, embeds them via Voyage AI, and stores them in `data/chroma_db/`. It's idempotent — re-running only re-indexes if the rules file has changed.

### 4. Start the backend

```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`. The Vite dev server proxies `/api/*` to the FastAPI backend automatically.

---

## API reference

### `POST /ask`

Ask the agent a rules question.

**Request body:**
```json
{
  "message": "Does deathtouch work with trample?",
  "format": "commander",
  "history": [
    { "role": "user", "content": "What is a triggered ability?" },
    { "role": "assistant", "content": "A triggered ability..." }
  ]
}
```

**Valid formats:** `commander`, `standard`, `pioneer`, `modern`, `legacy`, `vintage`, `pauper`, `brawl`

**Response:**
```json
{
  "response": "Yes — according to rule 702.2b...",
  "retrieved_rules": [
    { "rule_number": "702.2b", "text": "..." }
  ]
}
```

**Errors:** `400` empty message · `422` invalid format · `500` agent error

---

### `GET /rules`

Returns all MTG comprehensive rules sorted by rule number.

```json
[
  { "rule_number": "100.1", "text": "..." },
  { "rule_number": "100.1a", "text": "..." }
]
```

### `GET /rules/{rule_number}`

Returns a single rule. Case-insensitive. Returns `404` if not found.

### `POST /admin/refresh-rules`

Triggers a background knowledge base refresh. Requires the `X-Admin-Key` header matching `ADMIN_SECRET`.

Returns `202 {"status": "refresh started"}` immediately. Returns `401` if the key is missing or wrong.

### `GET /health`

Liveness check. Returns `{"status": "ok"}`.

---

## Knowledge base

The knowledge base is built from the official MTG comprehensive rules TXT file published by Wizards of the Coast.

**How it works:**

1. `updater.py` downloads the rules TXT and computes a SHA-256 hash
2. If the hash matches `data/rules_hash.txt`, it logs "rules unchanged, skipping" and exits
3. If the hash differs, `parser.py` splits the file into chunks by rule number (e.g. `702.19`, `702.19a`)
4. Each subrule chunk is prefixed with its parent rule text for context
5. `indexer.py` embeds all chunks via Voyage AI and writes them to ChromaDB atomically (build new collection → swap → delete old)
6. The new hash is written to `data/rules_hash.txt`

**To refresh manually:**
```bash
python scripts/refresh_rules.py
```

**To schedule monthly refreshes (cron):**
```
0 0 1 * * /path/to/venv/bin/python /path/to/scripts/refresh_rules.py
```

---

## Scryfall client

Card lookups use the [Scryfall API](https://scryfall.com/docs/api) with two layers of protection:

- **Rate limiting:** minimum 200ms gap between HTTP requests (threading lock + sleep)
- **SQLite cache:** results cached in `data/scryfall_cache.db` with a 24-hour TTL

Each card lookup fetches oracle text, type line, legality for the current format, and official rulings, then merges them into a single dict.

---

## Running tests

```bash
# All tests
pytest

# Property-based tests only
pytest tests/property/

# Unit tests only
pytest tests/unit/

# With verbose output
pytest -v
```

The property tests use [Hypothesis](https://hypothesis.readthedocs.io/) and run 100 examples per property. They cover all 20 correctness properties defined in the design spec.

**Frontend tests:**
```bash
cd frontend
npm test -- --run
```

---

## Rules browser

The app includes a `/rules` page that renders all indexed rules as a searchable, scrollable list. Each rule has a permanent anchor link (`/rules#702.19b`) — hover over any rule to reveal a 🔗 copy-link button.

The chat interface also includes a collapsible rules panel that shows the rules retrieved for the current answer, with the most relevant rule highlighted.

---

## Environment variables reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key for Claude |
| `VOYAGE_API_KEY` | Yes | — | Voyage AI API key for embeddings |
| `EMBEDDING_PROVIDER` | No | `voyage` | Embedding backend (`voyage` is the only supported value) |
| `EMBEDDING_MODEL` | No | `voyage-3` | Voyage AI model name |
| `ADMIN_SECRET` | No | — | Secret key for `POST /admin/refresh-rules` |
| `DISCORD_WEBHOOK_URL` | No | — | Discord webhook for feature request submissions |
