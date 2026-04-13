"""
respond.py — Final response node for the MTG Judge pipeline.

Appends the appropriate AIMessage to the conversation and increments
turn_count on normal and clarifying-question paths.

On the normal path, appends a deterministic ## Sources block built from
cited rule numbers and all retrieved card data.
"""

import re

from langchain_core.messages import AIMessage

from agent.state import AgentState

TURN_LIMIT_MESSAGE = (
    "This conversation has reached its limit — please start a new chat to continue."
)

_RULE_CITATION_RE = re.compile(r"rule (\d+\.\d+[a-z]?)", re.IGNORECASE)


def _build_sources_block(draft_answer: str, retrieved_context: dict) -> str:
    """
    Build a ## Sources markdown block from cited rule numbers and retrieved cards.

    Rules:
    - Scans draft_answer for pattern `rule \\d+\\.\\d+[a-z]?` (case-insensitive).
    - Looks up each captured rule number (lowercased) against retrieved_context["rules"].
    - Includes full rule text for matches; silently omits misses.
    - Always appends all cards from retrieved_context["cards"] after rules.
    - Returns "" if nothing to show (no citations found + no cards).
    """
    rules = retrieved_context.get("rules", [])
    cards = retrieved_context.get("cards", [])

    if not rules and not cards:
        return ""

    # Build lookup: lowercase rule_number → full text
    rules_by_number = {r["rule_number"].lower(): r["text"] for r in rules}

    # Extract cited rule numbers in first-appearance order, deduplicated
    seen: set[str] = set()
    cited_numbers: list[str] = []
    for match in _RULE_CITATION_RE.finditer(draft_answer):
        num = match.group(1).lower()
        if num not in seen:
            seen.add(num)
            cited_numbers.append(num)

    source_lines: list[str] = []

    # Rules first, in citation order
    for num in cited_numbers:
        text = rules_by_number.get(num)
        if text:
            source_lines.append(f'- **Rule {num}**: "{text}"')

    # Cards after rules, in insertion order
    for card in cards:
        name = card.get("name", "")
        type_line = card.get("type_line", "")
        oracle_text = card.get("oracle_text", "")
        source_lines.append(f'- **{name}** *({type_line})*: "{oracle_text}"')

    if not source_lines:
        return ""

    return "\n\n## Sources\n" + "\n".join(source_lines)


def respond(state: AgentState) -> dict:
    """
    Emit the final AIMessage and update turn_count.

    Paths:
    - turn_limit: append hardcoded limit message; do NOT increment turn_count
    - unclear + pending_response set: append pending_response; increment turn_count
    - normal: append draft_answer + Sources block; increment turn_count
    """
    intent = state.get("intent", "")

    # --- Clarifying question path ---
    if intent == "unclear" and state.get("pending_response"):
        return {
            "messages": [AIMessage(content=state["pending_response"])],
            "turn_count": state.get("turn_count", 0) + 1,
        }

    # --- Normal path ---
    draft = state.get("draft_answer", "")
    retrieved_context = state.get("retrieved_context", {})
    sources_block = _build_sources_block(draft, retrieved_context)

    return {
        "messages": [AIMessage(content=draft + sources_block)],
        "turn_count": state.get("turn_count", 0) + 1,
    }
