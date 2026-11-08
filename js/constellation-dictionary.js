(() => {
  'use strict';
  const section = document.getElementById('C-01');
  const catalog = window.ByeolConstellations;
  if (!section || !catalog) return;
  const [map, preview] = section.querySelectorAll('.c01__image');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const groups = ['cheongryong', 'hyeonmu', 'baekho', 'jujak'];
  const positions = [[16, 25], [38, 24], [60, 25], [82, 25], [26, 71], [50, 70], [75, 71]];
  const layers = groups.map(guardian => {
    const layer = document.createElement('div');
    layer.className = 'c01__sky-group';
    layer.dataset.guardian = guardian;
    catalog.filter(star => star.guardian === guardian).forEach((star, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'c01__sky-star';
      button.dataset.star = star.file;
      button.setAttribute('aria-label', `${star.groupName} ${star.name} ${star.animal}자리 선택`);
      button.style.left = `${positions[i][0]}%`;
      button.style.top = `${positions[i][1]}%`;
      const img = new Image();
      img.src = `01_SITE_IMAGES/28su/${star.file}.svg`;
      img.alt = '';
      img.draggable = false;
      button.append(img);
      const caption = document.createElement('span');
      caption.className = 'c01__sky-caption';
      caption.setAttribute('aria-hidden', 'true');
      const captionName = document.createElement('span');
      captionName.textContent = star.name;
      const captionAnimal = document.createElement('span');
      captionAnimal.textContent = `${star.animal}자리`;
      caption.append(captionName, captionAnimal);
      button.append(caption);
      const hover = active => {
        button.classList.toggle('is-hovered', active);
        layer.classList.toggle('has-hover', !!layer.querySelector('.is-hovered'));
        hovered = active;
        schedule();
      };
      button.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') hover(true); });
      button.addEventListener('pointerleave', () => hover(false));
      button.addEventListener('focus', () => hover(true));
      button.addEventListener('blur', () => hover(false));
      button.addEventListener('pointerdown', e => e.stopPropagation());
      button.addEventListener('click', () => window.dispatchEvent(new CustomEvent('byeol:c01-select', { detail: { index: catalog.indexOf(star) } })));
      layer.append(button);
    });
    map.append(layer);
    return layer;
  });
  const portrait = new Image();
  portrait.className = 'c01__sky-preview';
  portrait.alt = '';
  preview.append(portrait);
  let groupIndex = 0, selected = 2, pinned = false, visible = false, hovered = false, timer = 0;
  function renderGroup(guardian) {
    groupIndex = groups.indexOf(guardian);
    section.dataset.guardian = guardian;
    const selectedStar = catalog[selected];
    layers.forEach(layer => {
      const active = layer.dataset.guardian === guardian;
      layer.classList.toggle('is-visible', active);
      layer.inert = !active;
      if (!active) layer.classList.remove('has-hover');
      layer.classList.toggle('has-selection', pinned && selectedStar.guardian === guardian);
      layer.querySelectorAll('button').forEach(button => {
        if (!active) button.classList.remove('is-hovered');
        const chosen = pinned && button.dataset.star === selectedStar.file;
        button.classList.toggle('is-selected', chosen);
        button.setAttribute('aria-pressed', String(chosen));
      });
    });
    hovered = !!section.querySelector('.c01__sky-group.is-visible .is-hovered');
    schedule();
  }
  function render(index, automatic) {
    const star = catalog[index];
    if (!star) return;
    selected = index;
    if (!automatic) pinned = true;
    section.dataset.constellation = star.file;
    section.querySelector('#c01-preview-hanja').textContent = `${star.hanja}宿 · ${star.animal}자리`;
    renderGroup(star.guardian);
    portrait.src = `01_SITE_IMAGES/28su/${star.file}.svg`;
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (!visible || pinned || hovered || reduced.matches || document.hidden || document.body.classList.contains('is-o01-active')) return;
    timer = setTimeout(() => {
      const guardian = groups[(groupIndex + 1) % groups.length];
      const index = catalog.findIndex(star => star.guardian === guardian);
      window.dispatchEvent(new CustomEvent('byeol:c01-select', { detail: { index, automatic: true } }));
    }, 6500);
  }
  window.addEventListener('byeol:c01-change', event => render(event.detail.index, event.detail.automatic));
  window.addEventListener('byeol:c01-group', event => {
    const star = catalog.find(star => star.groupName === event.detail.group);
    if (!star) return;
    pinned = true;
    renderGroup(star.guardian);
  });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) pinned = false;
    else render(selected, true);
    schedule();
  }, { root: document.getElementById('viewport'), threshold: 0.35 }).observe(map);
  document.addEventListener('visibilitychange', schedule);
  new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  reduced.addEventListener('change', schedule);
  render(selected, true);
})();
