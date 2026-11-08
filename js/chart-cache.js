(() => {
  'use strict';
  // The original SVG stays available as a fallback and for the other scenes.
  // Only the decorative disc is cached; 28-su and the zoomable map stay vector.
  fetch('01_SITE_IMAGES/chart-cache.json').then(response => {
    if (!response.ok) throw new Error('chart metadata');
    return response.json();
  }).then(data => {
    for (const prefix of ['o01', 'm00']) {
      const mount = document.getElementById(`${prefix}-chart-mount`);
      if (!mount) continue;
      const rotor = document.createElement('div');
      rotor.className = 'chart-cache__rotor';
      rotor.setAttribute('aria-hidden', 'true');
      rotor.style.transformOrigin = `${data[prefix].center.x}% ${data[prefix].center.y}%`;
      const image = new Image();
      image.alt = '';
      image.className = 'chart-cache__image';
      image.src = `01_SITE_IMAGES/${prefix}-chart-cache.webp`;
      rotor.append(image);
      data[prefix].points.forEach((point, index) => {
        const dot = document.createElement('i');
        dot.className = 'chart-cache__dot';
        dot.style.cssText = `left:${point.x}%;top:${point.y}%;width:${point.r}%;height:${point.r}%;animation-duration:${9 + index % 7}s;animation-delay:-${index * .71}s`;
        rotor.append(dot);
      });
      image.decode().then(() => {
        mount.append(rotor);
        mount.classList.add('is-chart-cached');
      }).catch(() => {});
    }
  }).catch(() => {});
})();
