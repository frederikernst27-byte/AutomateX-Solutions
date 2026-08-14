@echo off
setlocal
cd /d "%~dp0"
echo.
echo  Claude Agent
echo  ─────────────────────────────────────────
echo.

:: Starte Relay-Server
echo  Starte Server auf http://127.0.0.1:18892 ...
start "Claude Agent Server" cmd /k python "%~dp0relay.py"
timeout /t 3 /nobreak >nul

:: Dashboard im Browser öffnen
start "" "http://127.0.0.1:18892/"

echo  Bereit. Dashboard wird geöffnet.
echo.
endlocal
