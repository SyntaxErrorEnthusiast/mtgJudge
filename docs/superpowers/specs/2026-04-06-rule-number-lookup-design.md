# Rule Number Lookup — Design Spec

**Date:** 2026-04-06  
**Status:** Approved

## Overview

Users should be able to look up MTG comprehensive rules by number (e.g. `702.10b`, `302.6`, `201`) and receive the rule text plus judge commentary. Currently, `understand.py` extracts rule references from messages but `retrieve.py` ignores them and only does semantic similarity search, which may not surface the exact rule.

## Architecture

No new nodes or graph edges are needed. The change fits within existing nodes:

- `understand.py` — add `rule_lookup` as a 5th intent
- `retrieve.py` — add direct ChromaDB ID lookup when intent is `rule_lookup`
- `graph.py` — register `rule_lookup` as a valid intent that routes to `retrieve`
- `state.py` — no changes

## Intent Classification (`understand.py`)

Add `rule_lookup` to the intent enum and system prompt with clear discrimination rules:

| Message | Intent |
|---|---|
| `702.10b` | `rule_lookup` |
| `what does rule 302.6 say?` | `rule_lookup` |
| `if i have 302 tokens` | `rules_question` |
| `does deathtouch work with trample` | `rules_question` |

**Prompt guidance for the LLM:** Classify as `rule_lookup` only when the user's clear purpose is to retrieve a specific rule by its number. If a number appears incidentally in a gameplay scenario question, classify as `rules_question` instead.

The `rule_references` field on `IntentClassification` already captures extracted rule numbers — no schema changes needed.

## Retrieval (`retrieve.py`)

When `intent == "rule_lookup"`:

1. **Exact lookup:** Call `collection.get(ids=rule_references)` to fetch rules by their ChromaDB ID (which is the rule number).
2. **Prefix scan for partial numbers:** For any reference that returned no exact match (e.g. `201` with no sub-rule), fetch all stored IDs and filter to those starting with `{ref}.` plus the exact ID `{ref}` if present. Return all matched rules.
3. **Fallback:** If no matches are found after exact + prefix scan, fall back to semantic search on the original query so the agent can still give a useful response.

For all other intents, retrieval is unchanged (semantic search only).

## Routing (`graph.py`)

`rule_lookup` routes to `retrieve` just like `rules_question` and `card_question`. The existing conditional edge `_route_after_understand` already passes any non-`turn_limit`, non-`unclear` intent to `retrieve` — adding `rule_lookup` to the valid set is sufficient.

## Error Handling

- If `rule_references` is empty when intent is `rule_lookup`, fall back to semantic search.
- If ChromaDB raises an exception during direct lookup, log and fall back to semantic search.

## Testing

- `understand` correctly classifies direct rule number queries as `rule_lookup`
- `understand` does NOT classify incidental numbers (e.g. "302 tokens") as `rule_lookup`
- `retrieve` returns the exact rule when given a fully-qualified number like `702.10b`
- `retrieve` returns all sub-rules when given a partial number like `201`
- `retrieve` falls back to semantic search when no direct match is found
