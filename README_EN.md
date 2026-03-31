# Pixflow

Self-hosted photo/video/GIF gallery as a PWA.

**Pix** (Pixels/Pictures) + **Flow** (stream) – your photos, flowing.

[Deutsche Version](README.md)

## Features

- Configurable folder sources with visual browser
- Photos, videos (MP4, MOV, MKV...) and animated GIFs
- Automatic thumbnail generation (photos via sharp, videos via ffmpeg)
- Fullscreen viewer with swipe gestures and pinch-to-zoom
- Slideshow with auto-advance
- Info panel (filename, size, date, path)
- Download button
- UI appears on mouse movement or tap, auto-hides after 2 seconds
- Dark theme, responsive layout
- Bilingual (German/English, automatic detection)
- Auto-detection of mounted `/data` folders as sources
- Unraid Docker template
- PWA capable
- No database, no account required

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
  -v /path/to/photos:/data/photos:ro \
  -v pixflow-cache:/app/cache \
  -v pixflow-config:/app/config \
  pixflow
```

Then open `http://<server-ip>:3100`.

Mount multiple sources:

```bash
-v /path/to/photos:/data/photos:ro \
-v /path/to/videos:/data/videos:ro \
```

Sources are configured via the web UI (gear icon) or auto-detected (all folders under `/data`).

## Run locally without Docker

```bash
npm install
node server.js
# http://localhost:3000
```

## Unraid

### With Template

1. Build image: `docker build -t pixflow .`
2. Copy template:
   ```bash
   cp pixflow.xml /boot/config/plugins/dockerMan/templates-user/my-pixflow.xml
   ```
3. Docker -> Add Container -> Template: pixflow
4. Configure paths and port -> Apply

### Manual

| Container Path | Host Path | Access |
|---|---|---|
| `/data/photos` | `/mnt/user/photos` | Read Only |
| `/app/cache` | `/mnt/user/appdata/pixflow/cache` | Read/Write |
| `/app/config` | `/mnt/user/appdata/pixflow/config` | Read/Write |

Port: 3100 -> 3000, Extra Parameters: `--memory=512m`

## Security

- All file access restricted to configured sources under `/data`
- Folder browser only works within `/data`
- Container runs as non-root user
- No authentication – run on local network only or behind a reverse proxy with auth

## License

MIT
