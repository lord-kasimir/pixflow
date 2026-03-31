const fs = require('fs');
const path = require('path');

const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, '..', 'config', 'sources.json');
const DATA_DIR = '/data';
const AUTO_SOURCES = (process.env.AUTO_SOURCES || 'true').toLowerCase() === 'true';

const DEFAULT_CONFIG = {
  sources: [
    { name: 'Fotos', path: '/data/fotos', icon: 'folder' }
  ]
};

// Scannt /data nach gemounteten Ordnern und gibt sie als Quellen zurueck
function autoDetectSources() {
  const sources = [];
  try {
    const items = fs.readdirSync(DATA_DIR, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith('.')) {
        sources.push({
          name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
          path: path.join(DATA_DIR, item.name),
          icon: 'folder'
        });
      }
    }
  } catch {}
  return sources;
}

function read() {
  // Auto-Erkennung: /data-Unterordner als Quellen
  if (AUTO_SOURCES) {
    const auto = autoDetectSources();
    if (auto.length > 0) {
      // Manuelle Config als Override: wenn vorhanden, hat sie Vorrang
      try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        const cfg = JSON.parse(raw);
        if (cfg.sources && cfg.sources.length > 0) {
          cfg.sources = cfg.sources.filter(s => {
            try { return fs.statSync(s.path).isDirectory(); } catch { return false; }
          });
          if (cfg.sources.length > 0) return cfg;
        }
      } catch {}
      return { sources: auto };
    }
  }

  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const cfg = JSON.parse(raw);
    cfg.sources = (cfg.sources || []).filter(s => {
      try { return fs.statSync(s.path).isDirectory(); } catch { return false; }
    });
    return cfg;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function write(cfg) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function readAll() {
  // Gibt auch Quellen mit fehlendem Pfad zurück (für Settings-UI)
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return DEFAULT_CONFIG;
  }
}

module.exports = { read, readAll, write, CONFIG_PATH };
