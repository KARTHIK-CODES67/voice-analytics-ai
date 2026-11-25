@echo off
setlocal
cd /d "%~dp0"
echo STEP 1: Checking Python 3.11...
py -3.11 --version || goto :ERROR
echo STEP 2: Creating private project Python environment...
py -3.11 -m venv .venv || goto :ERROR
echo STEP 3: Running simple offline tests...
".venv\Scripts\python.exe" -m unittest discover -s tests_offline -v || goto :ERROR
echo STEP 4: Running fictional transcript example...
".venv\Scripts\python.exe" 00_offline_demo.py || goto :ERROR
echo.
echo SUCCESS - see outputs\fresher_first_result.json
pause
exit /b 0
:ERROR
echo FAILED. Read BEGINNER_GUIDE section 'Troubleshooting'.
pause
exit /b 1
