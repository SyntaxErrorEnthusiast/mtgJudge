"""
retrieve.py — Context retrieval node for the MTG Judge pipeline.

Fetches relevant rules from ChromaDB and card data from Scryfall,
then stores the merged results in `retrieved_context`.
"""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
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
    2. Prefix scan: uses ChromaDB `where` filter to avoid loading all metadata.
       Fetches sub-rules (IDs starting with "{ref}.") for each ref.

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

    # Step 2: prefix scan using where filter — avoids loading all metadata
    for ref in rule_references:
        prefix = ref + "."
        try:
            sub = collection.get(
                where={"rule_number": {"$gte": prefix, "$lt": prefix[:-1] + chr(ord(prefix[-2]) + 1)}},
                include=["metadatas"],
            )
            for meta in sub["metadatas"]:
                results[meta["rule_number"]] = meta
        except Exception:
            # ChromaDB where filters may not support range on all versions; fall back to full scan
            all_data = collection.get(include=["metadatas"])
            for meta in all_data["metadatas"]:
                rn = meta["rule_number"]
                if rn.startswith(prefix):
                    results[rn] = meta
            break  # one fallback covers all refs

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

    # --- Card retrieval (parallel) ---
    fmt = state.get("format", "commander")
    card_names = state.get("card_names", [])
    cards = []

    if card_names:
        def _fetch(name: str) -> dict | None:
            card = get_card(name)
            if card is not None:
                card["legality"] = card.get("legalities", {}).get(fmt, "unknown")
                card["format"] = fmt
                return card
            logger.debug("Card %r not found or ambiguous; omitting from context.", name)
            return None

        with ThreadPoolExecutor(max_workers=min(len(card_names), 4)) as executor:
            futures = {executor.submit(_fetch, name): name for name in card_names}
            for future in as_completed(futures):
                result = future.result()
                if result is not None:
                    cards.append(result)

    return {
        "retrieved_context": {
            "rules": rules,
            "cards": cards,
        }
    }
