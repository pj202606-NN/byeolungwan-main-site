(() => {
  'use strict';
  const section = document.getElementById('E-02');
  if (!section) return;
  const art = section.querySelector('.e02__constellation-art');
  const name = section.querySelector('.e02__sample-title');
  const hanja = section.querySelector('.e02__sample-hanja');
  const portrait = section.querySelector('.e02__dragon-img');
  const title = section.querySelector('.e02__dragon-title');
  const description = section.querySelector('.e02__dragon-desc');
  const nav = section.querySelector('.e02__guardian-nav');
  const controls = [...nav.querySelectorAll('[data-e02-group]')];
  const autoplay = document.getElementById('e02-autoplay');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const groups = [
    { id: 'cheongryong', name: '청룡', direction: '동방', image: 'e-02-cheongryong-optimized.webp' },
    { id: 'hyeonmu', name: '현무', direction: '북방', image: 'e-02-hyeonmu-optimized.webp' },
    { id: 'baekho', name: '백호', direction: '서방', image: 'e-02-baekho-optimized.webp' },
    { id: 'jujak', name: '주작', direction: '남방', image: 'e-02-jujak-optimized.webp' },
  ];
  groups.forEach(group => {
    group.stars = window.ByeolData.catalog.filter(star => star.guardian === group.id);
  });
  // Use the dedicated wide E-02 portraits, separate from the opening artwork.
  groups.forEach(group => {
    const body = document.querySelector(`.story__guardian[data-guardian="${group.name}"] .story__guardian-body`);
    group.description = body.cloneNode(true);
    group.description.querySelectorAll('br').forEach(br => br.replaceWith(' '));
    group.description = group.description.textContent.trim();
  });
  const stars = groups.flatMap(group => group.stars.map(star => ({ ...star, group })));
  const images = new Map();
  window.ByeolConstellations = window.ByeolData.catalog;
  let index = 2, visible = false, paused = reduced.matches, hovered = false;
  let timer = 0, transitionTimer = 0, generation = 0, changing = false;
  const INTERVAL = 5500;

  function decode(src) {
    if (!images.has(src)) {
      const img = new Image();
      img.src = src;
      images.set(src, img.decode().catch(error => { images.delete(src); throw error; }));
    }
    return images.get(src);
  }
  function canRotate() {
    return visible && !paused && !hovered && !document.hidden && !changing &&
      !document.body.classList.contains('is-o01-active') &&
      !nav.contains(document.activeElement?.matches(':focus-visible') ? document.activeElement : null) &&
      !document.querySelector('.nav-overlay.is-open');
  }
  function schedule() {
    clearTimeout(timer);
    section.classList.toggle('is-sky-active', visible && !paused && !reduced.matches && !document.hidden &&
      !document.body.classList.contains('is-o01-active') && !document.querySelector('.nav-overlay.is-open'));
    if (canRotate()) timer = setTimeout(() => select((index + 1) % stars.length), INTERVAL);
  }
  function syncAutoplay() {
    autoplay.setAttribute('aria-pressed', String(paused));
    autoplay.setAttribute('aria-label', paused ? '자동 전환 재생' : '자동 전환 정지');
    autoplay.querySelector('path').setAttribute('d', paused ? 'M6 3.5 16 10 6 16.5Z' : 'M6 4v12M14 4v12');
  }
  function commit(next) {
    const star = stars[next], group = star.group;
    index = next;
    section.dataset.constellation = star.file;
    section.dataset.guardian = group.id;
    art.src = `01_SITE_IMAGES/28su/${star.file}.svg`;
    art.alt = `${star.name} 별자리`;
    name.textContent = star.name;
    const identity = document.createElement('span');
    identity.textContent = `${star.hanja}宿 · ${star.constellationName}`;
    const range = document.createElement('span');
    range.className = 'e02__birth-range';
    range.textContent = star.dateRange;
    hanja.replaceChildren(identity, range);
    portrait.src = `01_SITE_IMAGES/${group.image}`;
    portrait.alt = `${group.direction} ${group.name}`;
    title.textContent = `${group.direction} ${group.name} - 7수`;
    description.textContent = group.description;
    controls.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.e02Group === group.id)));
  }
  async function select(next) {
    const token = ++generation, star = stars[next];
    clearTimeout(timer);
    clearTimeout(transitionTimer);
    changing = true;
    try {
      await Promise.all([decode(`01_SITE_IMAGES/28su/${star.file}.svg`), decode(`01_SITE_IMAGES/${star.group.image}`)]);
    } catch {
      if (token !== generation) return;
      changing = false;
      section.classList.remove('is-changing-star', 'is-changing-guardian');
      schedule();
      return;
    }
    if (token !== generation) return;
    section.classList.add('is-changing-star');
    section.classList.toggle('is-changing-guardian', stars[index].group !== star.group);
    const apply = () => {
      if (token !== generation) return;
      commit(next);
      section.classList.remove('is-changing-star', 'is-changing-guardian');
      changing = false;
      schedule();
    };
    if (reduced.matches) apply();
    else transitionTimer = setTimeout(apply, 300);
  }
  controls.forEach(button => button.addEventListener('click', () => {
    const next = stars.findIndex(star => star.group.id === button.dataset.e02Group);
    select(next);
  }));
  autoplay.addEventListener('click', () => { paused = !paused; syncAutoplay(); schedule(); });
  nav.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { hovered = true; schedule(); } });
  nav.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  nav.addEventListener('focusin', schedule);
  nav.addEventListener('focusout', () => queueMicrotask(schedule));
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', () => { paused = reduced.matches; syncAutoplay(); schedule(); });
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting && entry.intersectionRatio >= 0.35; schedule(); }, {
    root: document.getElementById('viewport'), threshold: [0, 0.35],
  }).observe(section);
  const visibility = new MutationObserver(schedule);
  visibility.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.querySelectorAll('.nav-overlay').forEach(overlay => visibility.observe(overlay, { attributes: true, attributeFilter: ['class'] }));
  commit(index);
  syncAutoplay();
})();
