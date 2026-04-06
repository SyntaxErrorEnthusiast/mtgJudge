# Rule Number Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users look up MTG rules by number (e.g. `702.10b`, `302.6`, `201`) with the agent detecting intent and doing a direct ChromaDB ID lookup instead of semantic search.

**Architecture:** Add `rule_lookup` as a fifth intent in `understand.py`; in `retrieve.py`, when that intent is present, call `collection.get(ids=...)` for exact matches and prefix-scan all IDs for partial matches, falling back to semantic search if nothing is found. `graph.py` already routes any non-`unclear`/non-`turn_limit` intent to `retrieve`, so no graph changes are needed.

**Tech Stack:** Python, LangGraph, ChromaDB, LangChain Anthropic, pytest, unittest.mock

---

## File Map

| File | Change |
|---|---|
| `agent/nodes/understand.py` | Add `rule_lookup` to `IntentClassification` enum description and system prompt |
| `agent/nodes/retrieve.py` | Add `_lookup_by_rule_numbers()` helper; call it when `intent == "rule_lookup"` |
| `tests/test_understand_rule_lookup.py` | New — unit tests for `rule_lookup` intent acceptance and routing |
| `tests/test_retrieve_rule_lookup.py` | New — unit tests for direct lookup, prefix scan, and fallback |

---

## Task 1: Test that `understand` accepts and stores `rule_lookup` intent

**Files:**
- Create: `tests/test_understand_rule_lookup.py`
- Read: `agent/nodes/understand.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_understand_rule_lookup.py
from unittest.mock import MagicMock, patch
from langchain_core.messages import HumanMessage

from agent.nodes.understand import understand, IntentClassification


def _state(text: str) -> dict:
    return {
        "messages": [HumanMessage(content=text)],
        "turn_count": 0,
    }


def _mock_llm(intent: str, rule_refs: list[str]):
    """Return a mock structured LLM that yields a fixed IntentClassification."""
    result = IntentClassification(
        intent=intent,
        card_names=[],
        rule_references=rule_refs,
        clarifying_question=None,
    )
    mock_structured = MagicMock()
    mock_structured.invoke.return_value = result
    mock_llm = MagicMock()
    mock_llm.with_structured_output.return_value = mock_structured
    return mock_llm


def test_rule_lookup_intent_is_stored():
    """rule_lookup returned by LLM must be stored in state."""
    with patch("agent.nodes.understand._get_llm", return_value=_mock_llm("rule_lookup", ["702.10b"])):
        result = understand(_state("702.10b"))
    assert result["intent"] == "rule_lookup"


def test_rule_lookup_rule_references_stored():
    """rule_references must pass through when intent is rule_lookup."""
    with patch("agent.nodes.understand._get_llm", return_value=_mock_llm("rule_lookup", ["302.6"])):
        result = understand(_state("what does rule 302.6 say?"))
    assert result["rule_references"] == ["302.6"]


def test_unknown_intent_falls_back_to_unclear():
    """An unrecognised intent string must be normalised to 'unclear'."""
    with patch("agent.nodes.understand._get_llm", return_value=_mock_llm("bogus_intent", [])):
        result = understand(_state("something"))
    assert result["intent"] == "unclear"
```

- [ ] **Step 2: Run the tests — expect failure**

```
pytest tests/test_understand_rule_lookup.py -v
```

Expected: `test_rule_lookup_intent_is_stored` FAILS because `rule_lookup` is not in `valid_intents` and gets normalised to `unclear`.

---

## Task 2: Add `rule_lookup` intent to `understand.py`

**Files:**
- Modify: `agent/nodes/understand.py`

- [ ] **Step 1: Add `rule_lookup` to `IntentClassification` field description**

In `agent/nodes/understand.py`, find the `intent` field on `IntentClassification` and update its description:

```python
intent: str = Field(
    description=(
        "The classified intent of the user message. "
        "Must be one of: rules_question, card_question, combo_question, unclear, rule_lookup."
    )
)
```

- [ ] **Step 2: Add `rule_lookup` to the system prompt context block**

