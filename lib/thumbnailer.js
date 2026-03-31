const sharp = require('sharp');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']);
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

// Memory-Safety: OOM-Schutz
sharp.cache(false);
sharp.concurrency(1);

const CACHE_DIR = process.env.CACHE_DIR || path.join(__dirname, '..', 'cache', 'thumbs');
const SIZES = { small: 300, large: 1200 };

// Queue für sequentielle Verarbeitung
let queue = [];
let processing = false;

function hashPath(filePath) {
  return crypto.createHash('sha256').update(filePath).digest('hex');
}

function thumbPath(filePath, size) {
  const hash = hashPath(filePath);
  const dir = path.join(CACHE_DIR, size);
  return path.join(dir, hash + '.jpg');
}

async function ensureDirs() {
  for (const size of Object.keys(SIZES)) {
    const dir = path.join(CACHE_DIR, size);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

async function isFresh(originalPath, cachedPath) {
  try {
    const origStat = fs.statSync(originalPath);
    const cacheStat = fs.statSync(cachedPath);
    return cacheStat.mtimeMs > origStat.mtimeMs;
  } catch {
    return false;
  }
}

async function generateThumb(originalPath, size) {
  const sizeKey = size === 'large' ? 'large' : 'small';
  const px = SIZES[sizeKey];
  const cached = thumbPath(originalPath, sizeKey);

  if (await isFresh(originalPath, cached)) {
    return cached;
  }

  await ensureDirs();

  // Videos: Erstes Frame per ffmpeg extrahieren, dann mit sharp skalieren
  if (VIDEO_EXTS.has(path.extname(originalPath).toLowerCase())) {
    const tmpFrame = cached + '.tmp.jpg';
    try {
      await new Promise((resolve, reject) => {
        execFile(FFMPEG, [
          '-i', originalPath,
          '-ss', '00:00:01',
          '-vframes', '1',
          '-q:v', '3',
          '-y', tmpFrame
        ], { timeout: 15000 }, (err) => {
          if (err) reject(err); else resolve();
        });
      });
      await sharp(tmpFrame)
        .resize(px, px, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(cached);
      try { fs.unlinkSync(tmpFrame); } catch {}
      return cached;
    } catch (err) {
      try { fs.unlinkSync(tmpFrame); } catch {}
      console.error(`[thumb] Video-Thumbnail Fehler: ${err.message}`);
      return null;
    }
  }

  try {
    await sharp(originalPath)
      .rotate() // EXIF-Rotation (wichtig für iPhone-Fotos)
      .resize(px, px, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(cached);
    return cached;
  } catch (err) {
    console.error(`[thumb] Fehler bei ${originalPath}: ${err.message}`);
    return null;
  }
}

// Queue-basierte Verarbeitung (max 100 gleichzeitige Anfragen)
const MAX_QUEUE = 100;

function enqueue(originalPath, size) {
  if (queue.length >= MAX_QUEUE) {
    return Promise.reject(new Error('queue full'));
  }
  return new Promise((resolve, reject) => {
    queue.push({ originalPath, size, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const { originalPath, size, resolve, reject } = queue.shift();
    try {
      const result = await generateThumb(originalPath, size);
      resolve(result);
    } catch (err) {
      reject(err);
    }
  }

  processing = false;
}

function getCachedThumb(originalPath, size) {
  const sizeKey = size === 'large' ? 'large' : 'small';
  const cached = thumbPath(originalPath, sizeKey);
  if (fs.existsSync(cached)) return cached;
  return null;
}

module.exports = { enqueue, getCachedThumb, thumbPath, hashPath, SIZES };
