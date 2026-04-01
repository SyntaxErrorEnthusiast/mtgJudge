"""
graph.py — Build the LangGraph agent graph.

Five-node pipeline:
  understand → retrieve → reason → self_review → respond

Conditional edges handle turn limits, unclear intent, and self-review retries.
"""

from dotenv import load_dotenv
from langgraph.graph import END, START, StateGraph

from agent.nodes import understand, retrieve, reason, self_review, respond
from agent.state import AgentState

load_dotenv()


# ---------------------------------------------------------------------------
# Conditional edge: understand → retrieve | respond
# ---------------------------------------------------------------------------

def _route_after_understand(state: AgentState) -> str:
    """Route to respond for turn_limit or unclear intent; otherwise retrieve."""
    intent = state.get("intent", "")
    if intent in ("turn_limit", "unclear"):
        return "respond"
    return "retrieve"


# ---------------------------------------------------------------------------
# Conditional edge: self_review → reason | respond
# ---------------------------------------------------------------------------

def _route_after_self_review(state: AgentState) -> str:
    """
    Route back to reason only on the first needs_fix (review_retry_count == 0).
    Increment review_retry_count when routing to reason so the cap is enforced.
    """
    status = state.get("self_review_status", "")
    retry_count = state.get("review_retry_count", 0)

    if status == "needs_fix" and retry_count == 0:
        return "reason"
    return "respond"


# ---------------------------------------------------------------------------
# Wrapper that increments review_retry_count when routing back to reason
# ---------------------------------------------------------------------------

def _reason_with_retry_increment(state: AgentState) -> dict:
    """Thin wrapper: increment review_retry_count then delegate to reason."""
    incremented = {**state, "review_retry_count": state.get("review_retry_count", 0) + 1}
    result = reason(incremented)
    result["review_retry_count"] = incremented["review_retry_count"]
    return result


# ---------------------------------------------------------------------------
# Build and compile the graph
# ---------------------------------------------------------------------------

def build_graph():
    graph = StateGraph(AgentState)

    # Nodes
    graph.add_node("understand", understand)
    graph.add_node("retrieve", retrieve)
    graph.add_node("reason", reason)
    graph.add_node("reason_retry", _reason_with_retry_increment)
    graph.add_node("self_review", self_review)
    graph.add_node("respond", respond)

    # Edges
    graph.add_edge(START, "understand")

    graph.add_conditional_edges(
        "understand",
        _route_after_understand,
        {"retrieve": "retrieve", "respond": "respond"},
    )

    graph.add_edge("retrieve", "reason")
    graph.add_edge("reason", "self_review")

    graph.add_conditional_edges(
        "self_review",
        _route_after_self_review,
        {"reason": "reason_retry", "respond": "respond"},
    )

    graph.add_edge("reason_retry", "self_review")
    graph.add_edge("respond", END)

    return graph.compile()


# ---------------------------------------------------------------------------
# Compiled graph — imported by the API layer
# ---------------------------------------------------------------------------

compiled_graph = build_graph()


def run_agent(user_message: str, format: str = "commander", turn_count: int = 0) -> str:
    """
    Run the agent with a single user message and return the final text response.
    review_retry_count is always reset to 0 at invocation start.
    """
    from langchain_core.messages import HumanMessage

    final_state = compiled_graph.invoke(
        {
            "messages": [HumanMessage(content=user_message)],
            "format": format,
            "turn_count": turn_count,
            "review_retry_count": 0,  # reset each invocation
            "intent": "",
            "card_names": [],
            "rule_references": [],
            "pending_response": None,
            "retrieved_context": {},
            "draft_answer": None,
            "self_review_status": None,
        }
    )

    return final_state["messages"][-1].content
