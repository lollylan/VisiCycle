"""
VisiCycle Portable Launcher
===========================
This script launches the VisiCycle application as a standalone portable app.
It serves the built frontend files, starts the FastAPI backend, and opens the browser.
"""
import sys
import os
import webbrowser
import threading
import time

# Determine base directory (works both in dev and PyInstaller bundle)
if getattr(sys, 'frozen', False):
    # Running as PyInstaller bundle
    BASE_DIR = os.path.dirname(sys.executable)
    # Also add the _internal directory to the Python path so imports work
    INTERNAL_DIR = os.path.join(BASE_DIR, "_internal")
    if os.path.isdir(INTERNAL_DIR):
        sys.path.insert(0, INTERNAL_DIR)
else:
    # Running in development
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Change working directory to BASE_DIR so db.sqlite3 is created next to the exe
os.chdir(BASE_DIR)

# --- Import the actual FastAPI app ---
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

import main

# --- Determine frontend directory ---
if getattr(sys, 'frozen', False):
    FRONTEND_DIR = os.path.join(BASE_DIR, "_internal", "frontend_dist")
else:
    FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend", "dist")

# Check if frontend build exists and mount it
if os.path.isdir(FRONTEND_DIR):
    # Serve the frontend index.html at root
    @main.app.get("/")
    async def serve_root():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    # Mount static assets (JS, CSS, images)
    assets_dir = os.path.join(FRONTEND_DIR, "assets")
    if os.path.isdir(assets_dir):
        main.app.mount("/assets", StaticFiles(directory=assets_dir), name="static_assets")

    # Serve other static files (logo, markers, etc.)
    @main.app.get("/{filename:path}")
    async def serve_static(filename: str):
        file_path = os.path.join(FRONTEND_DIR, filename)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        # Fallback to index.html for SPA routing
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
else:
    print(f"[WARNUNG] Frontend nicht gefunden in: {FRONTEND_DIR}")
    print("          App laeuft im API-only Modus.")

PORT = 8555
HOST = "0.0.0.0"


def open_browser():
    """Opens the default browser after a short delay to let the server start."""
    time.sleep(2)
    webbrowser.open(f"http://localhost:{PORT}")


if __name__ == "__main__":
    import uvicorn

    print("=" * 50)
    print("  VisiCycle - Hausbesuchs-Planer")
    print("  Portable Edition")
    print("=" * 50)
    print()
    print(f"  Server startet auf Port {PORT}...")
    print(f"  Oeffne http://localhost:{PORT}")
    print()
    print(f"  Datenbank: {os.path.join(BASE_DIR, 'db.sqlite3')}")
    print(f"  Frontend:  {FRONTEND_DIR}")
    print()
    print("  Dieses Fenster NICHT schliessen!")
    print("=" * 50)

    # Open browser in background thread
    threading.Thread(target=open_browser, daemon=True).start()

    # Start the server
    uvicorn.run(
        main.app,
        host=HOST,
        port=PORT,
        log_level="warning",
    )
