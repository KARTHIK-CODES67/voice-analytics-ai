"""Contract for demo analytics. Evidence must cite an existing transcript segment."""
from __future__ import annotations
from jsonschema import validate

ANALYSIS_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["summary", "disposition", "customer_intent", "customer_sentiment",
                 "renewal_interest", "callback_requested", "objections", "action_items",
                 "evidence", "uncertainty", "review_required"],
    "properties": {
        "summary": {"type": "string"},
        "disposition": {"type": "string", "enum": ["INTERESTED", "NOT_INTERESTED", "CALLBACK", "INFORMATION_ONLY", "UNDETERMINED"]},
        "customer_intent": {"type": "string", "enum": ["RENEW", "DECLINE", "CALLBACK", "INQUIRE", "UNKNOWN"]},
        "customer_sentiment": {"type": "string", "enum": ["POSITIVE", "NEGATIVE", "MIXED", "NEUTRAL", "UNKNOWN"]},
        "renewal_interest": {"type": "string", "enum": ["YES", "NO", "UNKNOWN"]},
        "callback_requested": {"type": "boolean"},
        "objections": {"type": "array", "items": {"type": "string"}},
        "action_items": {"type": "array", "items": {"type": "string"}},
        "evidence": {"type": "array", "items": {"type": "object", "additionalProperties": False,
            "required": ["segment_id", "quote", "supports"],
            "properties": {"segment_id": {"type": "string"}, "quote": {"type": "string"}, "supports": {"type": "string"}}}},
        "uncertainty": {"type": "string"},
        "review_required": {"type": "boolean"}
    }
}

def validate_analytics(value: dict, segments: list[dict]) -> None:
    validate(instance=value, schema=ANALYSIS_SCHEMA)
    idx = {str(s["id"]): str(s["text"]) for s in segments}
    for ev in value["evidence"]:
        seg = idx.get(ev["segment_id"])
        if seg is None:
            raise ValueError(f"Nonexistent evidence segment: {ev['segment_id']}")
        # This POC uses exact substring matching to prevent fabricating quotations.
        normalized_quote = " ".join(ev["quote"].casefold().split())
        normalized_segment = " ".join(seg.casefold().split())
        if not normalized_quote or normalized_quote not in normalized_segment:
            raise ValueError(f"Evidence quote is not present in segment {ev['segment_id']}")
