@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Run 01_SETUP_OFFLINE.cmd first!
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m voiceanalytics.cli --transcript-file samples\synthetic_call.json --llm-mode ollama --llm-model qwen3:4b-instruct --output outputs\synthetic_local_llm.json
pause
