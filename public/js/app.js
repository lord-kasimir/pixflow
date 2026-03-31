// ── i18n ─────────────────────────────────────────────────────────────────────

const LANG = (navigator.language || 'de').startsWith('de') ? 'de' : 'en';

const I18N = {
  de: {
    appName: 'Pixflow',
    photos: 'Fotos',
    noSources: 'Keine Quellen konfiguriert.<br>Tippe auf das Zahnrad um Ordner hinzuzufuegen.',
    noSourcesShort: 'No sources configured.',
    emptyFolder: 'Leerer Ordner',
    error: 'Fehler',
    settings: 'Einstellungen',
    selectFolder: 'Ordner auswaehlen...',
    remove: 'Entfernen',
    addSource: '+ Quelle hinzufuegen',
    save: 'Speichern',
    chooseFolder: 'Diesen Ordner waehlen',
    photosInFolder: 'Fotos in diesem Ordner',
    cancel: 'Abbrechen',
    back: 'Zurueck',
    type: 'Typ',
    photo: 'Foto',
    video: 'Video',
    size: 'Groesse',
    date: 'Datum',
    dateLocale: 'de-DE',
  },
  en: {
    appName: 'Pixflow',
    photos: 'Photos',
    noSources: 'No sources configured.<br>Tap the gear icon to add folders.',
    emptyFolder: 'Empty folder',
    error: 'Error',
    settings: 'Settings',
    selectFolder: 'Select folder...',
    remove: 'Remove',
    addSource: '+ Add source',
    save: 'Save',
    chooseFolder: 'Choose this folder',
    photosInFolder: 'photos in this folder',
    cancel: 'Cancel',
    back: 'Back',
    type: 'Type',
    photo: 'Photo',
    video: 'Video',
    size: 'Size',
    date: 'Date',
    dateLocale: 'en-US',
  }
};

const t = (key) => I18N[LANG][key] || I18N.de[key] || key;

// ── Grid Size ────────────────────────────────────────────────────────────────

const GRID_STEPS = [2, 3, 4, 5, 6, 8, 10];
let gridSizeIndex = parseInt(localStorage.getItem('gridSize') || '1', 10);

function applyGridSize() {
  const cols = GRID_STEPS[gridSizeIndex] || 3;
  document.documentElement.style.setProperty('--grid-cols', cols);
}

function changeGridSize(dir) {
  gridSizeIndex = Math.max(0, Math.min(GRID_STEPS.length - 1, gridSizeIndex + dir));
  localStorage.setItem('gridSize', gridSizeIndex);
  applyGridSize();
}

applyGridSize();

// ── State ─────────────────────────────────────────────────────────────────────
let currentPath = null;
let navStack = [];
let photos = [];
let viewerIndex = 0;
let slideshowTimer = null;
let slideshowActive = false;
let uiHideTimer = null;
let zoomScale = 1;
let zoomX = 0;
let zoomY = 0;
let pinchStartDist = 0;
let pinchStartScale = 1;
let panStartX = 0;
let panStartY = 0;
let panStartZoomX = 0;
let panStartZoomY = 0;
let isPanning = false;

const $ = id => document.getElementById(id);
const content = () => $('content');

// ── Router ───────────────────────────────────────────────────────────────────

function navigate(path, title) {
  if (currentPath !== null) navStack.push({ path: currentPath, title: $('title').textContent });
  currentPath = path;
  $('title').textContent = title || t('appName');
  $('btn-back').style.display = path ? '' : 'none';
  if (!path) loadSources();
  else loadAlbum(path);
}

function goBack() {
  if (navStack.length) {
    const prev = navStack.pop();
    currentPath = prev.path;
    $('title').textContent = prev.title;
    $('btn-back').style.display = currentPath ? '' : 'none';
    if (!currentPath) loadSources();
    else loadAlbum(currentPath);
  } else {
    currentPath = null;
    $('title').textContent = t('appName');
    $('btn-back').style.display = 'none';
    loadSources();
  }
}

// ── Quellen (Home) ───────────────────────────────────────────────────────────

