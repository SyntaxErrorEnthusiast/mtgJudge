"""
state.py — AgentState definition for the MTG Judge LangGraph pipeline.
"""

from typing import Annotated
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    format: str                 # MTG format, e.g. "commander"
    review_retry_count: int     # times self_review has sent back to reason (max 1)
    # Internal routing fields set by nodes
    intent: str                 # "rules_question" | "card_question" | "combo_question" | "unclear" | "rule_lookup"
    card_names: list            # extracted card names from understand node
    rule_references: list       # extracted rule refs from understand node
    pending_response: str       # pre-written response (clarifying question or turn limit msg)
    retrieved_context: dict     # merged rules + card context from retrieve node
    draft_answer: str           # answer from reason node, reviewed by self_review
    self_review_status: str     # "approved" | "needs_fix" | "uncertain"
