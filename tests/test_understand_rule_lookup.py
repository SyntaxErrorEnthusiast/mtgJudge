from unittest.mock import MagicMock, patch
from langchain_core.messages import HumanMessage

from agent.nodes.understand import understand, IntentClassification


def _state(text: str) -> dict:
    return {
        "messages": [HumanMessage(content=text)],
        "turn_count": 0,
    }


def _mock_llm(intent: str, rule_refs: list[str]):
    """Return a mock structured LLM that yields a fixed IntentClassification."""
    result = IntentClassification(
        intent=intent,
        card_names=[],
        rule_references=rule_refs,
        clarifying_question=None,
    )
    mock_structured = MagicMock()
    mock_structured.invoke.return_value = result
    mock_llm = MagicMock()
    mock_llm.with_structured_output.return_value = mock_structured
    return mock_llm


def test_rule_lookup_intent_is_stored():
    """rule_lookup returned by LLM must be stored in state."""
    with patch("agent.nodes.understand._get_llm", return_value=_mock_llm("rule_lookup", ["702.10b"])):
        result = understand(_state("702.10b"))
    assert result["intent"] == "rule_lookup"


def test_rule_lookup_rule_references_stored():
    """rule_references must pass through when intent is rule_lookup."""
    with patch("agent.nodes.understand._get_llm", return_value=_mock_llm("rule_lookup", ["302.6"])):
        result = understand(_state("what does rule 302.6 say?"))
    assert result["rule_references"] == ["302.6"]


def test_unknown_intent_falls_back_to_unclear():
    """An unrecognised intent string must be normalised to 'unclear'."""
    with patch("agent.nodes.understand._get_llm", return_value=_mock_llm("bogus_intent", [])):
        result = understand(_state("something"))
    assert result["intent"] == "unclear"
