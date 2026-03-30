# MTG Judge Agent — Implementation Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stubbed LangGraph agent with a fully-featured MTG rules judge that retrieves from a self-hosted vector knowledge base, looks up card text and rulings via Scryfall, checks legality per format, and verifies its own answers before responding.

**Architecture:** Multi-stage LangGraph pipeline with deterministic conditional routing. Each stage is an isolated node; edges encode the allowed transitions. The frontend holds conversation history and passes it on each request — the backend is stateless.

**Tech Stack:** LangGraph, LangChain, Claude Sonnet 4.6 (Anthropic), Voyage AI embeddings (voyage-3), ChromaDB, Scryfall API, FastAPI, SQLite (Scryfall cache), Python cron / `schedule`

---

## New Dependencies

Add to `requirements.txt`:
```
voyageai
langchain-voyageai
```

`sqlite3` is part of the Python standard library — no install needed. `chromadb`, `langchain-anthropic`, `langgraph`, `httpx`, and `python-dotenv` are already present.

---

## File Structure

Files created or significantly changed by this implementation:

```
agent/
  graph.py                  ← redesigned (replaces existing ReAct loop)
  state.py                  ← new: AgentState + memory window
  nodes/
    __init__.py             ← new: empty package marker
    understand.py           ← new: intent classification, entity extraction
    retrieve.py             ← new: rules search + Scryfall orchestration
    reason.py               ← new: answer synthesis with citations
    self_review.py          ← new: citation verification + confidence flag
    respond.py              ← new: formats and appends final AIMessage
  embeddings/
    __init__.py             ← new: provider factory (reads EMBEDDING_PROVIDER env var)
    base.py                 ← new: abstract EmbeddingProvider interface
    voyage.py               ← new: Voyage AI implementation
  tools/
    __init__.py             ← new: empty package marker
    rules_search.py         ← new: ChromaDB vector search
    scryfall.py             ← new: rate-limited + cached Scryfall client
  knowledge_base/
    __init__.py             ← new: empty package marker
    parser.py               ← new: parse rules TXT by rule number
    indexer.py              ← new: embed + store in ChromaDB
    updater.py              ← new: download → diff → re-index pipeline

api/
  main.py                   ← updated: new /admin/refresh-rules endpoint,
                               updated AskRequest model (format + history fields)

scripts/
  refresh_rules.py          ← new: standalone cron entrypoint

data/                       ← each module calls Path("data").mkdir(parents=True,
  rules_hash.txt              exist_ok=True) independently before writing,
  scryfall_cache.db           so first-run order does not matter
  chroma_db/                ← moved from project root chroma_db/ — update any
                               existing path references

frontend/src/
  features/chat/
    InputBar.jsx            ← updated: add format selector dropdown
    ChatWindow.jsx          ← updated: receive format from InputBar, pass to useChat
  features/chat/useChat.js  ← updated: accept format param, pass format + serialized
                               history to askAgent on every send
  api/client.js             ← updated: askAgent accepts format + history args
```

Files **not** changed: `agent/tools.py`, `agent/knowledge_base.py` (old files superseded — delete after implementation confirmed working).

---

## Section 1: Agent State

**`agent/state.py`**

```python
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    format: str                # MTG format, e.g. "commander"
    turn_count: int            # completed user→agent turns this session
    review_retry_count: int    # how many times self_review has sent back to reason
                               # max value: 1 — resets to 0 each graph invocation
```

**`turn_count` increment:** The `respond` node increments `turn_count` by 1 after appending the final message — but only on a full pipeline run or a clarifying question turn. The turn-limit short-circuit does **not** increment (the count is already ≥ 10).

**Memory window:** When `turn_count >= 10`, the `understand` node sets a flag routing directly to `respond`, which returns a hardcoded refresh message without making any LLM calls.

**`review_retry_count`:** Tracks whether `self_review → reason` has already fired once. If `review_retry_count >= 1`, `self_review` always routes to `respond` regardless of answer quality. Reset to 0 at the start of each graph invocation.

**Stateless backend:** The frontend passes the full conversation history on every request. The server reconstructs `AgentState.messages` from that payload. No session store needed.

---

## Section 2: LangGraph Graph

**`agent/graph.py`**

### Nodes

| Node | File | Responsibility |
|---|---|---|
| `understand` | `nodes/understand.py` | Classify intent, extract card names + rule refs, check turn limit |
| `retrieve` | `nodes/retrieve.py` | Search ChromaDB; fetch card text, rulings, legality from Scryfall |
| `reason` | `nodes/reason.py` | Synthesize answer from retrieved context; cite rule numbers |
| `self_review` | `nodes/self_review.py` | Verify citations; flag uncertainty; approve or request fix |
| `respond` | `nodes/respond.py` | Format and append final `AIMessage` to state |

### Edges

```
START → understand

understand → respond     (turn_count >= 10 — short-circuit, no LLM calls)
understand → respond     (intent unclear — clarifying question pre-written to state)
understand → retrieve    (intent clear)

retrieve → reason
reason → self_review

self_review → reason     (citation wrong AND review_retry_count == 0)
self_review → respond    (approved, uncertain, or review_retry_count >= 1)

respond → END
```

