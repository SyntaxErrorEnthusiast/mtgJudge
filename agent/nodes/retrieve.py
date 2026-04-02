"""
retrieve.py — Context retrieval node for the MTG Judge pipeline.

Fetches relevant rules from ChromaDB and card data from Scryfall,
then stores the merged results in `retrieved_context`.
"""

import logging

from agent.state import AgentState
from agent.tools.rules_search import search as rules_search_fn
from agent.tools.scryfall import get_card
from langchain_core.messages import HumanMessage

logger = logging.getLogger(__name__)


def retrieve(state: AgentState) -> dict:
    """
    Retrieve rules context and card data for the current query.

    - Queries ChromaDB with the latest user message (k=6).
    - Fetches each card in state["card_names"] from Scryfall; omits None results.
    - Returns a partial state dict containing only `retrieved_context`.
    """
    # --- Derive query from the latest human message ---
    query = ""
    for msg in reversed(state.get("messages", [])):
        if isinstance(msg, HumanMessage):
            query = msg.content if isinstance(msg.content, str) else str(msg.content)
            break

    # --- Rules retrieval (Requirement 5.1) ---
    rules = rules_search_fn(query, k=6)

    # --- Card retrieval (Requirements 5.2, 5.3, 5.4) ---
    fmt = state.get("format", "commander")
    cards = []
    for name in state.get("card_names", []):
        card = get_card(name, fmt)
        if card is not None:
            cards.append(card)
        else:
            logger.debug("Card %r not found or ambiguous; omitting from context.", name)

    return {
        "retrieved_context": {
            "rules": rules,
            "cards": cards,
        }
    }