In `_SYSTEM_PROMPT`, extend the Intent categories list:

```python
_SYSTEM_PROMPT = """<instructions>
You are an expert Magic: The Gathering rules judge assistant.

Your task is to classify the user's question and extract relevant entities.
</instructions>

<context>
Intent categories:
- rules_question: The user is asking about a specific rule, mechanic, or interaction that does not require knowing a specific card's oracle text.
- card_question: The user is asking about a specific card's text, abilities, or rulings.
- combo_question: The user is asking about an interaction or combo between two or more cards.
- rule_lookup: The user's clear purpose is to retrieve a specific rule by its number. Use this ONLY when the message is essentially a rule number (e.g. "702.10b", "what does rule 302.6 say?"). Do NOT use this when a number appears incidentally in a gameplay question (e.g. "if I have 302 tokens" or "can I do this with 201 life").
- unclear: The question is ambiguous, incomplete, or cannot be classified without more information.

Entity extraction:
- card_names: Any Magic card names mentioned (use the exact name as written by the user).
- rule_references: Any rule numbers mentioned (e.g. "702.19", "100.1a", "rule 303.4").
- clarifying_question: Only when intent is "unclear" — write a short, helpful question to clarify what the user needs.
</context>"""
```

- [ ] **Step 3: Add `rule_lookup` to `valid_intents`**

```python
valid_intents = {"rules_question", "card_question", "combo_question", "unclear", "rule_lookup"}
```

- [ ] **Step 4: Run the tests — expect pass**

```
pytest tests/test_understand_rule_lookup.py -v
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add agent/nodes/understand.py tests/test_understand_rule_lookup.py
git commit -m "feat: add rule_lookup intent to understand node"
```

---

## Task 3: Write tests for direct rule lookup in `retrieve.py`

