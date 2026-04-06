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