async function loadSources() {
  content().innerHTML = '<div class="spinner"></div>';
  try {
    const res = await fetch('/api/sources');
    const sources = await res.json();

    if (!sources.length) {
      content().innerHTML = `
        <div class="empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          <p>${t('noSources')}</p>
        </div>`;
      return;
    }

    const html = sources.map(s => `
      <div class="source-card" onclick="navigate('${esc(s.path)}', '${esc(s.name)}')">
        <div class="source-icon">${sourceIcon(s.icon)}</div>
        <div class="source-info">
          <div class="source-name">${esc(s.name)}</div>
          <div class="source-count">${s.count} ${t('photos')}</div>
        </div>
        <div class="source-arrow">&#x203A;</div>
      </div>
    `).join('');
    content().innerHTML = `<div class="source-list">${html}</div>`;
  } catch (err) {
    content().innerHTML = `<div class="empty"><p>${t('error')}: ${esc(err.message)}</p></div>`;
  }
}

function sourceIcon(icon) {
  const icons = {
    cloud: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>',
    folder: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
    people: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75"/></svg>',
    apple: '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>'
  };
  return icons[icon] || icons.folder;
}

// ── Album (Ordner + Fotos) ───────────────────────────────────────────────────

async function loadAlbum(dirPath) {
  content().innerHTML = '<div class="spinner"></div>';
  try {
    const res = await fetch(`/api/albums?path=${encodeURIComponent(dirPath)}`);
    const data = await res.json();
    let html = '';

    if (data.albums.length) {
      html += '<div class="album-grid">';
      html += data.albums.map(a => `
        <div class="album-card" onclick="navigate('${esc(a.path)}', '${esc(a.name)}')">
          ${a.cover
            ? `<img class="album-cover" src="${a.cover}" loading="lazy" alt="">`
            : `<div class="album-cover"></div>`
          }
          <div class="album-label">
            ${esc(a.name)}
            <div class="album-count">${a.count} ${t('photos')}</div>
          </div>
        </div>
      `).join('');
      html += '</div>';
    }

    if (data.photos.length) {
      photos = data.photos;
      html += '<div class="photo-grid">';
      html += data.photos.map((p, i) => `
        <div class="photo-cell" onclick="openViewer(${i})">
          <img class="photo-thumb" ${i < 30 ? `src="${p.thumb}"` : `data-src="${p.thumb}"`} alt="">
          ${p.type === 'video' ? '<div class="video-badge"><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div>' : ''}
          ${p.type === 'gif' ? '<div class="gif-badge">GIF</div>' : ''}
        </div>
      `).join('');
      html += '</div>';
    }

    if (!data.albums.length && !data.photos.length) {
      html = `<div class="empty"><p>${t('emptyFolder')}</p></div>`;
    }

    content().innerHTML = html;
    lazyLoad();
  } catch (err) {
    content().innerHTML = `<div class="empty"><p>${t('error')}: ${esc(err.message)}</p></div>`;
  }
}

// ── Lazy Loading ─────────────────────────────────────────────────────────────

function lazyLoad() {
  const allThumbs = document.querySelectorAll('.photo-thumb[data-src]');

  allThumbs.forEach((img, i) => {
    if (i < 30) img.src = img.dataset.src;
  });

  if (allThumbs.length > 30) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.src = e.target.dataset.src;
          observer.unobserve(e.target);
        }
      });
    }, { rootMargin: '400px' });

    allThumbs.forEach((img, i) => { if (i >= 30) observer.observe(img); });
  }
}

// ── Fullscreen Viewer ────────────────────────────────────────────────────────

