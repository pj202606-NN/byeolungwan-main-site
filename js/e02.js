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
  // Keep the project's spellings (류수/루수) and supplied animal names.
  // Other animal correspondences: https://seore.org/raw/문서:3원%2028수
  const groups = [
    { id: 'cheongryong', name: '청룡', direction: '동방', image: 'e-02-cheongryong-optimized.webp', stars: [
      ['CD-01-gak', '角', '각수', '이무기'], ['CD-02-hang', '亢', '항수', '용'],
      ['CD-03-jeo', '氐', '저수', '너구리'], ['CD-04-bang', '房', '방수', '토끼'],
      ['CD-05-sim', '心', '심수', '여우'], ['CD-06-mi', '尾', '미수', '호랑이'], ['CD-07-gi', '箕', '기수', '표범'],
    ] },
    { id: 'hyeonmu', name: '현무', direction: '북방', image: 'e-02-hyeonmu-optimized.webp', stars: [
      ['HM-01-du', '斗', '두수', '해태'], ['HM-02-u', '牛', '우수', '소'],
      ['HM-03-yeo', '女', '여수', '박쥐'], ['HM-04-heo', '虛', '허수', '쥐'],
      ['HM-05-wi', '危', '위수', '제비'], ['HM-06-sil', '室', '실수', '돼지'], ['HM-07-byeok', '壁', '벽수', '알유'],
    ] },
    { id: 'baekho', name: '백호', direction: '서방', image: 'e-02-baekho-optimized.webp', stars: [
      ['BH-01-gyu', '奎', '규수', '이리'], ['BH-02-ru', '婁', '루수', '개'],
      ['BH-03-wi', '胃', '위수', '꿩'], ['BH-04-myo', '昴', '묘수', '닭'],
      ['BH-05-pil', '畢', '필수', '까마귀'], ['BH-06-ja', '觜', '자수', '원숭이'], ['BH-07-sam', '參', '삼수', '유인원'],
    ] },
    { id: 'jujak', name: '주작', direction: '남방', image: 'e-02-jujak-optimized.webp', stars: [
      ['JJ-01-jeong', '井', '정수', '들개'], ['JJ-02-gwi', '鬼', '귀수', '양'],
      ['JJ-03-ryu', '柳', '류수', '노루'], ['JJ-04-seong', '星', '성수', '말'],
      ['JJ-05-jang', '張', '장수', '사슴'], ['JJ-06-ik', '翼', '익수', '뱀'], ['JJ-07-jin', '軫', '진수', '지렁이'],
    ] },
  ];
  // Use the dedicated wide E-02 portraits, separate from the opening artwork.
  groups.forEach(group => {
    const body = document.querySelector(`.story__guardian[data-guardian="${group.name}"] .story__guardian-body`);
    group.description = body.cloneNode(true);
    group.description.querySelectorAll('br').forEach(br => br.replaceWith(' '));
    group.description = group.description.textContent.trim();
  });
  const stars = groups.flatMap(group => group.stars.map(values => ({
    file: values[0], hanja: values[1], name: values[2], animal: values[3], group,
  })));
  const images = new Map();
  window.ByeolConstellations = Object.freeze(stars.map(star => Object.freeze({
    file: star.file, name: star.name, hanja: star.hanja, animal: star.animal,
    guardian: star.group.id, groupName: star.group.name, direction: star.group.direction,
  })));
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
    hanja.textContent = `${star.hanja}宿 · ${star.animal}자리`;
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
