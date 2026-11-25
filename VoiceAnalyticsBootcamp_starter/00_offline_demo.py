"""TEACHING-ONLY. Processes a FICTIONAL transcript with a deterministic rule.
NO speech recognition, NO LLM, NO customer records and NO CRM update.
Python 3.11 standard library only.
"""
import argparse
import json
from pathlib import Path


def validate_segments(segments):
    if not isinstance(segments, list) or not segments:
        raise ValueError("Transcript must contain at least one segment")
    found_ids = set()
    for item in segments:
        if not all(k in item for k in ("id", "start", "end", "text")):
            raise ValueError("Segment missing id/start/end/text")
        if not isinstance(item["text"], str) or not item["text"].strip():
            raise ValueError("Blank segment text")
        if not isinstance(item["start"], (int, float)) or not isinstance(item["end"], (int, float)) or item["start"] < 0 or item["end"] <= item["start"]:
            raise ValueError("Invalid segment times")
        if item["id"] in found_ids:
            raise ValueError("Duplicate segment identifier")
        found_ids.add(item["id"])


def analyze_fictional(segments):
    validate_segments(segments)
    match = next((s for s in segments if "call me tomorrow" in s["text"].lower()), None)
    evidence = []
    if match:
        # Quote is an exact contiguous substring of the transcript segment.
        start = match["text"].lower().find("call me tomorrow")
        quote = match["text"][start:start + len("call me tomorrow")]
        evidence.append({"segment_id": match["id"], "quote": quote, "supports": "CALLBACK"})
    result = {
        "status": "SYNTHETIC_DETERMINISTIC_TRAINING_ONLY",
        "summary": "Not an AI result. Review original statements before business decisions.",
        "disposition": "CALLBACK" if match else "UNDETERMINED",
        "customer_intent": "UNKNOWN",  # No speaker identities verified
        "callback_requested": bool(match),
        "customer_sentiment": "UNKNOWN",
        "evidence": evidence,
        "review_required": True,
        "crm_write_performed": False,
        "speaker_roles_verified": False
    }
    validate_evidence(result, segments)
    return result


def validate_evidence(result, segments):
    by_id = {seg["id"]: seg["text"] for seg in segments}
    for item in result.get("evidence", []):
        if item.get("segment_id") not in by_id:
            raise ValueError("Evidence references non-existent segment")
        if not item.get("quote") or item["quote"].casefold() not in by_id[item["segment_id"]].casefold():
            raise ValueError("Unsupported evidence quote")


def main():
    parser=argparse.ArgumentParser(description="Offline synthetic insurance call demo")
    parser.add_argument("--input", default="samples/synthetic_call.json", help="Fictional transcript JSON")
    parser.add_argument("--output", default="outputs/fresher_first_result.json")
    args=parser.parse_args()
    inp=Path(args.input)
    data=json.loads(inp.read_text(encoding="utf-8"))
    segments=data["segments"]
    result={"input_kind":"fictional_transcript", "segments":segments, "analytics":analyze_fictional(segments)}
    output=Path(args.output)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding="utf-8")
    print("SUCCESS: created", output.resolve())
    print("Disposition:", result["analytics"]["disposition"])
    print("CAUTION: simulation only; no ASR, no LLM, no real customer data, no CRM write.")

if __name__=="__main__":
    main()
