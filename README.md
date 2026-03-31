# Pixflow

Self-hosted Foto/Video/GIF-Galerie als PWA.

**Pix** (Pixels/Pictures) + **Flow** (Fluss) – Bilder die fliessen.

[English version](README_EN.md)

## Features

- Konfigurierbare Ordner-Quellen mit visuellem Browser
- Fotos, Videos (MP4, MOV, MKV...) und animierte GIFs
- Automatische Thumbnail-Generierung (Fotos via sharp, Videos via ffmpeg)
- Fullscreen Viewer mit Swipe-Gesten und Pinch-to-Zoom
- Slideshow mit Auto-Advance
- Info-Panel (Dateiname, Groesse, Datum, Pfad)
- Download-Button
- UI-Einblendung bei Mausbewegung oder Tap, Auto-Hide nach 2 Sekunden
- Dark Theme, responsive Layout
- Zweisprachig (Deutsch/Englisch, automatische Erkennung)
- Auto-Erkennung gemounteter `/data`-Ordner als Quellen
- Unraid Docker Template
- PWA-faehig
- Keine Datenbank, kein Account noetig

## Tech Stack

- **Backend:** Node.js, Express, sharp, ffmpeg
- **Frontend:** Vanilla JS, CSS scroll-snap
- **Deployment:** Docker

## Quick Start

```bash
docker build -t pixflow .

docker run -d \
  --name pixflow \
  --memory=512m \
  --restart unless-stopped \
  -p 3100:3000 \
  -v /pfad/zu/fotos:/data/fotos:ro \
  -v pixflow-cache:/app/cache \
  -v pixflow-config:/app/config \
  pixflow
```

Danach erreichbar unter `http://<server-ip>:3100`.

Mehrere Quellen mounten:

```bash
-v /pfad/zu/fotos:/data/fotos:ro \
-v /pfad/zu/videos:/data/videos:ro \
```

Quellen werden ueber die Web-UI (Zahnrad-Icon) oder automatisch erkannt (alle Ordner unter `/data`).

## Lokal ohne Docker

```bash
npm install
node server.js
# http://localhost:3000
```

## Unraid

### Mit Template

1. Image bauen: `docker build -t pixflow .`
2. Template kopieren:
   ```bash
   cp pixflow.xml /boot/config/plugins/dockerMan/templates-user/my-pixflow.xml
   ```
3. Docker -> Add Container -> Template: pixflow
4. Pfade und Port konfigurieren -> Apply

### Manuell

| Container Path | Host Path | Access |
|---|---|---|
| `/data/photos` | `/mnt/user/photos` | Read Only |
| `/app/cache` | `/mnt/user/appdata/pixflow/cache` | Read/Write |
| `/app/config` | `/mnt/user/appdata/pixflow/config` | Read/Write |

Port: 3100 -> 3000, Extra Parameters: `--memory=512m`

## Sicherheit

- Alle Dateizugriffe auf konfigurierte Quellen unter `/data` beschraenkt
- Ordner-Browser nur innerhalb von `/data`
- Container laeuft als non-root User
- Keine Authentifizierung – nur im lokalen Netz oder hinter Reverse Proxy mit Auth betreiben

## Lizenz

MIT
