# tests/property/test_respond_properties.py
"""Unit tests for the Sources post-processor in respond.py."""

import pytest

# Import will fail until Task 6 implements _build_sources_block — that's expected.
from agent.nodes.respond import _build_sources_block


SAMPLE_RULES = [
    {"rule_number": "700.4", "text": "700. General\nA token is a permanent..."},
    {"rule_number": "701.2", "text": "701. Keyword Actions\nActivate means..."},
]

SAMPLE_CARDS = [
    {
        "name": "Lightning Bolt",
        "type_line": "Instant",
        "oracle_text": "Lightning Bolt deals 3 damage to any target.",
    }
]


def test_no_citations_includes_cards():
    # Feature: mtg-judge-agent, Property 1: No rule citations → cards still appear in Sources
    draft = "The creature enters the battlefield without any rules cited."
    result = _build_sources_block(draft, {"rules": SAMPLE_RULES, "cards": SAMPLE_CARDS})
    assert "## Sources" in result
    assert "Lightning Bolt" in result
    assert "700.4" not in result


def test_cited_rule_appears_in_sources():
    # Feature: mtg-judge-agent, Property 2: Cited rule found → full text appears in Sources
    draft = "According to rule 700.4, a token is a permanent."
    result = _build_sources_block(draft, {"rules": SAMPLE_RULES, "cards": []})
    assert "**Rule 700.4**" in result
    assert "A token is a permanent" in result


def test_hallucinated_rule_omitted():
    # Feature: mtg-judge-agent, Property 3: Rule number not in retrieved_context → silently omitted
    draft = "According to rule 999.99, something magical happens."
    result = _build_sources_block(draft, {"rules": SAMPLE_RULES, "cards": []})
    assert "999.99" not in result


def test_citations_deduplicated_first_appearance_order():
    # Feature: mtg-judge-agent, Property 4: Duplicate citations deduplicated; order preserved
    draft = "Rule 700.4 says X. Rule 701.2 says Y. Rule 700.4 again."
    result = _build_sources_block(draft, {"rules": SAMPLE_RULES, "cards": []})
    idx_700 = result.index("700.4")
    idx_701 = result.index("701.2")
    assert idx_700 < idx_701
    assert result.count("700.4") == 1


def test_cards_appear_after_rules():
    # Feature: mtg-judge-agent, Property 5: Cards always listed after rules in Sources
    draft = "According to rule 700.4, the creature dies."
    result = _build_sources_block(draft, {"rules": SAMPLE_RULES, "cards": SAMPLE_CARDS})
    idx_rule = result.index("700.4")
    idx_card = result.index("Lightning Bolt")
    assert idx_rule < idx_card


def test_empty_context_returns_empty_string():
    # Feature: mtg-judge-agent, Property 6: Empty retrieved_context → no Sources block appended
    draft = "The creature dies."
    result = _build_sources_block(draft, {})
    assert result == ""


def test_no_citations_no_cards_returns_empty_string():
    # Feature: mtg-judge-agent, Property 7: Rules in context but none cited, no cards → no Sources block
    draft = "The creature dies."
    result = _build_sources_block(draft, {"rules": SAMPLE_RULES, "cards": []})
    assert result == ""


def test_clarifying_question_path_no_sources_block():
    # Feature: mtg-judge-agent, Property 8: Clarifying question path → no Sources block appended
    from agent.state import AgentState
    from langchain_core.messages import HumanMessage
    state = AgentState(
        messages=[HumanMessage(content="What happens?")],
        intent="unclear",
        pending_response="Could you clarify which cards are involved?",
        retrieved_context={"rules": SAMPLE_RULES, "cards": SAMPLE_CARDS},
        draft_answer="",
    )
    from agent.nodes.respond import respond
    result = respond(state)
    content = result["messages"][0].content
    assert "## Sources" not in content
    assert content == "Could you clarify which cards are involved?"
