"""
updater.py — Download → SHA-256 diff → re-index pipeline for MTG rules.

Skips re-indexing if the rules file hasn't changed since the last run.
"""

import hashlib
import logging
from pathlib import Path

import httpx

from agent.knowledge_base.parser import parse_rules
from agent.knowledge_base.indexer import index_chunks

logger = logging.getLogger(__name__)

_RULES_URL = "https://media.wizards.com/2025/downloads/MagicCompRules%2020250404.txt"
_HASH_FILE = Path("data/rules_hash.txt")
_DATA_DIR = Path("data")


def run() -> None:
    """Run the full download → diff → re-index pipeline.

    If the downloaded rules match the stored hash, skips re-indexing.
    """
    _DATA_DIR.mkdir(parents=True, exist_ok=True)

    logger.info("Downloading MTG comprehensive rules...")
    try:
        response = httpx.get(_RULES_URL, follow_redirects=True, timeout=60)
        response.raise_for_status()
    except Exception as exc:
        logger.error("Failed to download rules: %s", exc)
        raise

    content = response.content
    new_hash = hashlib.sha256(content).hexdigest()

    # Compare against stored hash
    stored_hash = ""
    if _HASH_FILE.exists():
        stored_hash = _HASH_FILE.read_text().strip()

    if new_hash == stored_hash:
        logger.info("Rules unchanged, skipping re-indexing.")
        return

    logger.info("Rules changed (or first run). Parsing and indexing...")

    # Decode — try UTF-8 first, fall back to latin-1
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    chunks = parse_rules(text)
    logger.info("Parsed %d rule chunks.", len(chunks))

    index_chunks(chunks)

    _HASH_FILE.write_text(new_hash)
    logger.info("Rules updated and hash saved.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    run()
