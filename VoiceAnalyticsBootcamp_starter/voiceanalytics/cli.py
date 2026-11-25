"""Reference teaching entry point; does NOT represent the user's actual source."""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from .audio import probe, convert_to_asr_wav
from .asr import transcribe_wav
from .analytics import mock_analytics, ollama_analytics
from .schema import validate_analytics


def run(args: argparse.Namespace) -> Path:
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    info = {"status": "PROPOSED_REFERENCE_POC_NOT_EXISTING_APP", "mode": args.llm_mode,
            "processed_utc": datetime.now(timezone.utc).isoformat()}
    if args.transcript_file:
        input_path = Path(args.transcript_file)
        segments = json.loads(input_path.read_text(encoding="utf-8"))["segments"]
        info["source_type"] = "synthetic_or_authorized_transcript"
    else:
        input_path = Path(args.input_audio)
        if not input_path.is_file():
            raise FileNotFoundError(f"Audio file not found: {input_path}")
        info["source_type"] = "audio"
        info["sha256"] = hashlib.sha256(input_path.read_bytes()).hexdigest()  # POC only; stream large files in production
        info["audio_metadata"] = probe(input_path)
        # Deliberately reject multichannel recordings until preserving channels is designed.
        if any(int(s.get("channels", 1)) > 1 for s in info["audio_metadata"].get("streams", [])):
            raise ValueError("Multi-channel audio needs a channel-preserving production design; this beginner POC is mono only")
        wav = output.parent / (output.stem + ".normalized.wav")
        convert_to_asr_wav(input_path, wav)
        segments, asr_info = transcribe_wav(wav, args.asr_model, args.language)
        info.update(asr_info)
    if not segments or any(not {"id", "start", "end", "text"}.issubset(s) for s in segments):
        raise ValueError("Transcript must have non-empty segments with id, start, end, text")
    analytics = (mock_analytics(segments) if args.llm_mode == "mock" else
                 ollama_analytics(segments, args.llm_model))
    validate_analytics(analytics, segments)
    report = {"metadata": info, "segments": segments, "analytics": analytics,
              "disclaimer": "Reference demo only. Human review before CRM action."}
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return output


def main() -> None:
    ap = argparse.ArgumentParser(description="Reference Voice Analytics beginner demo")
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--input-audio", help="Path to mono call audio")
    group.add_argument("--transcript-file", help="JSON file with pre-supplied segments")
    ap.add_argument("--output", default="outputs/result.json")
    ap.add_argument("--asr-model", default="small", help="Whisper model name; downloaded on first use")
    ap.add_argument("--language", default=None, help="Optional Whisper language code (e.g. en, hi)")
    ap.add_argument("--llm-mode", choices=["mock", "ollama"], default="mock")
    ap.add_argument("--llm-model", default="qwen3:4b")
    args = ap.parse_args()
    try:
        output = run(args)
        print("SUCCESS - output:", output.resolve())
        if args.llm_mode == "mock":
            print("NOTICE: SIMULATED rule-based output; not an LLM quality test.")
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
