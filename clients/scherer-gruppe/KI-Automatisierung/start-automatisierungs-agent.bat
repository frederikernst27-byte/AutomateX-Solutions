@echo off
setlocal
cd /d "%~dp0"
echo.
echo  KI-Automatisierungs-Agent
echo  ─────────────────────────────────────────
echo.

:: Prüfe ob Pakete installiert sind
python -c "import openai" 2>nul
if errorlevel 1 (
    echo  Installiere fehlende Pakete...
    pip install openai openai-whisper >nul 2>&1
    echo  Pakete installiert.
    echo.
)

:: OpenClaw Gateway prüfen / starten
echo  Prüfe OpenClaw Gateway...
powershell -NoProfile -ExecutionPolicy Bypass -Command "& 'C:\nvm4w\nodejs\openclaw.ps1' gateway start" >nul 2>&1
timeout /t 2 /nobreak >nul

:: Relay-Server starten
echo  Starte Relay-Server auf http://127.0.0.1:18891 ...
start "KI-Agent Server" cmd /k python "%~dp0relay.py"
timeout /t 3 /nobreak >nul

:: Dashboard im Browser öffnen
start "" "http://127.0.0.1:18891/"

echo  Bereit. Dashboard wird geöffnet.
echo.
endlocal
