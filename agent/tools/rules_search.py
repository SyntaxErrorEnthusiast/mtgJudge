"""
rules_search.py — ChromaDB-backed semantic search over MTG comprehensive rules.

Exposes a single function:
    search(query: str, k: int = 6) -> list[dict]
"""

import logging
from pathlib import Path

import chromadb

from agent.embeddings import get_embedding_provider

logger = logging.getLogger(__name__)

_CHROMA_PATH = "data/chroma_db"
_COLLECTION_NAME = "mtg_rules"


def search(query: str, k: int = 6) -> list[dict]:
    """Search the MTG rules knowledge base for chunks relevant to *query*.

    Args:
        query: Natural-language question or keyword string to search for.
        k:     Number of results to return (default 6).

    Returns:
        A list of dicts, each with shape::

            {"rule_number": str, "text": str, "distance": float}

        Returns an empty list if the collection is empty or ChromaDB raises
        an exception.
    """
    try:
        Path(_CHROMA_PATH).mkdir(parents=True, exist_ok=True)

        client = chromadb.PersistentClient(path=_CHROMA_PATH)
        collection = client.get_or_create_collection(
            name=_COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

        # Bail out early if the collection is empty to avoid a ChromaDB error.
        if collection.count() == 0:
            logger.warning("Collection %r is empty; returning no results.", _COLLECTION_NAME)
            return []

        query_embedding = get_embedding_provider().embed_query(query)

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=k,
            include=["metadatas", "distances"],
        )

        metadatas = results["metadatas"][0]
        distances = results["distances"][0]

        return [
            {
                "rule_number": meta["rule_number"],
                "text": meta["text"],
                "distance": dist,
            }
            for meta, dist in zip(metadatas, distances)
        ]

    except Exception as exc:
        logger.error("rules_search failed: %s", exc, exc_info=True)
        return []
