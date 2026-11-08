(() => {
  'use strict';
  const thumbnail = document.getElementById('other-map-image');
  const opener = document.getElementById('other-map-open');
  const status = document.getElementById('other-map-status');
  const dialog = document.getElementById('map-viewer');
  const stage = document.getElementById('map-viewer-stage');
  const image = document.getElementById('map-viewer-image');
  const level = document.getElementById('map-zoom-level');
  const zoomIn = document.getElementById('map-zoom-in');
  const zoomOut = document.getElementById('map-zoom-out');
  const help = document.getElementById('map-viewer-help');
  const mobile = matchMedia('(max-width: 767px), (max-width: 1023px) and (max-height: 500px) and (pointer: coarse)');
  const pointers = new Map();
  const MIN_ZOOM = 0.5, MAX_ZOOM = 16;
  let zoom = 1, panX = 0, panY = 0, fitWidth = 0, fitHeight = 0;
  let gesture = null, moved = false;
  let stageBounds, rasterZoom = 1, frame = 0, settleTimer = 0, detailPromise;

  function updateHelp() {
    help.textContent = mobile.matches
      ? '두 손가락으로 확대 · 축소 / 드래그로 이동'
      : '휠로 확대 · 축소 / 드래그로 이동';
  }
  updateHelp();
  mobile.addEventListener('change', updateHelp);

  // The lightweight preview loads with the panel. Vector detail is fetched
  // only on demand; the 259 MB design original is never loaded by the site.
  document.getElementById('rail-other').addEventListener('click', () => {
    if (!document.getElementById('other-overlay').classList.contains('is-open') || thumbnail.getAttribute('src')) return;
    status.textContent = '지도 불러오는 중…';
    opener.setAttribute('aria-busy', 'true');
    thumbnail.src = thumbnail.dataset.mapSrc;
  });
  thumbnail.addEventListener('load', () => {
    thumbnail.hidden = false;
    status.hidden = true;
    opener.disabled = false;
    opener.removeAttribute('aria-busy');
  });
  thumbnail.addEventListener('error', () => {
    thumbnail.hidden = true;
    status.hidden = false;
    status.textContent = '지도를 불러오지 못했습니다';
    opener.disabled = true;
    opener.removeAttribute('aria-busy');
    thumbnail.removeAttribute('src');
  });

  function render() {
    const bounds = stageBounds;
    const limitX = Math.max(0, (fitWidth * zoom - bounds.width) / 2);
    const limitY = Math.max(0, (fitHeight * zoom - bounds.height) / 2);
    panX = Math.max(-limitX, Math.min(limitX, panX));
    panY = Math.max(-limitY, Math.min(limitY, panY));
    // During wheel/pinch input, only composite transforms once per frame.
    // Redraw vector detail at its final dimensions after zoom settles.
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      image.style.transform = `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${zoom / rasterZoom})`;
    });
    level.value = `${Math.round(zoom * 100)}%`;
    zoomIn.disabled = zoom >= MAX_ZOOM;
    zoomOut.disabled = zoom <= MIN_ZOOM;
  }
  function settleResolution() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (!dialog.open) return;
      // Bound the backing surface while preserving the full interaction range.
      // The vector remains the source; extra zoom uses its composited transform.
      const pixelBudget = mobile.matches ? 12000000 : 24000000;
      rasterZoom = Math.min(zoom, Math.sqrt(pixelBudget / (fitWidth * fitHeight)));
      image.style.width = `${fitWidth * rasterZoom}px`;
      image.style.height = `${fitHeight * rasterZoom}px`;
      render();
    }, 160);
  }
  function fit() {
    clearTimeout(settleTimer);
    const bounds = stageBounds = stage.getBoundingClientRect();
    const ratio = thumbnail.naturalWidth / thumbnail.naturalHeight;
    fitWidth = Math.min(bounds.width, bounds.height * ratio);
    fitHeight = fitWidth / ratio;
    zoom = 1;
    rasterZoom = 1;
    panX = panY = 0;
    image.style.width = `${fitWidth}px`;
    image.style.height = `${fitHeight}px`;
    image.style.transform = 'translate(-50%, -50%)';
    render();
  }
  function zoomAt(next, x = 0, y = 0) {
    next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    const factor = next / zoom;
    panX = x - (x - panX) * factor;
    panY = y - (y - panY) * factor;
    zoom = next;
    render();
    settleResolution();
  }
  function stagePoint(x, y) {
    const bounds = stageBounds;
    return { x: x - bounds.left - bounds.width / 2, y: y - bounds.top - bounds.height / 2 };
  }
  opener.addEventListener('click', () => {
    if (opener.disabled) return;
    image.src = thumbnail.currentSrc || thumbnail.src;
    dialog.showModal();
    fit();
    if (!detailPromise) {
      const detail = new Image();
      detail.src = thumbnail.dataset.mapDetailSrc;
      detailPromise = detail.decode().then(() => detail.src).catch(() => {
        detailPromise = null;
        return null;
      });
    }
    detailPromise.then(src => { if (src && dialog.open) image.src = src; });
  });
  document.getElementById('map-viewer-close').addEventListener('click', () => dialog.close());
  document.getElementById('map-zoom-reset').addEventListener('click', fit);
  zoomIn.addEventListener('click', () => zoomAt(zoom * 1.3));
  zoomOut.addEventListener('click', () => zoomAt(zoom / 1.3));
  stage.addEventListener('wheel', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const point = stagePoint(event.clientX, event.clientY);
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1);
    zoomAt(zoom * Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.004), point.x, point.y);
  }, { passive: false });

  function beginGesture() {
    const points = [...pointers.values()];
    if (!points.length) { gesture = null; return; }
    const a = points[0], b = points[1] || a;
    gesture = {
      x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
      distance: points.length > 1 ? Math.hypot(a.x - b.x, a.y - b.y) : 0,
      zoom, panX, panY,
    };
  }
  stage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (!pointers.size) moved = false;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('is-dragging');
    beginGesture();
  });
  stage.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.values()], a = points[0], b = points[1] || a;
    const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    if (Math.hypot(x - gesture.x, y - gesture.y) > 3 || points.length > 1) moved = true;
    const next = gesture.distance > 0 && points.length > 1
      ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, gesture.zoom * Math.hypot(a.x - b.x, a.y - b.y) / gesture.distance))
      : gesture.zoom;
    const anchor = stagePoint(gesture.x, gesture.y), factor = next / gesture.zoom;
    zoom = next;
    panX = anchor.x - (anchor.x - gesture.panX) * factor + x - gesture.x;
    panY = anchor.y - (anchor.y - gesture.panY) * factor + y - gesture.y;
    render();
    if (zoom !== rasterZoom) settleResolution();
  });
  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (!pointers.size) stage.classList.remove('is-dragging');
    beginGesture();
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  stage.addEventListener('lostpointercapture', endPointer);
  stage.addEventListener('click', (event) => {
    if (moved) return;
    const bounds = image.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (['+', '=', '-', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      if (event.key === '+' || event.key === '=') zoomAt(zoom * 1.3);
      if (event.key === '-') zoomAt(zoom / 1.3);
      if (event.key === '0') fit();
      if (event.key === 'ArrowLeft') panX += 50;
      if (event.key === 'ArrowRight') panX -= 50;
      if (event.key === 'ArrowUp') panY += 50;
      if (event.key === 'ArrowDown') panY -= 50;
      render();
    }
  });
  dialog.addEventListener('close', () => {
    clearTimeout(settleTimer);
    cancelAnimationFrame(frame);
    frame = 0;
    pointers.clear();
    gesture = null;
    stage.classList.remove('is-dragging');
    opener.focus({ preventScroll: true });
  });
  window.addEventListener('resize', () => { if (dialog.open) fit(); });
})();
