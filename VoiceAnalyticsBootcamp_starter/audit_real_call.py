import argparse
import csv
import glob
import json
import os
import re
import subprocess
import urllib.request
from faster_whisper import WhisperModel

parser = argparse.ArgumentParser(description="Offline Batch & Single Real Call Auditor with PII Scrubber")
parser.add_argument("--audio", help="Path to a single .mp3 or .wav file")
parser.add_argument("--folder", help="Folder containing multiple .mp3/.wav recordings")
parser.add_argument("--limit", type=int, default=0, help="Max files to process (0 = all)")
parser.add_argument("--model-size", default="large-v3-turbo", help="faster-whisper model size")
parser.add_argument("--publish-dashboard", action="store_true", help="Export PII-scrubbed verdicts to dashboardData.json")
args = parser.parse_args()

if not args.audio and not args.folder:
    parser.error("Provide either --audio <file> or --folder <directory>")

files = [args.audio] if args.audio else sorted(
    glob.glob(os.path.join(args.folder, "*.mp3")) + glob.glob(os.path.join(args.folder, "*.wav"))
)
if args.limit > 0:
    files = files[:args.limit]

if not files:
    raise SystemExit("No .mp3 or .wav files found.")

os.makedirs("outputs/real_audits", exist_ok=True)
print(f"Loading faster-whisper ({args.model_size}) for {len(files)} call(s)...")
stt = WhisperModel(args.model_size, device="cpu", compute_type="int8")

def scrub_pii(text):
    text = re.sub(r'(\+91[\s-]?)?[6-9]\d{9}', '[PHONE_REDACTED]', str(text))
    text = re.sub(r'\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', '[EMAIL_REDACTED]', text, flags=re.I)
    return text

results = []
for idx, filepath in enumerate(files, start=1):
    base = os.path.splitext(os.path.basename(filepath))[0]
    mono_wav = f"outputs/real_audits/{base}_mono.wav"
    print(f"\n[{idx}/{len(files)}] Processing: {os.path.basename(filepath)}")
    subprocess.run(
        ["ffmpeg", "-y", "-i", filepath, "-ac", "1", "-ar", "16000", mono_wav],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    segments, _ = stt.transcribe(mono_wav)
    transcript = "\n".join(f"[{s.start:.1f}s] {s.text.strip()}" for s in segments)

    prompt = (
        "You are an insurance renewal call QA auditor. Respond ONLY with valid JSON: "
        '{"call_outcome": "SUCCESSFUL" or "UNSUCCESSFUL", '
        '"reason": "1-sentence clear explanation without customer names or phone numbers", '
        '"category": "Choose RENEWAL_CONFIRMED or DISCOUNT_ACCEPTED ONLY if call_outcome is SUCCESSFUL; '
        'if call_outcome is UNSUCCESSFUL, choose from COMPETITOR_SWITCH | PRICE_OBJECTION | CUSTOMER_CONFUSED | NETWORK_DROP | CALLBACK_REQUESTED", '
        '"sentiment": "POSITIVE" | "NEUTRAL" | "ANNOYED", '
        '"key_quote": "most important sentence from transcript", '
        '"next_action": "recommended follow-up"}\n\nTranscript:\n' + transcript
    )
    req = urllib.request.Request(
        "http://127.0.0.1:11434/api/generate",
        data=json.dumps({"model": "qwen2.5:3b", "prompt": prompt, "stream": False, "format": "json"}).encode(),
        headers={"Content-Type": "application/json"}
    )
    verdict = json.loads(json.loads(urllib.request.urlopen(req).read().decode())["response"])

    # Enforce outcome-category consistency
    if verdict.get("call_outcome") == "UNSUCCESSFUL" and verdict.get("category") in ("RENEWAL_CONFIRMED", "DISCOUNT_ACCEPTED"):
        verdict["category"] = "CUSTOMER_CONFUSED"
    elif verdict.get("call_outcome") == "SUCCESSFUL" and verdict.get("category") not in ("RENEWAL_CONFIRMED", "DISCOUNT_ACCEPTED"):
        verdict["category"] = "RENEWAL_CONFIRMED"

    verdict["call_id"] = f"REAL_CALL_{idx:03d}"
    verdict["source_audio"] = os.path.basename(filepath)
    verdict["transcript"] = transcript
    results.append(verdict)
    print(f"   -> {verdict['call_outcome']} ({verdict['category']}): {verdict['reason']}")

csv_path = "outputs/real_audits/batch_audit_report.csv"
with open(csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["call_id", "source_audio", "call_outcome", "category", "sentiment", "reason", "key_quote", "next_action"])
    writer.writeheader()
    for r in results:
        writer.writerow({k: r.get(k, "") for k in writer.fieldnames})

print(f"\nSaved local private Excel/CSV report to: {csv_path}")

if args.publish_dashboard:
    safe_calls = []
    for r in results:
        safe_calls.append({
            "call_id": r["call_id"],
            "call_outcome": r["call_outcome"],
            "category": r["category"],
            "sentiment": r["sentiment"],
            "reason": scrub_pii(r["reason"]),
            "key_quote": scrub_pii(r["key_quote"]),
            "next_action": scrub_pii(r["next_action"]),
            "transcript": scrub_pii(r["transcript"]),
        })
    dash_path = os.path.join("..", "dashboard", "src", "data", "dashboardData.json")
    os.makedirs(os.path.dirname(dash_path), exist_ok=True)
    with open(dash_path, "w", encoding="utf-8") as f:
        json.dump(safe_calls, f, indent=2, ensure_ascii=False)
    print(f"Published {len(safe_calls)} PII-scrubbed verdicts to {dash_path}!")