"""
indexer.py — Embed rule chunks and write them to ChromaDB atomically.

Atomic swap strategy:
  1. Build a new collection with a temporary name
  2. Rename (swap) to the canonical name
  3. Delete the old collection

This ensures the live collection is never in a partial state.
"""

import logging
from pathlib import Path

import chromadb

from agent.embeddings import get_embedding_provider
from agent.knowledge_base.parser import RuleChunk

logger = logging.getLogger(__name__)

_CHROMA_PATH = "data/chroma_db"
_COLLECTION_NAME = "mtg_rules"
_TEMP_COLLECTION_NAME = "mtg_rules_new"
_BATCH_SIZE = 100


def index_chunks(chunks: list[RuleChunk]) -> None:
    """Embed all chunks and write them to ChromaDB atomically.

    Args:
        chunks: List of RuleChunk objects from the parser.
    """
    Path(_CHROMA_PATH).mkdir(parents=True, exist_ok=True)

    provider = get_embedding_provider()
    client = chromadb.PersistentClient(path=_CHROMA_PATH)

    # Delete temp collection if it exists from a previous failed run
    try:
        client.delete_collection(_TEMP_COLLECTION_NAME)
        logger.debug("Deleted stale temp collection.")
    except Exception:
        pass

    # Build new collection
    new_collection = client.create_collection(
        name=_TEMP_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    # Deduplicate by rule_number — keep last occurrence so body text wins over TOC entries
    seen: dict[str, RuleChunk] = {}
    for chunk in chunks:
        seen[chunk.rule_number] = chunk
    chunks = list(seen.values())

    texts = [chunk.text for chunk in chunks]
    ids = [chunk.rule_number for chunk in chunks]
    metadatas = [{"rule_number": chunk.rule_number, "text": chunk.text} for chunk in chunks]

    logger.info("Embedding %d chunks in batches of %d...", len(chunks), _BATCH_SIZE)

    for i in range(0, len(chunks), _BATCH_SIZE):
        batch_texts = texts[i:i + _BATCH_SIZE]
        batch_ids = ids[i:i + _BATCH_SIZE]
        batch_metadatas = metadatas[i:i + _BATCH_SIZE]

        embeddings = provider.embed_documents(batch_texts)

        new_collection.add(
            ids=batch_ids,
            embeddings=embeddings,
            metadatas=batch_metadatas,
        )
        logger.debug("Indexed batch %d/%d", i // _BATCH_SIZE + 1, (len(chunks) + _BATCH_SIZE - 1) // _BATCH_SIZE)

    # Atomic swap: delete old, rename new
    try:
        client.delete_collection(_COLLECTION_NAME)
        logger.debug("Deleted old collection.")
    except Exception:
        pass

    # ChromaDB doesn't have a rename — recreate under canonical name
    final_collection = client.create_collection(
        name=_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    # Copy data from temp to final — pass limit=count() to avoid ChromaDB's default 100 truncation
    result = new_collection.get(include=["embeddings", "metadatas"], limit=new_collection.count())
    if result["ids"]:
        final_collection.add(
            ids=result["ids"],
            embeddings=result["embeddings"],
            metadatas=result["metadatas"],
        )

    client.delete_collection(_TEMP_COLLECTION_NAME)
    logger.info("Indexing complete. %d rules in collection.", final_collection.count())
