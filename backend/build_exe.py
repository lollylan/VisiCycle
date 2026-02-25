"""
VisiCycle Build Script
======================
This script builds the portable VisiCycle .exe using PyInstaller.

Usage:
    cd backend
    python build_exe.py

Prerequisites:
    pip install pyinstaller
    npm run build (in frontend/)
"""
import subprocess
import shutil
import os
import sys

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
FRONTEND_DIST = os.path.join(PROJECT_ROOT, "frontend", "dist")
BUILD_OUTPUT = os.path.join(PROJECT_ROOT, "VisiCycle_Portable")
BACKEND_DIR = SCRIPT_DIR

def check_prerequisites():
    """Check that all build prerequisites are met."""
    print("[*] Pruefe Voraussetzungen...")

    # Check PyInstaller
    try:
        import PyInstaller
        print(f"  [OK] PyInstaller {PyInstaller.__version__}")
    except ImportError:
        print("  [FEHLER] PyInstaller nicht installiert!")
        print("     Bitte installieren: pip install pyinstaller")
        return False

    # Check frontend build
    if not os.path.isdir(FRONTEND_DIST):
        print("  [FEHLER] Frontend Build nicht gefunden!")
        print(f"     Bitte erst bauen: cd frontend && npm run build")
        return False
    print(f"  [OK] Frontend Build vorhanden: {FRONTEND_DIST}")

    return True


def build_exe():
    """Build the portable exe using PyInstaller."""
    print("\n[*] Starte PyInstaller Build...")

    # PyInstaller command
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", "VisiCycle",
        "--noconfirm",
        "--clean",
        # Include all backend modules
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "uvicorn.lifespan.off",
        "--hidden-import", "sqlalchemy.sql.default_comparator",
        "--hidden-import", "geopy.geocoders",
        "--hidden-import", "cryptography",
        "--hidden-import", "cryptography.fernet",
        # Include backend Python files
        "--add-data", f"main.py{os.pathsep}.",
        "--add-data", f"models.py{os.pathsep}.",
        "--add-data", f"schemas.py{os.pathsep}.",
        "--add-data", f"crud.py{os.pathsep}.",
        "--add-data", f"database.py{os.pathsep}.",
        "--add-data", f"main_extensions.py{os.pathsep}.",
        "--add-data", f"services{os.pathsep}services",
        # Include frontend dist
        "--add-data", f"{FRONTEND_DIST}{os.pathsep}frontend_dist",
        # Console mode (shows the server terminal)
        "--console",
        # Entry point
        "launcher.py"
    ]

    result = subprocess.run(cmd, cwd=BACKEND_DIR)
    if result.returncode != 0:
        print("[FEHLER] PyInstaller Build fehlgeschlagen!")
        return False

    print("[OK] PyInstaller Build erfolgreich!")
    return True


def create_portable_package():
    """Create the final portable package."""
    print("\n[*] Erstelle portable Version...")

    pyinstaller_output = os.path.join(BACKEND_DIR, "dist", "VisiCycle")

    if not os.path.isdir(pyinstaller_output):
        print(f"[FEHLER] PyInstaller Output nicht gefunden: {pyinstaller_output}")
        return False

    # Remove old output if exists
    if os.path.exists(BUILD_OUTPUT):
        shutil.rmtree(BUILD_OUTPUT)

    # Copy PyInstaller output to final location
    shutil.copytree(pyinstaller_output, BUILD_OUTPUT)

    # Create a README for users
    readme_content = """VisiCycle - Portable Edition
=====================================

STARTEN
-------
Doppelklicken Sie auf VisiCycle.exe

Der Browser oeffnet sich automatisch.
Das Konsolenfenster (schwarzes Fenster) NICHT schliessen!

DATEN
-----
Die Datenbank (db.sqlite3) wird im gleichen Ordner gespeichert.
Fuer ein Backup: Einfach den ganzen Ordner kopieren.

NETZWERK
--------
Andere Computer im LAN koennen ueber http://<Ihre-IP>:8555 zugreifen.

BEENDEN
-------
Schliessen Sie das Konsolenfenster (schwarzes Fenster).
"""
    with open(os.path.join(BUILD_OUTPUT, "LIESMICH.txt"), "w", encoding="utf-8") as f:
        f.write(readme_content)

    print(f"[OK] Portable Version erstellt in: {BUILD_OUTPUT}")
    print(f"     -> VisiCycle.exe starten zum Testen!")
    return True


if __name__ == "__main__":
    print("=" * 50)
    print("  VisiCycle - Build Tool")
    print("=" * 50)

    if not check_prerequisites():
        print("\n[!] Build abgebrochen. Bitte Voraussetzungen pruefen.")
        sys.exit(1)

    if not build_exe():
        sys.exit(1)

    if not create_portable_package():
        sys.exit(1)

    print("\n" + "=" * 50)
    print("[FERTIG] Build komplett!")
    print(f"   Ordner: {BUILD_OUTPUT}")
    print("   Zum Verteilen: Den ganzen Ordner zippen!")
    print("=" * 50)
