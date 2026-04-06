"""
understand.py — Intent classification node for the MTG Judge pipeline.

Classifies the user's intent and extracts card names + rule references.
Short-circuits to "turn_limit" when turn_count >= 10 without calling the LLM.
"""

from typing import Optional
from pydantic import BaseModel, Field
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage

from agent.state import AgentState


# ---------------------------------------------------------------------------
# Structured output schema
# ---------------------------------------------------------------------------

class IntentClassification(BaseModel):
    """Structured output for intent classification."""

    intent: str = Field(
        description=(
            "The classified intent of the user message. "
            "Must be one of: rules_question, card_question, combo_question, unclear, rule_lookup."
        )
    )
    card_names: list[str] = Field(
        default_factory=list,
        description="Card names explicitly mentioned or clearly implied in the message.",
    )
    rule_references: list[str] = Field(
        default_factory=list,
        description="Rule numbers referenced in the message (e.g. '702.19', '100.1a').",
    )
    clarifying_question: Optional[str] = Field(
        default=None,
        description=(
            "When intent is 'unclear', a concise clarifying question to ask the user. "
            "Leave null for all other intents."
        ),
    )


# ---------------------------------------------------------------------------
# LLM setup
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """<instructions>
You are an expert Magic: The Gathering rules judge assistant.

Your task is to classify the user's question and extract relevant entities.
</instructions>

<context>
Intent categories:
- rules_question: The user is asking about a specific rule, mechanic, or interaction that does not require knowing a specific card's oracle text.
- card_question: The user is asking about a specific card's text, abilities, or rulings.
- combo_question: The user is asking about an interaction or combo between two or more cards.
- rule_lookup: The user's clear purpose is to retrieve a specific rule by its number. Use this ONLY when the message is essentially a rule number (e.g. "702.10b", "what does rule 302.6 say?"). Do NOT use this when a number appears incidentally in a gameplay question (e.g. "if I have 302 tokens" or "can I do this with 201 life").
- unclear: The question is ambiguous, incomplete, or cannot be classified without more information.

Entity extraction:
- card_names: Any Magic card names mentioned (use the exact name as written by the user).
- rule_references: Any rule numbers mentioned (e.g. "702.19", "100.1a", "rule 303.4").
- clarifying_question: Only when intent is "unclear" — write a short, helpful question to clarify what the user needs.
</context>"""


def _get_llm() -> ChatAnthropic:
    return ChatAnthropic(model="claude-sonnet-4-6", temperature=0, max_tokens=512)


# ---------------------------------------------------------------------------
# Node function
# ---------------------------------------------------------------------------

def understand(state: AgentState) -> dict:
    """
    Classify intent and extract entities from the latest user message.

    Returns a partial state dict with only the fields this node modifies.
    """
    # --- Turn limit short-circuit (Requirement 3.5, 4.1) ---
    if state.get("turn_count", 0) >= 10:
        return {
            "intent": "turn_limit",
            "pending_response": None,
        }

    # --- Extract the latest human message ---
    messages = state.get("messages", [])
    user_text = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            user_text = msg.content if isinstance(msg.content, str) else str(msg.content)
            break

    # --- Call Claude with structured output ---
    llm = _get_llm()
    structured_llm = llm.with_structured_output(IntentClassification)

    result: IntentClassification = structured_llm.invoke(
        [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_text},
        ]
    )

    # --- Validate intent domain ---
    valid_intents = {"rules_question", "card_question", "combo_question", "unclear", "rule_lookup"}
    intent = result.intent if result.intent in valid_intents else "unclear"

    # --- Build partial state update ---
    update: dict = {
        "intent": intent,
        "card_names": result.card_names,
        "rule_references": result.rule_references,
        "pending_response": None,
    }

    # --- Clarifying question path ---
    if intent == "unclear" and result.clarifying_question:
        update["pending_response"] = result.clarifying_question

    return update
