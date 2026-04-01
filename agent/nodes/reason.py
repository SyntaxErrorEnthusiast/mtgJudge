"""
reason.py — Answer synthesis node for the MTG Judge pipeline.

Calls Claude Sonnet 4.5 to synthesize a cited answer from retrieved context.
Prepends legality notes for banned/restricted/not_legal cards.
Stores the result in `draft_answer`.
"""

import logging
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from agent.state import AgentState

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LLM setup
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """<instructions>
You are an expert Magic: The Gathering rules judge delivering an official ruling.
Answer using ONLY the retrieved context provided. Do not use outside knowledge.
</instructions>

<output_format>
- Use "According to rule XXX.Xa, ..." or "Rule XXX.Xa states that ..." for every citation. Never use "based on", "it seems", or hedging language.
- Cite rules using the exact format: rule XXX.Xa (e.g. rule 702.19, rule 100.1a, rule 303.4b). Always include the sub-number — never cite a chapter alone (e.g. never "rule 702", always "rule 702.1" or the specific subrule).
- Only cite rules that directly answer the question. Do not cite rules that are present in the context but tangential to the answer.
- If the context does not contain enough information to fully answer, say so clearly.
- Do not invent rules or card text not present in the context.
- Do not include a Sources section — that is built separately.
</output_format>"""


def _get_llm() -> ChatAnthropic:
    return ChatAnthropic(model="claude-sonnet-4-5", temperature=0, max_tokens=1024)


# ---------------------------------------------------------------------------
# Legality note helpers (Requirements 6.3, 6.4, 6.5, 6.6)
# ---------------------------------------------------------------------------

def _build_legality_notes(cards: list[dict]) -> str:
    """
    Build prepended legality notes for banned/restricted/not_legal cards.
    Returns an empty string when all cards are legal.
    """
    notes = []
    for card in cards:
        legality = card.get("legality", "legal")
        name = card.get("name", "Unknown")
        fmt = card.get("format", "")

        if legality == "banned":
            notes.append(f"Note: {name} is **banned** in {fmt}.")
        elif legality == "restricted":
            notes.append(f"Note: {name} is **restricted** to one copy in {fmt}.")
        elif legality == "not_legal":
            notes.append(f"Note: {name} is not legal in {fmt}.")
        # "legal" → no note (Requirement 6.6)

    return "\n".join(notes)


# ---------------------------------------------------------------------------
# Context formatting helpers
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
        rulings = card.get("rulings", [])

        card_block = [
            f"Card: {name}",
            f"Type: {type_line}",
            f"Oracle text: {oracle}",
            f"Legality in {fmt}: {legality}",
        ]
        if rulings:
            ruling_texts = [r.get("comment", "") for r in rulings if r.get("comment")]
            if ruling_texts:
                card_block.append("Rulings:\n" + "\n".join(f"- {r}" for r in ruling_texts))

        lines.append("\n".join(card_block))
    return "\n\n---\n\n".join(lines)


# ---------------------------------------------------------------------------
# Node function
# ---------------------------------------------------------------------------

def reason(state: AgentState) -> dict:
    """
    Synthesize an answer from retrieved context using Claude Sonnet 4.5.

    Returns a partial state dict with only `draft_answer`.
    """
    retrieved_context = state.get("retrieved_context", {})
    rules = retrieved_context.get("rules", [])
    cards = retrieved_context.get("cards", [])

    # --- Build context block for the LLM ---
    rules_text = _format_rules_context(rules)
    cards_text = _format_cards_context(cards)

    context_block = (
        "<context>\n"
        "<rules>\n"
        f"{rules_text}\n"
        "</rules>\n\n"
        "<cards>\n"
        f"{cards_text}\n"
        "</cards>\n"
        "</context>"
    )

    # --- Extract the latest human message ---
    user_question = ""
    for msg in reversed(state.get("messages", [])):
        if isinstance(msg, HumanMessage):
            user_question = msg.content if isinstance(msg.content, str) else str(msg.content)
            break

    # --- Call Claude (Requirement 6.1) ---
    llm = _get_llm()
    response = llm.invoke(
        [
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=f"{context_block}\n\nUser question: {user_question}"),
        ]
    )

    llm_answer = response.content if isinstance(response.content, str) else str(response.content)

    # --- Prepend legality notes (Requirements 6.3, 6.4, 6.5) ---
    legality_notes = _build_legality_notes(cards)
    if legality_notes:
        draft_answer = f"{legality_notes}\n\n{llm_answer}"
    else:
        draft_answer = llm_answer

    return {"draft_answer": draft_answer}