function openViewer(index) {
  viewerIndex = index;
  const viewer = $('viewer');
  const slides = $('viewer-slides');

  slides.innerHTML = photos.map((p, i) => {
    const shouldLoad = Math.abs(i - index) <= 1;
    if (p.type === 'video') {
      const posterUrl = p.large || p.thumb;
      return `<div class="viewer-slide">
        <video ${shouldLoad ? `src="${p.original}"` : ''} data-src="${p.original}"
               poster="${posterUrl}" controls playsinline preload="none"></video>
      </div>`;
    }
    const imgSrc = p.type === 'gif' ? p.original : (p.large || p.thumb);
    return `<div class="viewer-slide">
      <img ${shouldLoad ? `src="${imgSrc}"` : ''} data-src="${imgSrc}" alt="">
    </div>`;
  }).join('');

  viewer.style.display = '';
  updateViewerCounter();

  try {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch {}

  const hasPhotos = photos.some(p => p.type !== 'video');
  $('btn-slideshow').style.display = hasPhotos ? '' : 'none';

  requestAnimationFrame(() => {
    const slide = slides.children[index];
    if (slide) slide.scrollIntoView({ inline: 'start', behavior: 'instant' });
  });

  slides.onscroll = () => {
    const w = slides.clientWidth;
    const newIndex = Math.round(slides.scrollLeft / w);
    if (newIndex !== viewerIndex && newIndex >= 0 && newIndex < photos.length) {
      resetZoom();
      viewerIndex = newIndex;
      updateViewerCounter();
      preloadAdjacent();
      $('info-panel').style.display = 'none';
    }
  };

  slides.onmousemove = () => {
    showViewerUI();
    scheduleUiHide();
  };

  slides.onclick = (e) => {
    if ($('info-panel').style.display !== 'none') {
      $('info-panel').style.display = 'none';
      return;
    }
    const actions = document.querySelector('.viewer-actions');
    const hidden = actions.classList.contains('ui-hidden');
    if (hidden) {
      showViewerUI();
      scheduleUiHide();
    } else {
      hideViewerUI();
    }
  };

  setupPinchZoom(slides);
  scheduleUiHide();
}

// ── Pinch-to-Zoom ───────────────────────────────────────────────────────────

function getTouchDist(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function applyZoom() {
  const slide = $('viewer-slides').children[viewerIndex];
  const el = slide?.querySelector('img');
  if (!el) return;
  if (zoomScale <= 1) {
    zoomScale = 1; zoomX = 0; zoomY = 0;
    el.style.transform = '';
    el.style.transformOrigin = '';
    $('viewer-slides').style.overflowX = 'scroll';
    $('viewer-slides').style.touchAction = 'pan-x';
  } else {
    zoomScale = Math.min(zoomScale, 5);
    const maxPan = (zoomScale - 1) * 50;
    zoomX = Math.max(-maxPan, Math.min(maxPan, zoomX));
    zoomY = Math.max(-maxPan, Math.min(maxPan, zoomY));
    el.style.transform = `scale(${zoomScale}) translate(${zoomX / zoomScale}px, ${zoomY / zoomScale}px)`;
    el.style.transformOrigin = 'center center';
    $('viewer-slides').style.overflowX = 'hidden';
    $('viewer-slides').style.touchAction = 'none';
  }
}

function resetZoom() {
  zoomScale = 1; zoomX = 0; zoomY = 0;
  const slide = $('viewer-slides').children[viewerIndex];
  const el = slide?.querySelector('img');
  if (el) { el.style.transform = ''; el.style.transformOrigin = ''; }
  $('viewer-slides').style.overflowX = 'scroll';
  $('viewer-slides').style.touchAction = 'pan-x';
}

function setupPinchZoom(slides) {
  slides.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
      pinchStartScale = zoomScale;
    } else if (e.touches.length === 1 && zoomScale > 1) {
      isPanning = true;
      panStartX = e.touches[0].clientX;
      panStartY = e.touches[0].clientY;
      panStartZoomX = zoomX;
      panStartZoomY = zoomY;
    }
  }, { passive: false });

  slides.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      zoomScale = pinchStartScale * (dist / pinchStartDist);
      applyZoom();
    } else if (e.touches.length === 1 && isPanning && zoomScale > 1) {
      e.preventDefault();
      zoomX = panStartZoomX + (e.touches[0].clientX - panStartX);
      zoomY = panStartZoomY + (e.touches[0].clientY - panStartY);
      applyZoom();
    }
  }, { passive: false });

  slides.addEventListener('touchend', (e) => {
    isPanning = false;
    if (e.touches.length === 0 && zoomScale <= 1.05) {
      resetZoom();
    }
  });

  let lastTap = 0;
  slides.addEventListener('touchend', (e) => {
    if (e.touches.length > 0) return;
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
      if (zoomScale > 1) {
        resetZoom();
      } else {
        zoomScale = 2.5;
        applyZoom();
      }
      lastTap = 0;
    } else {
      lastTap = now;
    }
  });
}

function preloadAdjacent() {
  const slides = $('viewer-slides');
  for (let d = -2; d <= 2; d++) {
    const i = viewerIndex + d;
    if (i >= 0 && i < photos.length) {
      const el = slides.children[i]?.querySelector('img, video');
      if (el && el.dataset.src && !el.hasAttribute('src')) {
        el.src = el.dataset.src;
      }
    }
  }
  for (let d = -2; d <= 2; d++) {
    if (d === 0) continue;
    const i = viewerIndex + d;
    if (i >= 0 && i < photos.length) {
      const vid = slides.children[i]?.querySelector('video');
      if (vid) vid.pause();
    }
  }
}

