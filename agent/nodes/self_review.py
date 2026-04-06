"""
self_review.py — Citation verification node for the MTG Judge pipeline.

Calls Claude Sonnet 4.6 to verify that:
  - Cited rule numbers appear in the retrieved context
  - The answer does not contradict any retrieved rule text
  - Legality status is correctly stated

Returns `approved`, `needs_fix`, or `uncertain` via `self_review_status`.
When `uncertain`, prepends a warning to `draft_answer`.
"""

import logging
from pydantic import BaseModel, Field
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from agent.state import AgentState

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Structured output schema
# ---------------------------------------------------------------------------

class ReviewVerdict(BaseModel):
    """Structured output for self-review verdict."""

    verdict: str = Field(
        description=(
            "The review verdict. Must be one of: approved, needs_fix, uncertain.\n"
            "- approved: All cited rules are present in context, answer is consistent, legality is correct.\n"
            "- needs_fix: One or more cited rules are missing from context, or the answer contradicts a rule, "
            "or legality is misstated.\n"
            "- uncertain: The answer may be correct but confidence is low; cannot fully verify."
        )
    )
    reasoning: str = Field(
        description="Brief explanation of the verdict (1-3 sentences)."
    )


# ---------------------------------------------------------------------------
# LLM setup
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """<instructions>
You are a strict Magic: The Gathering rules judge performing a quality review.
Verify the draft answer against the retrieved context ONLY. Do not use outside knowledge.
</instructions>

<output_format>
Run all four checks:

1. CITATION CHECK: Every rule number cited in the draft answer (format: "rule XXX.X" or "rule XXX.Xa") must appear in the retrieved rules context. If any cited rule number is NOT present in the context, the answer needs a fix.
2. CONTRADICTION CHECK: The draft answer must not contradict any statement in the retrieved rules or card context. If it does, the answer needs a fix.
3. LEGALITY CHECK: Any legality claims (banned, restricted, not_legal, legal) must match the card context exactly. If a legality claim is wrong or missing when required, the answer needs a fix.
4. RELEVANCE CHECK: Every cited rule must directly support the answer. If any citation is decorative or tangential — present in context but not used in the reasoning — the answer needs a fix.

Verdict rules:
- Return "approved" if all four checks pass.
- Return "needs_fix" if any check fails and you are confident about the failure.
- Return "uncertain" if you cannot confidently verify the answer (e.g. the context is sparse or ambiguous).
</output_format>"""

_UNCERTAIN_WARNING = "⚠️ I'm not fully certain — please verify with a certified judge."


def _get_llm() -> ChatAnthropic:
    return ChatAnthropic(model="claude-sonnet-4-6", temperature=0, max_tokens=512)


# ---------------------------------------------------------------------------
# Context formatting
# ---------------------------------------------------------------------------

def _format_rules_context(rules: list[dict]) -> str:
    if not rules:
        return "No rules retrieved."
    lines = []
    for chunk in rules:
        rule_number = chunk.get("rule_number", "")
        text = chunk.get("text", "")
        lines.append(f"[rule {rule_number}] {text}")
    return "\n\n".join(lines)


def _format_cards_context(cards: list[dict]) -> str:
    if not cards:
        return "No card data retrieved."
    lines = []
    for card in cards:
        name = card.get("name", "Unknown")
        oracle = card.get("oracle_text", "")
        type_line = card.get("type_line", "")
        legality = card.get("legality", "")
        fmt = card.get("format", "")
        card_block = [
            f"Card: {name}",
            f"Type: {type_line}",
            f"Oracle text: {oracle}",
            f"Legality in {fmt}: {legality}",
        ]
        lines.append("\n".join(card_block))
    return "\n\n---\n\n".join(lines)


# ---------------------------------------------------------------------------
# Node function
# ---------------------------------------------------------------------------

def self_review(state: AgentState) -> dict:
    """
    Verify the draft answer against retrieved context.

    Returns a partial state dict with `self_review_status` and optionally
    an updated `draft_answer` (when verdict is `uncertain`).
    """
    retrieved_context = state.get("retrieved_context", {})
    rules = retrieved_context.get("rules", [])
    cards = retrieved_context.get("cards", [])
    draft_answer = state.get("draft_answer", "") or ""

    # --- Build context block ---
    rules_text = _format_rules_context(rules)
    cards_text = _format_cards_context(cards)

    review_prompt = (
        "<context>\n"
        "<rules>\n"
        f"{rules_text}\n"
        "</rules>\n\n"
        "<cards>\n"
        f"{cards_text}\n"
        "</cards>\n"
        "</context>\n\n"
        "<draft_answer>\n"
        f"{draft_answer}\n"
        "</draft_answer>\n\n"
        "Verify the draft answer against the retrieved context and return your verdict."
    )

    # --- Call Claude with structured output ---
    llm = _get_llm()
    structured_llm = llm.with_structured_output(ReviewVerdict)

    result: ReviewVerdict = structured_llm.invoke(
        [
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=review_prompt),
        ]
    )

    # --- Validate verdict domain ---
    valid_verdicts = {"approved", "needs_fix", "uncertain"}
    verdict = result.verdict if result.verdict in valid_verdicts else "uncertain"

    logger.debug("self_review verdict=%s reasoning=%s", verdict, result.reasoning)

    # --- Build partial state update ---
    update: dict = {"self_review_status": verdict}

    # --- Uncertain path: prepend warning to draft_answer ---
    if verdict == "uncertain":
        update["draft_answer"] = f"{_UNCERTAIN_WARNING}\n\n{draft_answer}"

    return update
