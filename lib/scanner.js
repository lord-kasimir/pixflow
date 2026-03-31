const fs = require('fs');
const path = require('path');

const PHOTO_EXTS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.gif', '.bmp', '.tiff', '.tif']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']);
const ALL_MEDIA_EXTS = new Set([...PHOTO_EXTS, ...VIDEO_EXTS]);
const MAX_DEPTH = 5;

function isPhoto(name) {
  return PHOTO_EXTS.has(path.extname(name).toLowerCase());
}

function isVideo(name) {
  return VIDEO_EXTS.has(path.extname(name).toLowerCase());
}

function isGif(name) {
  return path.extname(name).toLowerCase() === '.gif';
}

function isMedia(name) {
  return ALL_MEDIA_EXTS.has(path.extname(name).toLowerCase());
}

function listAlbums(basePath) {
  const entries = [];
  try {
    const items = fs.readdirSync(basePath, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.')) continue;
      if (item.isDirectory()) {
        // Erstes Foto im Ordner als Cover finden
        let cover = null;
        try {
          const sub = fs.readdirSync(path.join(basePath, item.name), { withFileTypes: true });
          for (const s of sub) {
            if (s.isFile() && isMedia(s.name)) {
              cover = path.join(basePath, item.name, s.name);
              break;
            }
          }
        } catch {}
        entries.push({
          name: item.name,
          path: path.join(basePath, item.name),
          cover,
          type: 'folder'
        });
      }
    }
  } catch {}
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

function listPhotos(dirPath, depth = 0) {
  if (depth > MAX_DEPTH) return [];
  const photos = [];
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.')) continue;
      const fullPath = path.join(dirPath, item.name);
      if (item.isFile() && isMedia(item.name)) {
        try {
          const stat = fs.statSync(fullPath);
          let type = 'photo';
          if (isVideo(item.name)) type = 'video';
          else if (isGif(item.name)) type = 'gif';
          photos.push({
            name: item.name,
            path: fullPath,
            size: stat.size,
            mtime: stat.mtimeMs,
            type
          });
        } catch {}
      }
    }
  } catch {}
  return photos.sort((a, b) => b.mtime - a.mtime);
}

function countPhotos(dirPath) {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    return items.filter(i => i.isFile() && isMedia(i.name) && !i.name.startsWith('.')).length;
  } catch {
    return 0;
  }
}

module.exports = { listAlbums, listPhotos, countPhotos, isPhoto, isVideo, isGif, isMedia };