function updateViewerCounter() {
  $('viewer-counter').textContent = `${viewerIndex + 1} / ${photos.length}`;
}

function closeViewer() {
  stopSlideshow();
  resetZoom();
  if (uiHideTimer) clearTimeout(uiHideTimer);
  $('info-panel').style.display = 'none';
  $('viewer').style.display = 'none';
  $('viewer-slides').innerHTML = '';
  document.querySelector('.viewer-actions')?.classList.remove('ui-hidden');
  document.querySelector('.viewer-close')?.classList.remove('ui-hidden');

  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
  } catch {}
}

// ── Slideshow ────────────────────────────────────────────────────────────────

function toggleSlideshow() {
  if (slideshowActive) stopSlideshow();
  else startSlideshow();
}

function startSlideshow() {
  slideshowActive = true;
  $('btn-slideshow').innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  $('btn-slideshow').classList.add('active');
  advanceSlideshow();
}

function stopSlideshow() {
  slideshowActive = false;
  $('btn-slideshow').innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  $('btn-slideshow').classList.remove('active');
  if (slideshowTimer) clearTimeout(slideshowTimer);
}

function advanceSlideshow() {
  if (!slideshowActive) return;
  slideshowTimer = setTimeout(() => {
    viewerIndex = (viewerIndex + 1) % photos.length;
    const slides = $('viewer-slides');
    const slide = slides.children[viewerIndex];
    if (slide) {
      slide.scrollIntoView({ inline: 'start', behavior: 'smooth' });
      const img = slide.querySelector('img');
      if (img && !img.src && img.dataset.src) img.src = img.dataset.src;
    }
    updateViewerCounter();
    preloadAdjacent();
    advanceSlideshow();
  }, 5000);
}

// ── Settings ─────────────────────────────────────────────────────────────────

let settingSources = [];
let browsingForIndex = -1;

async function showSettings() {
  $('settings').style.display = '';
  $('settings-title').textContent = t('settings');
  const res = await fetch('/api/sources/all');
  const cfg = await res.json();
  settingSources = cfg.sources || [];
  renderSettings();
}

function hideSettings() {
  $('settings').style.display = 'none';
  browsingForIndex = -1;
}

function renderSettings() {
  let html = settingSources.map((s, i) => `
    <div class="source-edit">
      <input type="text" value="${esc(s.name)}" placeholder="Name" oninput="settingSources[${i}].name=this.value">
      <div class="source-path-row">
        <div class="source-path-display" onclick="openBrowser(${i})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          <span>${s.path ? esc(s.path) : t('selectFolder')}</span>
        </div>
      </div>
      <button class="btn-delete" onclick="settingSources.splice(${i},1);renderSettings()">${t('remove')}</button>
    </div>
  `).join('');

  html += `<button class="btn-add" onclick="settingSources.push({name:'',path:'',icon:'folder'});renderSettings()">${t('addSource')}</button>`;
  html += `<button class="btn-save" onclick="saveSources()">${t('save')}</button>`;
  $('settings-body').innerHTML = html;
}

async function openBrowser(index) {
  browsingForIndex = index;
  const startPath = settingSources[index]?.path || '/data';
  await renderBrowser(startPath);
}