### Node detail: `understand`

Calls Claude Sonnet 4.6 with a structured output prompt. Returns:
```json
{
  "intent": "rules_question | card_question | combo_question | unclear",
  "card_names": ["Lightning Bolt"],
  "rule_references": ["302.6"],
  "needs_clarification": false,
  "clarifying_question": null
}
```

If `turn_count >= 10`: skips LLM call, writes `{"turn_limit": true}` to state, routes to `respond`.

If `needs_clarification: true`: writes the clarifying question text into state as `pending_response`, routes to `respond`. The user's answer arrives as the next turn's first message with full history — no mid-graph pause needed.

If intent is clear: routes to `retrieve`.

### Node detail: `retrieve`

1. Calls `rules_search.py` with the user's question → top **6** rule chunks from ChromaDB (`k=6`)
2. For each card name from `understand`: calls `scryfall.py` to get merged card object + rulings + legality for `state.format`
3. Stores merged context dict in state for use by `reason`

If `scryfall.py` returns `None` for a card (404 or ambiguous match), the retrieve node omits card context for that name and continues — the reason node answers from rules only.

### Node detail: `reason`

System prompt instructs Claude Sonnet 4.6 to:
- Answer using only the retrieved context
- Cite every rule as "rule XXX.Xa"
- If `legality == "banned"`: **lead** with *"Note: {card} is **banned** in {format}."*
- If `legality == "restricted"`: lead with *"Note: {card} is **restricted** to one copy in {format}."*
- If `legality == "not_legal"`: note it and continue (user may be asking theoretically)
- If `legality == "legal"`: no note needed

### Node detail: `self_review`

Second Claude Sonnet 4.6 call. Checks:
1. Do the cited rule numbers appear in the retrieved rules context?
2. Does the answer contradict any retrieved rule text?
3. Is the legality status correctly stated?

Returns one of:
- `approved` → route to `respond`
- `needs_fix` AND `review_retry_count == 0` → increment `review_retry_count`, route to `reason`
- `needs_fix` AND `review_retry_count >= 1` → route to `respond` regardless (prevents infinite loop)
- `uncertain` → route to `respond` with `⚠️ I'm not fully certain — please verify with a certified judge.` prepended to the answer

### Node detail: `respond`

Reads state and appends a formatted `AIMessage`:
- **Normal answer**: the reason node's output (possibly prefixed with ⚠️ from self_review)
- **Clarifying question**: the `pending_response` text set by `understand`
- **Turn limit**: hardcoded string — *"This conversation has reached its limit — please start a new chat to continue."* — no LLM call

---

## Section 3: Embedding Provider

**`agent/embeddings/base.py`**

```python
class EmbeddingProvider(ABC):
    @abstractmethod
    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    @abstractmethod
    def embed_query(self, text: str) -> list[float]: ...
```

**`agent/embeddings/voyage.py`** — implements `EmbeddingProvider` using the `voyageai` SDK. Model read from `EMBEDDING_MODEL` env var (default: `voyage-3`).

**`agent/embeddings/__init__.py`** — provider factory:

```python
def get_embedding_provider() -> EmbeddingProvider:
    provider = os.getenv("EMBEDDING_PROVIDER", "voyage")
    if provider == "voyage":
        from .voyage import VoyageEmbeddingProvider
        return VoyageEmbeddingProvider()
    raise ValueError(f"Unknown embedding provider: {provider}")
```

Adding a new provider: create `embeddings/openai.py` (or similar), implement `EmbeddingProvider`, add an `elif` branch in the factory, set `EMBEDDING_PROVIDER=openai`. Nothing else changes.

**Configuration (`.env`):**
```
EMBEDDING_PROVIDER=voyage
EMBEDDING_MODEL=voyage-3
VOYAGE_API_KEY=your_key_here
```

---

## Section 4: Knowledge Base Pipeline

### Parser (`knowledge_base/parser.py`)

Splits the MTG comprehensive rules TXT by rule number. Pattern: lines starting with `\d+\.` (top-level) and `\d+\.\d+[a-z]?` (subrules).

Chunking strategy:
- Each **subrule** (e.g. `100.1a`) is its own chunk, prefixed with its parent rule text for context
- Each chunk carries metadata: `{"rule_number": "100.1a", "text": "..."}`

### Indexer (`knowledge_base/indexer.py`)

1. Calls `get_embedding_provider().embed_documents()` on all chunks (batched)
2. Writes to ChromaDB at `data/chroma_db/` using rule number as document ID
3. Replaces the collection atomically: build new → swap → delete old

### Updater (`knowledge_base/updater.py`)

```
1. HTTP GET rules TXT from Wizards of the Coast
2. SHA-256 hash the response body
3. Read stored hash from data/rules_hash.txt (treat as empty if file missing)
4. If hashes match → log "rules unchanged, skipping" → return
5. If different → parser.parse() → indexer.index() → write new hash to data/rules_hash.txt
```

