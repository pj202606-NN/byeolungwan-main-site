(() => {
  'use strict';
  const catalog = window.ByeolConstellations;
  const relations = window.ByeolRelations;
  const c02 = document.getElementById('C-02'), c03 = document.getElementById('C-03');
  if (!catalog || !relations || !c02 || !c03) return;
  const colors = { '천생연분': '#b8eaff', '보완': '#73caff', '주의': '#3195d6' };
  Object.entries(colors).forEach(([type, color], i) => c02.style.setProperty(`--relation-color-${i}`, color));
  function mountArt(container) {
    const img = new Image();
    img.className = 'compatibility__star';
    img.alt = '';
    img.draggable = false;
    container.append(img);
    return img;
  }
  function setArt(img, index) {
    img.src = `01_SITE_IMAGES/28su/${catalog[index].file}.svg`;
    img.dataset.star = catalog[index].file;
  }
  function label(id, index) {
    const star = catalog[index];
    document.getElementById(id).textContent = `${star.hanja}宿 · ${star.animal}자리`;
  }
  const selectedArt = mountArt(c02.querySelector('.c02__selected-image'));
  const smallArt = [...c02.querySelectorAll('.c02__relation-image')].map(mountArt);
  const diagram = c02.querySelector('.c-ref__ph.c02__left');
  diagram.removeAttribute('aria-hidden');
  const NS = 'http://www.w3.org/2000/svg';
  function svgNode(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  }
  const svg = svgNode('svg', { viewBox: '0 0 600 600', class: 'compatibility__diagram', role: 'group', 'aria-label': '28수 별자리 궁합 관계도' });
  svg.append(svgNode('circle', { cx: 300, cy: 300, r: 230, fill: 'none', stroke: 'white', 'stroke-width': 1, opacity: .28 }));
  const lines = svgNode('g', { fill: 'none', stroke: 'white' });
  svg.append(lines);
  const points = catalog.map((star, index) => {
    const angle = index / 28 * Math.PI * 2 - Math.PI / 2;
    const point = { x: 300 + Math.cos(angle) * 230, y: 300 + Math.sin(angle) * 230 };
    const group = svgNode('g', { role: 'button', tabindex: 0, 'aria-label': `${star.groupName} ${star.name} 선택`, 'data-index': index, class: 'compatibility__point' });
    group.append(svgNode('circle', { cx: point.x, cy: point.y, r: 13, fill: 'transparent' }));
    const dot = svgNode('circle', { cx: point.x, cy: point.y, r: 3.5, fill: 'white', class: 'compatibility__dot' });
    group.append(dot);
    const text = svgNode('text', { x: 300 + Math.cos(angle) * 260, y: 300 + Math.sin(angle) * 260, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'white', 'font-size': 12 });
    text.textContent = star.name;
    group.append(text);
    const select = () => window.dispatchEvent(new CustomEvent('byeol:c02-select', { detail: { index } }));
    group.addEventListener('click', select);
    group.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); });
    group.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
    });
    svg.append(group);
    return { ...point, dot, group };
  });
  diagram.append(svg);
  function renderC02(index) {
    c02.dataset.starIndex = index;
    const star = catalog[index];
    document.getElementById('c02-selected-name').textContent = star.name;
    label('c02-selected-hanja', index);
    setArt(selectedArt, index);
    const linked = relations.of(index);
    linked.forEach((relation, i) => setArt(smallArt[i], relation.idx));
    lines.replaceChildren();
    linked.forEach((relation, i) => {
      const line = svgNode('line', { x1: points[index].x, y1: points[index].y, x2: points[relation.idx].x, y2: points[relation.idx].y, 'stroke-width': i === 0 ? 1.8 : 1.2, opacity: i === 0 ? .95 : .65, 'data-target': relation.idx });
      line.setAttribute('stroke', colors[relation.type]);
      if (i === 3) line.setAttribute('stroke-dasharray', '3 5');
      else if (i > 0) line.setAttribute('stroke-dasharray', '8 4');
      lines.append(line);
    });
    points.forEach((point, i) => {
      const active = i === index, related = linked.some(relation => relation.idx === i);
      point.group.setAttribute('opacity', active ? 1 : related ? .85 : .35);
      point.group.setAttribute('aria-pressed', String(active));
      point.dot.setAttribute('r', active ? 7 : related ? 5 : 3.5);
      point.dot.setAttribute('fill', related ? colors[linked.find(relation => relation.idx === i).type] : 'white');
    });
  }
  const pairArt = [...c03.querySelectorAll(':scope > .c-ref__ph')].map(mountArt);
  function renderC03(pair) {
    pair.forEach((index, slot) => {
      index ??= slot === 0 ? 2 : 15;
      setArt(pairArt[slot], index);
      document.getElementById(`c03-picked-name-${slot}`).textContent = catalog[index].name;
      label(`c03-picked-hanja-${slot}`, index);
    });
  }
  window.addEventListener('byeol:c02-change', e => renderC02(e.detail.index));
  window.addEventListener('byeol:c03-change', e => renderC03(e.detail.pair));
  renderC02(2);
  renderC03([2, 15]);
  const detail = document.getElementById('C-04');
  const detailArt = [...detail.querySelectorAll(':scope > .c-ref__ph')].map(mountArt);
  function renderDetail(pair) {
    pair.forEach((index, slot) => {
      setArt(detailArt[slot], index);
      label(`c04-hanja-${slot}`, index);
    });
  }
  window.addEventListener('byeol:c04-change', e => renderDetail(e.detail.pair));
  renderDetail(JSON.parse(detail.dataset.pair || '[2,15]'));
})();