**Files:**
- Create: `tests/test_retrieve_rule_lookup.py`
- Read: `agent/nodes/retrieve.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_retrieve_rule_lookup.py
from unittest.mock import MagicMock, patch
from langchain_core.messages import HumanMessage

from agent.nodes.retrieve import retrieve, _lookup_by_rule_numbers


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _state(intent: str, rule_refs: list[str], message: str = "702.10b") -> dict:
    return {
        "messages": [HumanMessage(content=message)],
        "intent": intent,
        "rule_references": rule_refs,
        "card_names": [],
        "format": "commander",
    }


def _mock_collection(stored_ids: list[str], stored_texts: dict[str, str]):
    """Build a mock ChromaDB collection with the given IDs and texts."""
    col = MagicMock()
    col.count.return_value = len(stored_ids)

    def get_side_effect(ids=None, include=None):
        matched_ids = [i for i in (ids or []) if i in stored_ids]
        return {
            "ids": matched_ids,
            "metadatas": [{"rule_number": i, "text": stored_texts[i]} for i in matched_ids],
        }

    def get_all_side_effect(include=None, limit=None):
        return {
            "ids": stored_ids,
            "metadatas": [{"rule_number": i, "text": stored_texts[i]} for i in stored_ids],
        }

    col.get.side_effect = lambda ids=None, include=None: (
        get_all_side_effect(include=include) if ids is None else get_side_effect(ids=ids, include=include)
    )
    return col


# ---------------------------------------------------------------------------
# _lookup_by_rule_numbers unit tests
# ---------------------------------------------------------------------------

STORED_IDS = ["702.10", "702.10a", "702.10b", "201", "201.1", "201.1a", "100.1"]
STORED_TEXTS = {i: f"Text of rule {i}" for i in STORED_IDS}


def test_exact_match_returns_rule():
    col = _mock_collection(STORED_IDS, STORED_TEXTS)
    results = _lookup_by_rule_numbers(col, ["702.10b"])
    rule_numbers = [r["rule_number"] for r in results]
    assert "702.10b" in rule_numbers


def test_prefix_match_returns_subrules():
    """Querying '201' should return 201, 201.1, 201.1a."""
    col = _mock_collection(STORED_IDS, STORED_TEXTS)
    results = _lookup_by_rule_numbers(col, ["201"])
    rule_numbers = [r["rule_number"] for r in results]
    assert "201" in rule_numbers
    assert "201.1" in rule_numbers
    assert "201.1a" in rule_numbers


def test_no_match_returns_empty():
    col = _mock_collection(STORED_IDS, STORED_TEXTS)
    results = _lookup_by_rule_numbers(col, ["999.99z"])
    assert results == []


def test_multiple_refs_combined():
    col = _mock_collection(STORED_IDS, STORED_TEXTS)
    results = _lookup_by_rule_numbers(col, ["100.1", "702.10b"])
    rule_numbers = [r["rule_number"] for r in results]
    assert "100.1" in rule_numbers
    assert "702.10b" in rule_numbers


# ---------------------------------------------------------------------------
# retrieve() integration with intent routing
# ---------------------------------------------------------------------------

def test_retrieve_uses_direct_lookup_for_rule_lookup_intent():
    """When intent is rule_lookup, direct lookup must be attempted."""
    col = _mock_collection(STORED_IDS, STORED_TEXTS)

    with patch("agent.nodes.retrieve._get_collection", return_value=col):
        result = retrieve(_state("rule_lookup", ["702.10b"]))

    rules = result["retrieved_context"]["rules"]
    assert any(r["rule_number"] == "702.10b" for r in rules)


def test_retrieve_falls_back_to_semantic_when_no_direct_match():
    """When direct lookup returns nothing, semantic search must be used."""
    col = _mock_collection(STORED_IDS, STORED_TEXTS)
    semantic_result = [{"rule_number": "702.10b", "text": "Deathtouch.", "distance": 0.1}]

    with patch("agent.nodes.retrieve._get_collection", return_value=col), \
         patch("agent.nodes.retrieve.rules_search_fn", return_value=semantic_result):
        result = retrieve(_state("rule_lookup", ["999.99z"]))

    rules = result["retrieved_context"]["rules"]
    assert rules == semantic_result


def test_retrieve_uses_semantic_for_rules_question():
    """Non-rule_lookup intents must still use semantic search."""
    semantic_result = [{"rule_number": "702.10b", "text": "Deathtouch.", "distance": 0.1}]

    with patch("agent.nodes.retrieve.rules_search_fn", return_value=semantic_result):
        result = retrieve(_state("rules_question", [], message="does deathtouch kill everything?"))

    assert result["retrieved_context"]["rules"] == semantic_result
```

- [ ] **Step 2: Run — expect failure**

```
pytest tests/test_retrieve_rule_lookup.py -v
```

Expected: FAIL — `_lookup_by_rule_numbers` and `_get_collection` don't exist yet.

---

## Task 4: Implement direct lookup in `retrieve.py`

**Files:**
- Modify: `agent/nodes/retrieve.py`

- [ ] **Step 1: Extract a `_get_collection` helper and add `_lookup_by_rule_numbers`**

Replace the contents of `agent/nodes/retrieve.py` with:

