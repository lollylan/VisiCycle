@echo off
echo ============================================
echo   VisiCycle - Hausbesuchs-Planer
echo   Netzwerk-Version (LAN-Zugriff aktiviert)
echo ============================================
echo.

:: Get local IP for display
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set LOCAL_IP=%%b
    )
)

echo 1. Starting Backend (Server auf 0.0.0.0:8555)...
start "Backend Server" cmd /k "cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8555"
echo.
echo 2. Starting Frontend (App auf 0.0.0.0:5173)...
start "Frontend App" cmd /k "cd frontend && npm run dev"
echo.
echo ============================================
echo   App gestartet!
echo.
echo   Lokal:     http://localhost:5173
echo   Netzwerk:  http://%LOCAL_IP%:5173
echo.
echo   Andere Computer im Netzwerk koennen die
echo   App ueber die Netzwerk-URL erreichen.
echo ============================================
echo.
echo WICHTIG: Die schwarzen Fenster NICHT schliessen!
pause
