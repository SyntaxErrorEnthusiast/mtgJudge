#!/usr/bin/env python3
"""Cron script to refresh the MTG comprehensive rules knowledge base.

Run directly:
    python scripts/refresh_rules.py

Example cron entry (monthly):
    0 0 1 * * /path/to/venv/bin/python /path/to/scripts/refresh_rules.py
"""

import sys
from pathlib import Path

# Allow running from the repo root without installing the package.
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

from agent.knowledge_base import updater

if __name__ == "__main__":
    updater.run()
