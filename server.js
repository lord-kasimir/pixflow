const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./lib/config');
const scanner = require('./lib/scanner');
const thumbnailer = require('./lib/thumbnailer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = '/data';

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- API: Quellen ---

app.get('/api/sources', (req, res) => {
  const cfg = config.read();
  const sources = cfg.sources.map(s => ({
    name: s.name,
    path: s.path,
    icon: s.icon || 'folder',
    count: scanner.countPhotos(s.path)
  }));
  res.json(sources);
});

app.get('/api/sources/all', (req, res) => {
  res.json(config.readAll());
});

app.post('/api/sources', (req, res) => {
  const { sources } = req.body;
  if (!Array.isArray(sources)) return res.status(400).json({ error: 'sources must be array' });

  // Validierung: nur gueltige Objekte mit Pfaden unter /data
  for (const s of sources) {
    if (typeof s.name !== 'string' || !s.name || s.name.length > 200) {
      return res.status(400).json({ error: 'invalid source name' });
    }
    if (typeof s.path !== 'string' || !s.path) {
      return res.status(400).json({ error: 'invalid source path' });
    }
    if (s.icon && typeof s.icon !== 'string') {
      return res.status(400).json({ error: 'invalid icon' });
    }
    const resolved = path.resolve(s.path);
    if (!resolved.startsWith(DATA_DIR + path.sep) && resolved !== DATA_DIR) {
      return res.status(403).json({ error: 'sources must be under /data' });
    }
  }

  config.write({ sources });
  res.json({ ok: true });
});

// --- API: Alben (Unterordner einer Quelle) ---

app.get('/api/albums', (req, res) => {
  const dirPath = req.query.path;
  if (!dirPath || !isAllowedPath(dirPath)) return res.status(403).json({ error: 'forbidden' });

  const albums = scanner.listAlbums(dirPath);
  const photos = scanner.listPhotos(dirPath);

  res.json({
    albums: albums.map(a => ({
      name: a.name,
      path: a.path,
      cover: a.cover ? `/api/thumb/small?path=${encodeURIComponent(a.cover)}` : null,
      count: scanner.countPhotos(a.path)
    })),
    photos: photos.map(p => ({
      name: p.name,
      path: p.path,
      thumb: `/api/thumb/small?path=${encodeURIComponent(p.path)}`,
      large: `/api/thumb/large?path=${encodeURIComponent(p.path)}`,
      original: `/api/photo?path=${encodeURIComponent(p.path)}`,
      type: p.type || 'photo',
      size: p.size,
      mtime: p.mtime
    }))
  });
});

// --- API: Fotos in Ordner ---

app.get('/api/photos', (req, res) => {
  const dirPath = req.query.path;
  if (!dirPath || !isAllowedPath(dirPath)) return res.status(403).json({ error: 'forbidden' });

  const photos = scanner.listPhotos(dirPath);
  res.json(photos.map(p => ({
    name: p.name,
    path: p.path,
    thumb: `/api/thumb/small?path=${encodeURIComponent(p.path)}`,
    large: `/api/thumb/large?path=${encodeURIComponent(p.path)}`,
    original: `/api/photo?path=${encodeURIComponent(p.path)}`,
    type: p.type || 'photo',
    size: p.size,
    mtime: p.mtime
  })));
});

// --- API: Thumbnail ---

app.get('/api/thumb/:size', async (req, res) => {
  const filePath = req.query.path;
  const size = req.params.size;

  if (!filePath || !isAllowedPath(filePath)) return res.status(403).json({ error: 'forbidden' });
  if (!['small', 'large'].includes(size)) return res.status(400).json({ error: 'invalid size' });

  // Erst Cache pruefen
  const cached = thumbnailer.getCachedThumb(filePath, size);
  if (cached) {
    res.set('Cache-Control', 'public, max-age=86400');
    return res.sendFile(cached);
  }

  // Thumbnail generieren (Queue)
  try {
    const result = await thumbnailer.enqueue(filePath, size);
    if (result) {
      res.set('Cache-Control', 'public, max-age=86400');
      return res.sendFile(result);
    }
    res.status(500).json({ error: 'thumbnail generation failed' });
  } catch (err) {
    console.error(`[thumb] Error: ${err.message}`);
    res.status(500).json({ error: 'thumbnail generation failed' });
  }
});

// --- API: Original-Foto ---

app.get('/api/photo', (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !isAllowedPath(filePath)) return res.status(403).json({ error: 'forbidden' });

  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'not found' });
  res.set('Cache-Control', 'public, max-age=86400');
  res.sendFile(filePath);
});

// --- API: Ordner-Browser (nur unter /data) ---

app.get('/api/browse', (req, res) => {
  const dirPath = req.query.path || DATA_DIR;
  const resolved = path.resolve(dirPath);

  // Nur Browsing unter /data erlauben
  if (resolved !== DATA_DIR && !resolved.startsWith(DATA_DIR + path.sep)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  let folders = [];
  let photoCount = 0;

  try {
    const items = fs.readdirSync(resolved, { withFileTypes: true });
    folders = items
      .filter(i => i.isDirectory() && !i.name.startsWith('.'))
      .map(i => ({
        name: i.name,
        path: path.join(resolved, i.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    photoCount = items.filter(i =>
      i.isFile() && scanner.isMedia(i.name) && !i.name.startsWith('.')
    ).length;
  } catch {}

  const parent = resolved === DATA_DIR ? null : path.dirname(resolved);

  res.json({
    current: resolved,
    parent: parent && parent.startsWith(DATA_DIR) ? parent : null,
    folders,
    photoCount
  });
});

// --- API: Health ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// --- Sicherheit: Nur erlaubte Pfade ---

function isAllowedPath(filePath) {
  const cfg = config.read();
  const resolved = path.resolve(filePath);
  return cfg.sources.some(s => {
    const base = path.resolve(s.path);
    return resolved === base || resolved.startsWith(base + path.sep);
  });
}

// --- SPA Fallback ---

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start ---

app.listen(PORT, '0.0.0.0', () => {
  const cfg = config.read();
  console.log(`[pixflow] Server laeuft auf http://0.0.0.0:${PORT}`);
  console.log(`[pixflow] ${cfg.sources.length} Quellen konfiguriert`);
  cfg.sources.forEach(s => console.log(`  - ${s.name}: ${s.path}`));
});
