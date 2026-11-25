# VoiceAnalytics AI — Offline Speech-to-Text & Call Outcome Auditor

An end-to-end AI call auditing pipeline and interactive web dashboard that transcribes customer renewal calls, classifies outcomes (SUCCESSFUL vs. UNSUCCESSFUL), diagnoses root causes for failed calls, and recommends next actions.

## Privacy & Zero-PII Architecture
- 100% Offline Production Pipeline: Real customer call recordings (.mp3) and logs remain strictly on local hardware and are processed offline via FFmpeg (16kHz mono normalization) -> faster-whisper (large-v3-turbo) -> Ollama (qwen2.5:3b).
- Synthetic Public Sandbox: This repository and the live web dashboard contain zero customer PII or real call audio—powered exclusively by synthetic demo transcripts (synthetic_calls/) and an interactive live audio/transcript sandbox.

## Repository Structure
- VoiceAnalyticsBootcamp_starter/audit_real_call.py — Local offline CLI auditor for real stereo/mono call audio.
- VoiceAnalyticsBootcamp_starter/generate_demo_data.py — Synthetic transcript batch classifier generating dashboardData.json.
- VoiceAnalyticsBootcamp_starter/synthetic_calls/ — Anonymized sample call transcripts for reproducible testing.
- dashboard/ — Responsive React + Vite dark-mode executive dashboard with KPI diagnostics, failure root-cause breakdown, and a live audio/transcript tester.
