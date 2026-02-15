# VisiCycle - Intelligenter Hausbesuchs-Planer 🚴‍♂️🏥

**VisiCycle** ist eine moderne, datenschutzfreundliche Webanwendung für medizinische Hausbesuche. Sie hilft Ärzten und Pflegepersonal, ihre täglichen Routen effizient zu planen, Patienten zu verwalten und Reisezeiten zu minimieren.

## ✨ Highlights

*   **100% Datenschutz:** Alle Patientendaten bleiben lokal auf Ihrem Gerät (Localhost).
*   **Intelligentes Routing:** Automatische Berechnung der optimalen Route (Nearest Neighbor).
*   **Flexible Zeitplanung:** Berücksichtigung von festen Intervallen und manuellen Terminen.
*   **Snooze-Funktion:** Verschieben Sie Patienten flexibel auf den nächsten Tag.
*   **Offline-First:** Verwendung lokaler Kartendaten (Leaflet) und keine Abhängigkeit von externen Tracking-Diensten.
*   **Modernes Design:** Übersichtliches Dashboard, sortierte Listen und interaktive Karte.

## 🚀 Installation & Start

### Voraussetzungen

*   [Python 3.8+](https://www.python.org/downloads/)
*   [Node.js 16+](https://nodejs.org/)

### 1. Repository klonen

```bash
git clone https://github.com/DEIN_USERNAME/VisiCycle.git
cd VisiCycle
```

### 2. Backend einrichten (Python)

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Frontend einrichten (React)

```bash
cd ../frontend
npm install
```

### 4. Anwendung starten

Der einfachste Weg ist die Nutzung des Start-Skripts (Windows):

*   Führen Sie `start_app.bat` im Hauptverzeichnis aus.

Oder manuell:

**Backend:**
```bash
cd backend
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm run dev
```

Die Anwendung ist dann unter `http://localhost:5173` erreichbar.

## 🛠️ Technologien

*   **Backend:** FastAPI, SQLAlchemy, SQLite
*   **Frontend:** React, Vite, Tailwind CSS (optional), Leaflet
*   **Routing:** Geopy, NetworkX

## 🔒 Datenschutz-Hinweis

VisiCycle nutzt OpenStreetMap-Daten für die Adress-Suche. Um die Privatsphäre der Patienten zu schützen, werden beim Geocoding (Adress-Suche) **niemals** Patientennamen übertragen, sondern lediglich die Adresse (Straße, Hausnummer, Stadt). Die Speicherung aller Daten erfolgt ausschließlich in einer lokalen SQLite-Datenbank.

## 📝 Lizenz

MIT License
