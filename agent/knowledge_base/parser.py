"""
parser.py — Split the MTG comprehensive rules TXT into discrete rule chunks.

Each top-level rule (e.g. "702.") and subrule (e.g. "702.19", "702.19a")
becomes its own chunk. Subrule chunks are prefixed with their parent rule text
for retrieval context.
"""

import re
from dataclasses import dataclass


# Matches lines that start a new rule, e.g. "100.", "702.19", "702.19a"
_RULE_LINE_RE = re.compile(r'^(\d+\.(?:\d+[a-z]?)?)(\s+.+)$')


@dataclass
class RuleChunk:
    rule_number: str
    text: str


def parse_rules(rules_text: str) -> list[RuleChunk]:
    """Parse the full MTG comprehensive rules TXT into RuleChunk objects.

    Args:
        rules_text: Raw text content of the comprehensive rules file.

    Returns:
        List of RuleChunk objects, one per rule/subrule line.
    """
    chunks: list[RuleChunk] = []
    # Track the most recent top-level rule text for prefixing subrules
    current_parent_text: str = ""
    current_parent_number: str = ""

    for line in rules_text.splitlines():
        line = line.strip()
        if not line:
            continue

        m = _RULE_LINE_RE.match(line)
        if not m:
            continue

        rule_number = m.group(1).rstrip('.')
        rule_body = m.group(2).strip()

        # Determine if this is a top-level rule (e.g. "702.") or subrule
        is_top_level = re.match(r'^\d+\.$', m.group(1))

        if is_top_level:
            current_parent_number = rule_number
            current_parent_text = rule_body
            text = rule_body
        else:
            # Prefix subrule with parent context
            if current_parent_text:
                text = f"{current_parent_number}: {current_parent_text}\n{rule_number}: {rule_body}"
            else:
                text = f"{rule_number}: {rule_body}"

        chunks.append(RuleChunk(rule_number=rule_number, text=text))

    return chunks


def pretty_print(chunk: RuleChunk) -> str:
    """Format a RuleChunk back into a readable rules text string."""
    return f"{chunk.rule_number}. {chunk.text}"