async function renderBrowser(dirPath) {
  try {
    const res = await fetch(`/api/browse?path=${encodeURIComponent(dirPath)}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    let html = '<div class="browser">';
    html += `<div class="browser-current">${esc(data.current)}</div>`;
    html += `<div class="browser-info">${data.photoCount} ${t('photosInFolder')}</div>`;

    if (data.parent) {
      html += `<div class="browser-item browser-parent" onclick="renderBrowser('${esc(data.parent)}')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        <span>..</span>
      </div>`;
    }

    for (const f of data.folders) {
      html += `<div class="browser-item" onclick="renderBrowser('${esc(f.path)}')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        <span>${esc(f.name)}</span>
      </div>`;
    }

    html += '</div>';
    html += `<button class="btn-save" onclick="selectFolder('${esc(data.current)}')">${t('chooseFolder')}${data.photoCount ? ` (${data.photoCount} ${t('photos')})` : ''}</button>`;
    html += `<button class="btn-add" onclick="renderSettings()">${t('cancel')}</button>`;

    $('settings-body').innerHTML = html;
  } catch (err) {
    $('settings-body').innerHTML = `<div class="empty"><p>${t('error')}: ${esc(err.message)}</p></div><button class="btn-add" onclick="renderSettings()">${t('back')}</button>`;
  }
}

function selectFolder(folderPath) {
  if (browsingForIndex >= 0 && browsingForIndex < settingSources.length) {
    settingSources[browsingForIndex].path = folderPath;
    if (!settingSources[browsingForIndex].name) {
      settingSources[browsingForIndex].name = folderPath.split('/').filter(Boolean).pop() || t('photos');
    }
  }
  browsingForIndex = -1;
  renderSettings();
}

async function saveSources() {
  const sources = settingSources.filter(s => s.name && s.path);
  await fetch('/api/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources })
  });
  hideSettings();
  currentPath = null;
  navStack = [];
  $('title').textContent = t('appName');
  $('btn-back').style.display = 'none';
  loadSources();
}

// ── UI Auto-Hide ─────────────────────────────────────────────────────────────

function showViewerUI() {
  document.querySelector('.viewer-actions')?.classList.remove('ui-hidden');
  document.querySelector('.viewer-close')?.classList.remove('ui-hidden');
  $('viewer-counter')?.classList.remove('hidden');
}

function hideViewerUI() {
  document.querySelector('.viewer-actions')?.classList.add('ui-hidden');
  document.querySelector('.viewer-close')?.classList.add('ui-hidden');
  $('viewer-counter')?.classList.add('hidden');
}

function scheduleUiHide() {
  if (uiHideTimer) clearTimeout(uiHideTimer);
  uiHideTimer = setTimeout(() => {
    document.querySelector('.viewer-actions')?.classList.add('ui-hidden');
    document.querySelector('.viewer-close')?.classList.add('ui-hidden');
    $('viewer-counter')?.classList.add('hidden');
  }, 2000);
}

// ── Info & Download ──────────────────────────────────────────────────────────

function showInfo() {
  const panel = $('info-panel');
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }

  const p = photos[viewerIndex];
  if (!p) return;

  const sizeStr = p.size >= 1048576
    ? (p.size / 1048576).toFixed(1) + ' MB'
    : (p.size / 1024).toFixed(0) + ' KB';
  const dateStr = new Date(p.mtime).toLocaleString(t('dateLocale'));
  const ext = p.name.split('.').pop().toUpperCase();

  let html = `<div class="info-name">${esc(p.name)}</div>`;
  html += `<div class="info-row"><span class="info-label">${t('type')}</span><span class="info-value">${p.type === 'video' ? t('video') : t('photo')} (${ext})</span></div>`;
  html += `<div class="info-row"><span class="info-label">${t('size')}</span><span class="info-value">${sizeStr}</span></div>`;
  html += `<div class="info-row"><span class="info-label">${t('date')}</span><span class="info-value">${dateStr}</span></div>`;
  html += `<div class="info-path">${esc(p.path)}</div>`;

  $('info-content').innerHTML = html;
  panel.style.display = '';
}

function downloadCurrent() {
  const p = photos[viewerIndex];
  if (!p) return;
  fetch(p.original)
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = p.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Keyboard
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('settings').style.display !== 'none') { hideSettings(); return; }
    if ($('viewer').style.display !== 'none') { closeViewer(); return; }
    goBack();
    return;
  }
  if ($('viewer').style.display !== 'none') {
    if (e.key === 'ArrowRight') {
      viewerIndex = Math.min(viewerIndex + 1, photos.length - 1);
      $('viewer-slides').children[viewerIndex]?.scrollIntoView({ inline: 'start', behavior: 'smooth' });
      updateViewerCounter(); preloadAdjacent();
    }
    if (e.key === ' ') {
      const vid = $('viewer-slides').children[viewerIndex]?.querySelector('video');
      if (vid) { e.preventDefault(); vid.paused ? vid.play() : vid.pause(); }
    }
    if (e.key === 'ArrowLeft') {
      viewerIndex = Math.max(viewerIndex - 1, 0);
      $('viewer-slides').children[viewerIndex]?.scrollIntoView({ inline: 'start', behavior: 'smooth' });
      updateViewerCounter(); preloadAdjacent();
    }
  }
});

// ── Init ─────────────────────────────────────────────────────────────────────
$('title').textContent = t('appName');
document.title = t('appName');
loadSources();
