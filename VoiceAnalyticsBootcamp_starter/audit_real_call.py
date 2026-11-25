import argparse, json, os, subprocess, urllib.request
from faster_whisper import WhisperModel

parser = argparse.ArgumentParser(description="Offline Real Call Audio Auditor (Stereo->Mono + Whisper + Qwen)")
parser.add_argument("--audio", required=True, help="Path to real .mp3 or .wav call recording")
parser.add_argument("--model-size", default="large-v3-turbo", help="faster-whisper model size")
args = parser.parse_args()

os.makedirs("outputs/real_audits", exist_ok=True)
base = os.path.splitext(os.path.basename(args.audio))[0]
mono_wav = f"outputs/real_audits/{base}_mono.wav"

print(f"[1/3] Normalizing stereo audio to 16kHz mono: {mono_wav}")
subprocess.run(["ffmpeg", "-y", "-i", args.audio, "-ac", "1", "-ar", "16000", mono_wav], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

print(f"[2/3] Transcribing offline with faster-whisper ({args.model_size})...")
stt = WhisperModel(args.model_size, device="cpu", compute_type="int8")
segments, _ = stt.transcribe(mono_wav)
transcript = "\n".join(f"[{s.start:.1f}s] {s.text.strip()}" for s in segments)

print("[3/3] Classifying call outcome offline via Ollama (qwen2.5:3b)...")
prompt = (
    "You are an insurance renewal call QA auditor. Respond ONLY with valid JSON: "
    '{"call_outcome": "SUCCESSFUL" or "UNSUCCESSFUL", '
    '"reason": "1-sentence clear explanation of why the call succeeded or failed", '
    '"category": "RENEWAL_CONFIRMED" | "DISCOUNT_ACCEPTED" | "COMPETITOR_SWITCH" | "PRICE_OBJECTION" | "NETWORK_DROP" | "CALLBACK_REQUESTED", '
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
verdict["source_audio"] = os.path.basename(args.audio)
verdict["transcript"] = transcript

out_json = f"outputs/real_audits/{base}_verdict.json"
with open(out_json, "w", encoding="utf-8") as f:
    json.dump(verdict, f, indent=2, ensure_ascii=False)

print(f"\nPHASE 3 DONE! Saved private real-call audit to {out_json}:")
print(json.dumps({"call_outcome": verdict["call_outcome"], "reason": verdict["reason"], "next_action": verdict["next_action"]}, indent=2))
