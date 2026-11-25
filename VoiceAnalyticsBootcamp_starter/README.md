# Voice Call Analytics — Reference Beginner POC

**Not the existing application's source.** This small, safe educational project accompanies the implementation blueprint, since only a master prompt (not actual code) was supplied. It supports (a) an entirely offline simulated transcript demo; (b) a local Ollama LLM demo on synthetic transcript; and (c) local CPU Whisper transcription of an authorized MONO recording followed by a local LLM. None of these has been validated on the user's Windows laptop. Never send sensitive call data to a remote service.

## Route A: first 10-minute simulated demo, NO AI MODELS

Open **PowerShell** in this folder on a Windows 11 PC with Python 3.11 installed:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m voiceanalytics.cli --transcript-file samples\synthetic_call.json --llm-mode mock --output outputs\synthetic_mock.json
Get-Content outputs\synthetic_mock.json
```

The result MUST say SIMULATED and `review_required: true`. This tests CLI and JSON evidence checks, not ASR or LLM accuracy. Python 3.11 installation is a prerequisite.

## Route B: actual LOCAL LLM on the synthetic text

Install Ollama from https://ollama.com/download, open Ollama, then in PowerShell:

```powershell
ollama --version
ollama pull qwen3:4b
ollama list
.\.venv\Scripts\python.exe -m voiceanalytics.cli --transcript-file samples\synthetic_call.json --llm-mode ollama --llm-model qwen3:4b --output outputs\synthetic_llm.json
Get-Content outputs\synthetic_llm.json
```

The first model download is several gigabytes and needs Internet; Ollama inference is intended to use `127.0.0.1`. A failed schema/evidence check is a legitimate failed test: do not silently accept fabricated output. If model output fails, retry with another benchmark candidate after investigating.

## Route C: actual ASR + local LLM (mono recordings only)

Download FFmpeg from https://ffmpeg.org/download.html or trusted Windows installer; check `ffmpeg -version` and `ffprobe -version` in a NEW PowerShell. Use a short, authorized mono file, for example `samples\approved_mono.wav` (this file is NOT included). Execute:

```powershell
.\.venv\Scripts\python.exe -m voiceanalytics.cli --input-audio samples\approved_mono.wav --asr-model small --llm-mode ollama --llm-model qwen3:4b --output outputs\audio_result.json
```

The first ASR use downloads its model (Internet required). CPU inference may be slow. This demo intentionally refuses stereo/dual-channel audio to prevent accidentally mixing agent and customer tracks. Build proper separate-channel extraction or diarization before production use. Input audio is never shipped in this ZIP.

## Read first

- The main handbook in `../docs` explains beginner concepts, licensing and independent ASR/LLM tests.
- `--llm-mode mock` is **not a machine-learning model**. Do not report its results as AI accuracy.
- The demo does not identify speakers, redact PII, enforce retention, check opt-out/DND or implement secure CRM writes. These are production blockers.
- Do not install Python 3.15 for this starter; use compatible Python 3.11 per this guide.
