@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Run 01_SETUP_OFFLINE.cmd first!
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m voiceanalytics.cli --input-audio samples\synthetic_english.wav --asr-model tiny --llm-mode mock --output outputs\synthetic_audio_tiny.json
pause