`data/` is created by `updater.py` on first run if it does not exist.

### Triggers

**Cron** (`scripts/refresh_rules.py`): imports and calls `updater.run()`. NAS cron entry:
```
0 0 1 * *  python /path/to/scripts/refresh_rules.py
```
(midnight on the 1st of every month — no-op if rules unchanged)

**API endpoint** (`POST /admin/refresh-rules`): protected by `X-Admin-Key` header matched against `ADMIN_SECRET` env var. Returns `202 Accepted` with `{"status": "refresh started"}` immediately; runs `updater.run()` in a background thread.

---

## Section 5: Scryfall Client

**`agent/tools/scryfall.py`**

### Rate limiting
Uses `threading.Lock` + `time.sleep` (not `asyncio` — the graph and API endpoint are synchronous). Before every HTTP call, checks elapsed time since the last request; sleeps the remainder if less than 200ms has passed.

### Cache
SQLite at `data/scryfall_cache.db` (auto-created on first run). Schema:
```sql
CREATE TABLE IF NOT EXISTS card_cache (
  name_lower TEXT PRIMARY KEY,
  data       TEXT,     -- JSON: merged card object + rulings
  cached_at  INTEGER   -- Unix timestamp
);
```
TTL: 24 hours. Expired entries are re-fetched transparently. If `GET /cards/named` returns 404 or an ambiguous match error, `scryfall.py` returns `None` — the caller skips card context silently.

### Per-card lookup sequence
```
1. Lowercase card name → check cache → return if fresh hit
2. GET /cards/named?fuzzy={name}               (rate-limited, 200ms gap)
   → if 404 or error → return None
3. Extract id, oracle_text, type_line, legalities[format]
4. GET /cards/{id}/rulings                     (rate-limited, 200ms gap)
5. Merge into one dict (see shape below)
6. Write to cache with current timestamp
7. Return merged dict
```

**Merged output shape:**
```json
{
  "name": "Lightning Bolt",
  "oracle_text": "Lightning Bolt deals 3 damage to any target.",
  "type_line": "Instant",
  "legality": "legal",
  "format": "commander",
  "rulings": [
    { "date": "2004-10-04", "comment": "..." }
  ]
}
```

---

## Section 6: Format Selector & Legality

### Frontend changes

**`InputBar.jsx`** — add a `<select>` dropdown left of the text input. Controlled by local `format` state (default: `"commander"`). Pass `format` up to `ChatWindow` via an `onFormatChange` callback prop.

**`ChatWindow.jsx`** — receive `format` from `InputBar` via `onFormatChange`, store as local state, pass to `useChat` on every `sendMessage` call.

**`useChat.js`** — `sendMessage(text, format)` calls `askAgent(text, format, history)`. Before calling, serializes `messages` from internal shape to API shape:
```js
// internal: { id, role, text, timestamp }   role values: "user" | "agent"
// API:       { role, content }               role values: "user" | "assistant"

const history = messages.map(m => ({
  role: m.role === 'agent' ? 'assistant' : m.role,
  content: m.text,
}))
```

**`client.js`** — `askAgent(message, format, history)` posts:
```json
{
  "message": "Can I attack immediately?",
  "format": "commander",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

### Formats in dropdown
`commander` (default), `standard`, `pioneer`, `modern`, `legacy`, `vintage`, `pauper`, `brawl`

### API (`api/main.py`) — updated request model
```python
VALID_FORMATS = {"commander","standard","pioneer","modern","legacy","vintage","pauper","brawl"}

class AskRequest(BaseModel):
    message: str
    format: str = "commander"
    history: list[dict] = []

    @field_validator("format")
    @classmethod
    def validate_format(cls, v: str) -> str:
        if v not in VALID_FORMATS:
            raise ValueError(f"Unknown format '{v}'. Valid: {sorted(VALID_FORMATS)}")
        return v
```

**History reconstruction in `/ask`:** Convert `history` items to LangChain messages before invoking the graph:
```python
from langchain_core.messages import HumanMessage, AIMessage

lc_history = [
    HumanMessage(content=m["content"]) if m["role"] == "user"
    else AIMessage(content=m["content"])
    for m in request.history
]
# Then invoke: compiled_graph.invoke({"messages": lc_history + [HumanMessage(content=request.message)], ...})
```

---

## Environment Variables

```
# LLM
ANTHROPIC_API_KEY=...

# Embeddings
EMBEDDING_PROVIDER=voyage
EMBEDDING_MODEL=voyage-3
VOYAGE_API_KEY=...

# Admin endpoint
ADMIN_SECRET=...           # protects POST /admin/refresh-rules

# Existing
DISCORD_WEBHOOK_URL=...
```

---

## Out of Scope (Future Work)

- **Linkable rules pages** — a dedicated frontend page rendering rule XXX.Xa with anchor links
- **Usage tracking** — `POST /api/usage` endpoint and analytics (stub exists)
- **Persistent sessions** — server-side session store so history doesn't need to be resent each request
