"""
rules_url.py — Dynamically resolve the latest MTG Comprehensive Rules TXT URL.

Scrapes https://magic.wizards.com/en/rules and extracts the .txt download link.
"""

import logging
import re

import httpx

logger = logging.getLogger(__name__)

_RULES_PAGE = "https://magic.wizards.com/en/rules"
_TXT_PATTERN = re.compile(r'https://media\.wizards\.com/\d+/downloads/MagicCompRules[^"\'>\s]+\.txt')


def get_rules_txt_url() -> str:
    """Fetch the rules page and return the current TXT download URL.

    Raises RuntimeError if no TXT link is found.
    """
    logger.info("Fetching rules page to resolve TXT URL...")
    response = httpx.get(_RULES_PAGE, follow_redirects=True, timeout=30)
    response.raise_for_status()

    match = _TXT_PATTERN.search(response.text)
    if not match:
        raise RuntimeError("Could not find MagicCompRules .txt URL on the rules page.")

    url = match.group(0)
    logger.info("Resolved rules TXT URL: %s", url)
    return url