```python
"""
retrieve.py — Context retrieval node for the MTG Judge pipeline.

Fetches relevant rules from ChromaDB and card data from Scryfall,
then stores the merged results in `retrieved_context`.
"""

import logging
from pathlib import Path

import chromadb

from agent.state import AgentState
from agent.tools.rules_search import search as rules_search_fn
from agent.tools.scryfall import get_card
from langchain_core.messages import HumanMessage

logger = logging.getLogger(__name__)

_CHROMA_PATH = "data/chroma_db"
_COLLECTION_NAME = "mtg_rules"


def _get_collection():
    """Return the live ChromaDB mtg_rules collection."""
    Path(_CHROMA_PATH).mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=_CHROMA_PATH)
    return client.get_or_create_collection(
        name=_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def _lookup_by_rule_numbers(collection, rule_references: list[str]) -> list[dict]:
    """
    Direct lookup for one or more rule numbers.

    1. Exact match: collection.get(ids=rule_references)
    2. Prefix scan: for any ref that had no exact hit, scan all IDs for those
       starting with "{ref}." (sub-rules) plus the exact ID if present.

    Returns a deduplicated list of {"rule_number": str, "text": str} dicts,
    or an empty list if nothing matched.
    """
    if not rule_references:
        return []

    # Step 1: exact lookup
    exact = collection.get(ids=rule_references, include=["metadatas"])
    matched_ids = set(exact["ids"])
    results = {
        meta["rule_number"]: meta
        for meta in exact["metadatas"]
    }

    # Step 2: prefix scan for any ref with no exact hit
    unmatched = [ref for ref in rule_references if ref not in matched_ids]
    if unmatched:
        all_data = collection.get(include=["metadatas"])
        all_metas = all_data["metadatas"]
        for ref in unmatched:
            prefix = ref + "."
            for meta in all_metas:
                rn = meta["rule_number"]
                if rn == ref or rn.startswith(prefix):
                    results[rn] = meta

    return [
        {"rule_number": m["rule_number"], "text": m["text"]}
        for m in results.values()
    ]


def retrieve(state: AgentState) -> dict:
    """
    Retrieve rules context and card data for the current query.

    - For rule_lookup intent: direct ChromaDB ID lookup (with prefix scan),
      falling back to semantic search if nothing found.
    - For all other intents: semantic similarity search (k=6).
    - Fetches each card in state["card_names"] from Scryfall; omits None results.
    """
    # --- Derive query from the latest human message ---
    query = ""
    for msg in reversed(state.get("messages", [])):
        if isinstance(msg, HumanMessage):
            query = msg.content if isinstance(msg.content, str) else str(msg.content)
            break

    # --- Rules retrieval ---
    intent = state.get("intent", "")
    rule_references = state.get("rule_references", [])

    if intent == "rule_lookup" and rule_references:
        try:
            collection = _get_collection()
            rules = _lookup_by_rule_numbers(collection, rule_references)
        except Exception as exc:
            logger.error("Direct rule lookup failed: %s", exc, exc_info=True)
            rules = []

        if not rules:
            logger.debug("Direct lookup found nothing for %r; falling back to semantic search.", rule_references)
            rules = rules_search_fn(query, k=6)
    else:
        rules = rules_search_fn(query, k=6)

    # --- Card retrieval ---
    fmt = state.get("format", "commander")
    cards = []
    for name in state.get("card_names", []):
        card = get_card(name)
        if card is not None:
            card["legality"] = card.get("legalities", {}).get(fmt, "unknown")
            card["format"] = fmt
            cards.append(card)
        else:
            logger.debug("Card %r not found or ambiguous; omitting from context.", name)

    return {
        "retrieved_context": {
            "rules": rules,
            "cards": cards,
        }
    }
```

- [ ] **Step 2: Run the tests — expect pass**

```
pytest tests/test_retrieve_rule_lookup.py -v
```

Expected: all tests PASS.

- [ ] **Step 3: Run the full test suite to check for regressions**

```
pytest tests/ -v --ignore=tests/property -m "not integration"
```

Expected: all non-integration tests PASS.

- [ ] **Step 4: Commit**

```bash
git add agent/nodes/retrieve.py tests/test_retrieve_rule_lookup.py
git commit -m "feat: add direct rule number lookup to retrieve node"
```

---

## Task 5: Smoke test end-to-end (integration)

This task requires a running environment with `ANTHROPIC_API_KEY` and a populated ChromaDB.

- [ ] **Step 1: Start the API**

```
uvicorn api.main:app --reload
```

- [ ] **Step 2: Send a direct rule number query**

```bash
curl -s -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"message": "702.10b", "format": "commander", "history": []}' | python -m json.tool
```

Expected: response contains the text of rule 702.10b and judge commentary.

- [ ] **Step 3: Confirm incidental number is not treated as rule lookup**

```bash
curl -s -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"message": "what if i have 302 tokens and my opponent attacks", "format": "commander", "history": []}' | python -m json.tool
```

Expected: response answers the gameplay question; does NOT say "here is rule 302".

- [ ] **Step 4: Confirm partial number returns sub-rules**

```bash
curl -s -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"message": "201", "format": "commander", "history": []}' | python -m json.tool
```

Expected: response covers rule 201 and its sub-rules.
