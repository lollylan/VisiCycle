@echo off
echo Starting Hausbesuchs-Planer...
echo.
echo 1. Starting Backend (Server)...
start "Backend Server" cmd /k "cd backend && python -m uvicorn main:app --reload --port 8000"
echo.
echo 2. Starting Frontend (App)...
start "Frontend App" cmd /k "cd frontend && npm run dev"
echo.
echo Done! The App should open in your browser shortly at http://localhost:5173
echo.
echo You can minimize the black windows, but DO NOT CLOSE THEM while using the app.
pause
