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
    2. Prefix scan: always scans all IDs for each ref to collect sub-rules (IDs
       starting with "{ref}."), so e.g. "201" returns "201" AND "201.1", "201.1a".

    Returns a deduplicated list of {"rule_number": str, "text": str} dicts,
    or an empty list if nothing matched.
    """
    if not rule_references:
        return []

    # Step 1: exact lookup
    exact = collection.get(ids=rule_references, include=["metadatas"])
    results = {
        meta["rule_number"]: meta
        for meta in exact["metadatas"]
    }

    # Step 2: prefix scan for sub-rules (always run, not just for unmatched refs)
    # e.g. querying "201" should also return "201.1", "201.1a", etc.
    all_data = collection.get(include=["metadatas"])
    all_metas = all_data["metadatas"]
    for ref in rule_references:
        prefix = ref + "."
        for meta in all_metas:
            rn = meta["rule_number"]
            if rn.startswith(prefix):
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
