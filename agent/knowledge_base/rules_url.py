"""
rules_url.py — Dynamically resolve the latest MTG Comprehensive Rules TXT URL.

Scrapes https://magic.wizards.com/en/rules and extracts the .txt download link.
"""

import logging
import re

import httpx

logger = logging.getLogger(__name__)

_RULES_PAGE = "https://magic.wizards.com/en/rules"
# Matches both underscore and %20-encoded space variants, e.g.:
#   MagicCompRules_20260227.txt
#   MagicCompRules%2020260227.txt
_TXT_PATTERN = re.compile(
    r'https://media\.wizards\.com/\d+/downloads/MagicCompRules[^"\'>\s]*\.txt'
)


def get_rules_txt_url() -> str:
    """Fetch the rules page and return the current TXT download URL.

    The Wizards rules page is JS-rendered, so the static HTML response may not
    contain the download links. We try the static fetch first, then fall back to
    probing recent known URL patterns on media.wizards.com.

    Raises RuntimeError if no TXT link can be resolved.
    """
    logger.info("Fetching rules page to resolve TXT URL...")
    response = httpx.get(_RULES_PAGE, follow_redirects=True, timeout=30)
    response.raise_for_status()

    match = _TXT_PATTERN.search(response.text)
    if match:
        url = match.group(0)
        logger.info("Resolved rules TXT URL from page: %s", url)
        return url

    # Fallback: the page is JS-rendered so httpx gets bare HTML without the links.
    # Probe recent known URL patterns (rules update a few times a year).
    logger.info("Rules URL not found in static HTML; probing known URL pattern...")
    url = _probe_recent_rules_url()
    if url:
        logger.info("Resolved rules TXT URL via probe: %s", url)
        return url

    raise RuntimeError("Could not find MagicCompRules .txt URL on the rules page.")


def _probe_recent_rules_url() -> str | None:
    """Try recent MagicCompRules URLs and return the first that responds 200.

    Rules are released a few times a year, so we probe weekly going back 6 months.
    """
    from datetime import datetime, timezone, timedelta

    base = "https://media.wizards.com/{year}/downloads/MagicCompRules%20{date}.txt"
    today = datetime.now(timezone.utc)
    for weeks_ago in range(0, 26):
        candidate_date = today - timedelta(weeks=weeks_ago)
        url = base.format(
            year=candidate_date.year,
            date=candidate_date.strftime("%Y%m%d"),
        )
        try:
            r = httpx.head(url, follow_redirects=True, timeout=10)
            if r.status_code == 200:
                return url
        except httpx.RequestError:
            continue
    return None
