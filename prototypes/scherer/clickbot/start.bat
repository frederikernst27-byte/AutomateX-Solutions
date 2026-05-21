@echo off
setlocal
cd /d "%~dp0"
echo.
echo  ClickBot Dashboard
echo  ─────────────────────────────────────────
echo.

:: Prüfe ob Pakete installiert sind
python -c "import fastapi, playwright" 2>nul
if errorlevel 1 (
    echo  Installiere fehlende Pakete...
    pip install -r "%~dp0requirements.txt" >nul 2>&1
    playwright install chromium >nul 2>&1
    echo  Pakete installiert.
    echo.
)

:: Server starten
echo  Starte Server auf http://localhost:8000 ...
start "ClickBot Server" cmd /k python "%~dp0main.py"
timeout /t 3 /nobreak >nul

:: Dashboard im Browser öffnen
start "" "http://localhost:8000"

echo  Bereit. Dashboard wird geöffnet.
echo.
endlocal
