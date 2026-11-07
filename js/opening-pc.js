// Shared opening scenes. Responsive layout and touch input extend the same
// scene data, transitions, progress and help used by the desktop opening.
(() => {
  'use strict';
  const root = document.getElementById('opening-pc');
  if (!root) return;
  const opening = document.getElementById('opening');
  const o01 = document.getElementById('o01-scene');
  const mobile = matchMedia('(max-width: 767px), (max-width: 1280px) and (pointer: coarse)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const surface = root.querySelector('.o02__tilt-surface');
  const image = root.querySelector('.o02__image');
  const light = root.querySelector('.opening-pc__light');
  const lantern = root.querySelector('.opening-pc__lantern');
  const help = root.querySelector('.opening-pc__help');
  const helpBackdrop = root.querySelector('.opening-pc__help-backdrop');
  const helpContent = root.querySelector('.opening-pc__help-content');
  const close = root.querySelector('.opening-pc__help-close');
  const progress = root.querySelector('.opening-pc__progress');
  const exploration = document.getElementById('opening-exploration');
  const guardianGroup = exploration.querySelector('.exploration__guardians');
  const starsGroup = exploration.querySelector('.exploration__stars');
  const activeGuardian = exploration.querySelector('.exploration__active');
  const finalScene = document.getElementById('o07-scene');
  const finalDoors = root.querySelector('.o07__doors');
  const stageIds = ['O-02', 'O-03', 'O-04', 'O-05', 'O-06', 'O-07'];
  const scenes = {
    'O-02': { element: document.getElementById('o02-scene'), help: '' },
    'O-03': { element: exploration, help: '' },
    'O-04': { element: exploration, help: '' },
    'O-05': { element: exploration, help: '' },
    'O-06': { element: document.getElementById('o06-scene'), help: '' },
    'O-07': { element: finalScene, help: '' },
  };
  const state = { scene: null, transitioning: false, progress: 'O-02', explorationMode: null, hoveredGuardian: null, selectedGuardian: null };
  // Screen positions follow O-03.png, rather than modern map orientation.
  // Stable IDs distinguish HM-05 (危) from BH-03 (胃).
  const guardians = {
    cheongryong: {
      name: '청룡', direction: '동쪽', color: '#9bafb5',
      images: { default: '01_SITE_IMAGES/sasin-cheongryong-default.webp', hover: '01_SITE_IMAGES/sasin-cheongryong-hover.webp', active: '01_SITE_IMAGES/sasin-cheongryong-active.webp' },
      stars: [
        { id: 'CD-01', file: 'CD-01-gak.svg', name: '각수' }, { id: 'CD-02', file: 'CD-02-hang.svg', name: '항수' },
        { id: 'CD-03', file: 'CD-03-jeo.svg', name: '저수', animal: '너구리자리' }, { id: 'CD-04', file: 'CD-04-bang.svg', name: '방수' },
        { id: 'CD-05', file: 'CD-05-sim.svg', name: '심수' }, { id: 'CD-06', file: 'CD-06-mi.svg', name: '미수' }, { id: 'CD-07', file: 'CD-07-gi.svg', name: '기수' },
      ],
    },
    hyeonmu: {
      name: '현무', direction: '북쪽', color: '#87979f',
      images: { default: '01_SITE_IMAGES/sasin-hyeonmu-default.webp', hover: '01_SITE_IMAGES/sasin-hyeonmu-hover.webp', active: '01_SITE_IMAGES/sasin-hyeonmu-active.webp' },
      stars: [
        { id: 'HM-01', file: 'HM-01-du.svg', name: '두수' }, { id: 'HM-02', file: 'HM-02-u.svg', name: '우수' },
        { id: 'HM-03', file: 'HM-03-yeo.svg', name: '여수' }, { id: 'HM-04', file: 'HM-04-heo.svg', name: '허수' },
        { id: 'HM-05', file: 'HM-05-wi.svg', name: '위수' }, { id: 'HM-06', file: 'HM-06-sil.svg', name: '실수' }, { id: 'HM-07', file: 'HM-07-byeok.svg', name: '벽수' },
      ],
    },
    baekho: {
      name: '백호', direction: '서쪽', color: '#ffffff',
      images: { default: '01_SITE_IMAGES/sasin-baekho-default.webp', hover: '01_SITE_IMAGES/sasin-baekho-hover.webp', active: '01_SITE_IMAGES/sasin-baekho-active.webp' },
      stars: [
        { id: 'BH-01', file: 'BH-01-gyu.svg', name: '규수' }, { id: 'BH-02', file: 'BH-02-ru.svg', name: '루수', animal: '개자리' },
        { id: 'BH-03', file: 'BH-03-wi.svg', name: '위수' }, { id: 'BH-04', file: 'BH-04-myo.svg', name: '묘수' },
        { id: 'BH-05', file: 'BH-05-pil.svg', name: '필수' }, { id: 'BH-06', file: 'BH-06-ja.svg', name: '자수' }, { id: 'BH-07', file: 'BH-07-sam.svg', name: '삼수' },
      ],
    },
    jujak: {
      name: '주작', direction: '남쪽', color: '#c3a4a1',
      images: { default: '01_SITE_IMAGES/sasin-jujak-default.webp', hover: '01_SITE_IMAGES/sasin-jujak-hover.webp', active: '01_SITE_IMAGES/sasin-jujak-active.webp' },
      stars: [
        { id: 'JJ-01', file: 'JJ-01-jeong.svg', name: '정수' }, { id: 'JJ-02', file: 'JJ-02-gwi.svg', name: '귀수' },
        { id: 'JJ-03', file: 'JJ-03-ryu.svg', name: '류수' }, { id: 'JJ-04', file: 'JJ-04-seong.svg', name: '성수' },
        { id: 'JJ-05', file: 'JJ-05-jang.svg', name: '장수' }, { id: 'JJ-06', file: 'JJ-06-ik.svg', name: '익수' }, { id: 'JJ-07', file: 'JJ-07-jin.svg', name: '진수' },
      ],
    },
  };
  let assetsReady;
  const finalCards = Object.entries(guardians).flatMap(([guardian, data]) => data.stars.map(star => ({
    id: star.id, name: star.name, guardian, svg: `01_SITE_IMAGES/28su/${star.file}`, image: '',
  }))).map((card, index) => ({ ...card, angle: index * 360 / 28 }));
  let finalPrepared = false;
  let exitController;
  let handingOff = false;
  const guardianButtons = new Map();
  const starButtons = [];
  let sceneGeneration = 0;
  let hoverArmed = false;
  let bridge;
  let transitionTimer = 0;
  let activity;
  let resizeObserver;
  let raf = 0;
  let bounds;
  let lastFrame = 0;
  let lastWheel = -Infinity;
  let waitForQuiet = false;
  let wheelAccum = 0;
  let dragId = null;
  let dragOrigin;
  let tiltHover = false;
  let lanternLit = false;
  let chart;
  const target = { x: 0, y: 0, rx: 0, ry: 0 };
  const current = { x: 0, y: 0, rx: 0, ry: 0 };
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function prepareExploration() {
    if (assetsReady) return assetsReady;
    const images = [];
    const load = (src, element = new Image()) => {
      element.decoding = 'async';
      element.src = src;
      images.push(element);
      return element;
    };
    const disc = exploration.querySelector('.exploration__disc');
    load(disc.dataset.src, disc);
    Object.entries(guardians).forEach(([id, data]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'exploration__guardian';
      button.dataset.guardian = id;
      button.setAttribute('aria-label', `${data.direction}의 사신수 ${data.name} 선택`);
      button.setAttribute('aria-pressed', 'false');
      for (const variant of ['default', 'hover']) {
        const art = load(data.images[variant]);
        art.className = `exploration__guardian-${variant}`;
        art.alt = '';
        art.width = art.height = 1500;
        button.append(art);
      }
      load(data.images.active);
      data.stars.forEach(star => load(`01_SITE_IMAGES/28su/${star.file}?v=2`));
      guardianGroup.append(button);
      guardianButtons.set(id, button);
    });
    for (let index = 0; index < 7; index++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'exploration__star';
      button.style.setProperty('--star-index', index);
      const art = new Image();
      art.className = 'exploration__star-art';
      art.alt = '';
      art.width = art.height = 250;
      const label = document.createElement('span');
      label.className = 'exploration__star-label';
      button.append(art, label);
      starsGroup.append(button);
      starButtons.push(button);
    }
    assetsReady = Promise.all(images.map(art => art.decode()));
    return assetsReady;
  }

  function updateExploration(mode, id = null) {
    if (mode === 'overview') hoverArmed = false;
    state.explorationMode = mode;
    exploration.dataset.mode = mode;
    exploration.dataset.guardian = id || '';
    guardianGroup.inert = mode === 'selected';
    guardianGroup.setAttribute('aria-hidden', String(mode === 'selected'));
    starsGroup.inert = mode !== 'selected';
    starsGroup.setAttribute('aria-hidden', String(mode !== 'selected'));
    exploration.querySelector('.exploration__selected-copy').setAttribute('aria-hidden', String(mode !== 'selected'));
    activeGuardian.setAttribute('aria-hidden', String(mode !== 'selected'));
    guardianButtons.forEach((button, key) => {
      button.classList.toggle('is-hover', mode === 'hover' && key === id);
      button.setAttribute('aria-pressed', String(mode === 'selected' && key === id));
    });
    exploration.querySelectorAll('[data-ink]').forEach(el => el.classList.toggle('is-current', mode === 'hover' && el.dataset.ink === id));
    exploration.querySelector('.exploration__hover-copy').textContent = mode === 'hover' ? `${guardians[id].direction}을 관장하는 사방신, ${guardians[id].name}` : '';
    if (mobile.matches && mode !== 'hover') {
      starButtons.forEach(button => { button.classList.remove('is-active'); button.setAttribute('aria-pressed', 'false'); });
      exploration.scrollTop = 0;
    }
  }

  function setExplorationStage(id) {
    setHelp(false);
    state.scene = id;
    opening.dataset.stage = id;
    helpContent.textContent = scenes[id].help;
    setProgress(id);
  }

  function hoverGuardian(id) {
    if (state.transitioning || !help.hidden || state.explorationMode === 'selected' || state.scene === 'O-02') return;
    if (state.hoveredGuardian === id) return;
    state.hoveredGuardian = id;
    setExplorationStage(id ? 'O-04' : 'O-03');
    updateExploration(id ? 'hover' : 'overview', id);
  }

  function bindExploration(options) {
    guardianButtons.forEach((button, id) => {
      button.addEventListener('pointerenter', () => { if (!mobile.matches && hoverArmed) hoverGuardian(id); }, options);
      button.addEventListener('pointermove', () => { if (mobile.matches) return; if (!state.transitioning) hoverArmed = true; hoverGuardian(id); }, options);
      button.addEventListener('pointerleave', () => { if (!mobile.matches && hoverArmed) hoverGuardian(null); }, options);
      button.addEventListener('focus', () => { if (!mobile.matches) hoverGuardian(id); }, options);
      button.addEventListener('blur', () => { if (!mobile.matches) hoverGuardian(null); }, options);
      button.addEventListener('click', () => {
        if (mobile.matches && state.hoveredGuardian !== id) hoverGuardian(id);
        else selectGuardian(id);
      }, options);
    });
    exploration.addEventListener('pointermove', e => {
      if (mobile.matches) return;
      if (!state.transitioning) hoverArmed = true;
      if (!e.target.closest('.exploration__guardian')) hoverGuardian(null);
    }, options);
    exploration.addEventListener('pointerleave', () => { if (!mobile.matches && hoverArmed) hoverGuardian(null); }, options);
    starButtons.forEach(button => button.addEventListener('click', () => {
      if (!mobile.matches || state.transitioning || state.scene !== 'O-05') return;
      starButtons.forEach(star => { const active = star === button; star.classList.toggle('is-active', active); star.setAttribute('aria-pressed', String(active)); });
    }, options));
  }

  async function enterExploration() {
    if (state.scene !== 'O-02' || state.transitioning) return false;
    state.transitioning = true;
    const generation = ++sceneGeneration;
    setHelp(false);
    try { await prepareExploration(); }
    catch (error) {
      if (generation === sceneGeneration) state.transitioning = false;
      console.error('사신수 이미지 로드 실패', error);
      return false;
    }
    if (generation !== sceneGeneration) return false;
    stopActivity();
    state.hoveredGuardian = state.selectedGuardian = null;
    updateExploration('overview');
    exploration.hidden = false;
    exploration.inert = true;
    exploration.classList.remove('is-selecting', 'is-deselecting');
    void exploration.offsetWidth;
    exploration.classList.add('is-visible', 'is-entering');
    scenes['O-02'].element.classList.add('is-scene-exiting');
    scenes['O-02'].element.inert = true;
    root.dataset.theme = 'paper';
    setExplorationStage('O-03');
    startActivity();
    afterFade(() => {
      scenes['O-02'].element.hidden = true;
      exploration.classList.remove('is-entering');
      exploration.inert = false;
      exploration.focus({ preventScroll: true });
    }, 2150);
    return true;
  }

  function selectGuardian(id) {
    if (state.transitioning || !help.hidden || !guardians[id] || !['O-03', 'O-04'].includes(state.scene)) return false;
    hoverGuardian(id);
    state.transitioning = true;
    state.selectedGuardian = id;
    const generation = ++sceneGeneration;
    const data = guardians[id];
    exploration.classList.add('is-selecting');
    guardianGroup.inert = true;
    data.stars.forEach((star, index) => {
      const button = starButtons[index];
      const label = [star.name, star.animal].filter(Boolean).join(' · ');
      button.dataset.starId = star.id;
      button.setAttribute('aria-label', label);
      button.querySelector('.exploration__star-art').src = `01_SITE_IMAGES/28su/${star.file}?v=2`;
      button.querySelector('.exploration__star-label').textContent = label;
    });
    afterFade(() => {
      if (generation !== sceneGeneration) return;
      state.transitioning = true;
      state.hoveredGuardian = null;
      activeGuardian.src = data.images.active;
      activeGuardian.alt = data.name;
      exploration.querySelector('.exploration__name').textContent = data.name;
      // Reuse the existing S-03 descriptions; do not invent new explanatory copy.
      const description = document.querySelector(`.story__guardian[data-guardian="${data.name}"] .story__guardian-body`).cloneNode(true);
      // Keep the three authored lines from S-03 instead of wrapping a flattened paragraph.
      exploration.querySelector('.exploration__description').replaceChildren(...description.childNodes);
      exploration.style.setProperty('--guardian-color', data.color);
      exploration.classList.remove('is-selecting');
      updateExploration('selected', id);
      setExplorationStage('O-05');
      afterFade(() => exploration.focus({ preventScroll: true }), 680);
    }, 840);
    return true;
  }

  function deselectGuardian() {
    if (state.scene !== 'O-05' || state.transitioning) return false;
    ++sceneGeneration;
    state.transitioning = true;
    setHelp(false);
    exploration.classList.add('is-deselecting');
    afterFade(() => {
      state.transitioning = true;
      state.hoveredGuardian = state.selectedGuardian = null;
      updateExploration('overview');
      setExplorationStage('O-03');
      exploration.classList.remove('is-deselecting');
      afterFade(() => exploration.focus({ preventScroll: true }), 500);
    }, 320);
    return true;
  }

  function returnToO02() {
    if (state.transitioning || !['O-03', 'O-04'].includes(state.scene)) return false;
    ++sceneGeneration;
    state.transitioning = true;
    setHelp(false);
    stopActivity();
    const o02 = scenes['O-02'].element;
    o02.hidden = false;
    o02.inert = false;
    void o02.offsetWidth;
    o02.classList.remove('is-scene-exiting');
    exploration.classList.remove('is-visible');
    exploration.inert = true;
    state.hoveredGuardian = state.selectedGuardian = null;
    state.explorationMode = null;
    state.scene = 'O-02';
    opening.dataset.stage = 'O-02';
    root.dataset.theme = 'night';
    helpContent.textContent = scenes['O-02'].help;
    setProgress('O-02');
    startActivity();
    afterFade(() => {
      exploration.hidden = true;
      updateExploration('overview');
      state.explorationMode = null;
      o02.focus({ preventScroll: true });
    }, 1150);
    return true;
  }

  // O-05 stays mounted in its selected state while O-06 is visible. Returning
  // reveals the same artwork, seven stars and authored layout without replaying selection.
  function switchDetailScene(id) {
    if (state.transitioning || !state.selectedGuardian || state.explorationMode !== 'selected') return false;
    if (!((state.scene === 'O-05' && id === 'O-06') || (state.scene === 'O-06' && id === 'O-05'))) return false;
    ++sceneGeneration;
    state.transitioning = true;
    setHelp(false);
    stopActivity();
    const previous = scenes[state.scene].element;
    const next = scenes[id].element;
    previous.inert = true;
    next.hidden = false;
    next.inert = true;
    next.classList.remove('is-visible');
    void next.offsetWidth;
    previous.classList.remove('is-visible');
    next.classList.add('is-visible');
    root.dataset.theme = id === 'O-06' ? 'night' : 'paper';
    setExplorationStage(id);
    previous.inert = true;
    startActivity();
    afterFade(() => {
      previous.hidden = true;
      next.inert = false;
      next.focus({ preventScroll: true });
    }, 1150);
    return true;
  }

  function previousScene() {
    if (state.scene === 'O-07') return switchFinalScene('O-06');
    if (state.scene === 'O-06') return switchDetailScene('O-05');
    if (state.scene === 'O-05') return deselectGuardian();
    if (state.scene === 'O-03' || state.scene === 'O-04') return returnToO02();
    return returnToO01();
  }

  function nextScene() {
    if (state.scene === 'O-02') return enterExploration();
    if (state.scene === 'O-05') return switchDetailScene('O-06');
    if (state.scene === 'O-06') return switchFinalScene('O-07');
    if (state.scene === 'O-07') return finishOpening();
    // O-03/O-04 require an explicit guardian selection.
    return false;
  }

  // Reuse O-01 artwork without changing its DOM, IDs or event handlers.
  // Prefix every SVG ID and reference, including future filter/href additions.
  function cloneOpeningSvg(source, prefix = 'opening-pc-') {
    const artwork = source.cloneNode(true);
    const ids = new Map();
    [artwork, ...artwork.querySelectorAll('[id]')].filter(el => el.id).forEach(el => {
      const id = el.id;
      ids.set(id, `${prefix}${id}`);
      el.id = ids.get(id);
    });
    [artwork, ...artwork.querySelectorAll('*')].forEach(el => {
      [...el.attributes].forEach(attr => {
        let value = attr.value;
        ids.forEach((next, old) => {
          value = value.split(`url(#${old})`).join(`url(#${next})`);
          if (value === `#${old}`) value = `#${next}`;
        });
        if (value !== attr.value) el.setAttribute(attr.name, value);
      });
    });
    artwork.setAttribute('aria-hidden', 'true');
    return artwork;
  }
  const artwork = cloneOpeningSvg(document.querySelector('#o01-lantern-btn svg'));
  // Extend only the PC copy's fixed support beyond the viewport's left edge.
  artwork.querySelector(':scope > polygon').setAttribute('points', '-160,0 96,0 60,19 -160,19');
  lantern.append(artwork);

  function prepareFinalScene() {
    if (finalPrepared) return;
    finalPrepared = true;
    const architecture = finalScene.querySelector('.o07__architecture');
    for (const selector of ['.o01__eave', '.o01__railing', '#o01-door-left', '#o01-door-right']) {
      const copy = cloneOpeningSvg(o01.querySelector(selector), 'o07-');
      if (copy.classList.contains('o01__door')) {
        copy.id = copy.classList.contains('o01__door--left') ? 'o07-door-left' : 'o07-door-right';
        copy.classList.add('o07__door', 'is-open');
        copy.style.removeProperty('transition');
        copy.style.removeProperty('transition-duration');
      }
      (copy.classList.contains('o07__door') ? finalDoors : architecture).append(copy);
    }
    const rotor = finalScene.querySelector('.o07__rotor');
    finalCards.forEach(card => {
      const slot = document.createElement('div');
      slot.className = 'o07__slot';
      slot.style.setProperty('--card-angle', `${card.angle}deg`);
      const surface = document.createElement('div');
      surface.className = 'o07__card';
      Object.assign(surface.dataset, { cardId: card.id, constellation: card.name, guardian: card.guardian, svg: card.svg });
      const art = new Image();
      art.className = 'o07__card-image';
      art.alt = '';
      art.decoding = 'async';
      if (card.image) art.src = card.image;
      surface.append(art);
      slot.append(surface);
      rotor.append(slot);
    });
  }

  function syncFinalRotation() {
    finalScene.classList.toggle('is-playing', state.scene === 'O-07' && !finalScene.classList.contains('is-closing') && !document.hidden && !reduced.matches);
  }

  function resetFinalScene() {
    finalScene.classList.remove('is-playing', 'is-closing', 'is-visible');
    finalDoors.hidden = true;
    finalDoors.classList.remove('is-visible');
    finalScene.getAnimations({ subtree: true }).forEach(animation => { animation.currentTime = 0; });
    finalDoors.querySelectorAll('.o07__door').forEach(door => {
      door.style.transition = 'none';
      door.classList.add('is-open');
    });
    void finalScene.offsetWidth;
    finalDoors.querySelectorAll('.o07__door').forEach(door => door.style.removeProperty('transition'));
  }

  function switchFinalScene(id) {
    if (state.transitioning || !((state.scene === 'O-06' && id === 'O-07') || (state.scene === 'O-07' && id === 'O-06'))) return false;
    if (id === 'O-07') prepareFinalScene();
    ++sceneGeneration;
    state.transitioning = true;
    setHelp(false);
    stopActivity();
    const previous = scenes[state.scene].element, next = scenes[id].element;
    next.hidden = false;
    next.inert = true;
    next.classList.remove('is-visible');
    void next.offsetWidth;
    previous.classList.remove('is-visible');
    next.classList.add('is-visible');
    if (id === 'O-07') {
      finalDoors.hidden = false;
      void finalDoors.offsetWidth;
      finalDoors.classList.add('is-visible');
    } else finalDoors.classList.remove('is-visible');
    root.dataset.theme = 'night';
    setExplorationStage(id);
    previous.inert = true;
    startActivity();
    afterFade(() => {
      previous.hidden = true;
      if (id !== 'O-07') finalDoors.hidden = true;
      next.inert = false;
      next.focus({ preventScroll: true });
    }, 1150);
    return true;
  }

  function resetPCSession() {
    ++sceneGeneration;
    clearTimeout(transitionTimer);
    exitController?.abort();
    exitController = null;
    stopActivity();
    setHelp(false);
    root.hidden = true;
    root.inert = true;
    root.setAttribute('aria-hidden', 'true');
    root.classList.remove('is-visible');
    new Set(Object.values(scenes).map(scene => scene.element)).forEach(element => {
      element.hidden = true;
      element.inert = true;
    });
    resetFinalScene();
    exploration.classList.remove('is-visible', 'is-entering', 'is-selecting', 'is-deselecting');
    updateExploration('overview');
    state.scene = null;
    state.transitioning = false;
    state.explorationMode = null;
    state.hoveredGuardian = state.selectedGuardian = null;
    state.progress = 'O-02';
    progress.querySelectorAll('.is-complete').forEach(element => element.classList.remove('is-complete'));
    progress.setAttribute('aria-label', `오프닝 진행 0 / ${stageIds.length}`);
    lanternLit = false;
    lantern.classList.remove('is-lit', 'is-swinging');
    lantern.setAttribute('aria-pressed', 'false');
    opening.classList.remove('has-pc-scene');
    opening.dataset.stage = 'O-01';
    o01.hidden = false;
    o01.inert = false;
    o01.removeAttribute('aria-hidden');
    handingOff = false;
    wheelAccum = 0;
    lastWheel = performance.now();
    waitForQuiet = true;
  }

  function finishOpening() {
    if (state.scene !== 'O-07' || state.transitioning || !bridge?.finish) return false;
    const generation = ++sceneGeneration;
    state.transitioning = true;
    setHelp(false);
    stopActivity();
    finalScene.classList.add('is-closing');
    finalScene.inert = true;
    exitController = new AbortController();
    const controller = exitController, doors = [...finalDoors.querySelectorAll('.o07__door')];
    let completed = false;
    const confirmClosed = () => {
      if (completed || controller.signal.aborted || generation !== sceneGeneration) return;
      // A hidden element's computed "none" is not proof that a door has closed.
      if (doors.some(door => !door.getClientRects().length)) return;
      const closed = doors.every(door => Math.abs(new DOMMatrix(getComputedStyle(door).transform).m41) < .1);
      if (!closed) return;
      completed = true;
      controller.abort();
      handingOff = true;
      // opening.js keeps its capture input lock until the overlay has actually faded.
      bridge.finish(resetPCSession);
    };
    doors.forEach(door => {
      door.addEventListener('transitionend', e => {
        if (e.target === door && e.propertyName === 'transform') confirmClosed();
      }, { signal: controller.signal });
    });
    doors.forEach(door => door.classList.remove('is-open'));
    void finalDoors.offsetWidth;
    // Also observe the actual CSS transitions for zero-duration/reduced-motion cases.
    Promise.all(doors.flatMap(door => door.getAnimations().map(animation => animation.finished.catch(() => {})))).then(confirmClosed);
    const checkTimer = setTimeout(confirmClosed, 1600);
    controller.signal.addEventListener('abort', () => clearTimeout(checkTimer), { once: true });
    return true;
  }

  function syncChart() {
    chart?.classList.toggle('is-playing', (isNightScene() || state.scene === 'O-07') && !document.hidden && !reduced.matches);
  }

  function ensureChart() {
    if (!chart) {
      chart = document.createElement('div');
      chart.className = 'o01__chart-mount opening-pc__chart';
      chart.setAttribute('aria-hidden', 'true');
      const svg = cloneOpeningSvg(document.querySelector('#o01-chart-mount svg'));
      // Reuse the exact artwork and rotation, without duplicating star twinkle timers.
      svg.querySelectorAll('[style]').forEach(el => {
        el.style.removeProperty('animation');
        el.style.removeProperty('animation-delay');
      });
      chart.append(svg);
    }
    scenes[state.scene].element.append(chart);
    syncChart();
  }

  function setProgress(id) {
    const index = stageIds.indexOf(id);
    if (index < 0) return false;
    state.progress = id;
    progress.setAttribute('aria-label', `오프닝 진행 ${index + 1} / ${stageIds.length}`);
    progress.querySelectorAll('[data-progress-segment]').forEach((el, i) => el.classList.toggle('is-complete', i <= index));
    const dotSteps = [0, 0, 1, 2, 3, 4, 4, 5];
    progress.querySelectorAll('[data-progress-dot]').forEach((el, i) => el.classList.toggle('is-complete', dotSteps[i] <= index));
    return true;
  }

  function setHelp(open, restoreFocus = false) {
    help.hidden = !open;
    if (open) help.style.setProperty('--scroll-travel', `${help.offsetHeight / 2}px`);
    helpBackdrop.hidden = !open;
    if (state.scene) scenes[state.scene].element.inert = open;
    if (open) resetPointer();
    root.classList.toggle('is-help-open', open);
    lantern.setAttribute('aria-expanded', String(open));
    if (open) close.focus({ preventScroll: true });
    else if (restoreFocus) lantern.focus({ preventScroll: true });
  }

  function onLanternClick() {
    if (state.transitioning) return;
    lantern.getAnimations({ subtree: true }).filter(a => a.animationName === 'o01-lantern-swing').forEach(a => { a.currentTime = 0; });
    lantern.classList.add('is-swinging');
    lanternLit = !lanternLit;
    lantern.classList.toggle('is-lit', lanternLit);
    lantern.setAttribute('aria-pressed', String(lanternLit));
    setHelp(lanternLit);
  }

  function measure() {
    bounds = surface.getBoundingClientRect();
    target.x = clamp(target.x, 0, innerWidth);
    target.y = clamp(target.y, 0, innerHeight);
  }

  function isNightScene() {
    return state.scene === 'O-02' || state.scene === 'O-06';
  }

  function frame(time) {
    raf = 0;
    if (!isNightScene() || document.hidden) return;
    const factor = reduced.matches ? 1 : 1 - Math.exp(-Math.min(time - (lastFrame || time - 16), 64) / 90);
    lastFrame = time;
    let unsettled = false;
    for (const key of ['x', 'y', 'rx', 'ry']) {
      current[key] += (target[key] - current[key]) * factor;
      if (Math.abs(target[key] - current[key]) < .01) current[key] = target[key];
      else unsettled = true;
    }
    light.style.transform = `translate3d(${current.x}px, ${current.y}px, 0) translate(-50%, -50%)`;
    if (state.scene === 'O-02') image.style.transform = `rotateX(${current.rx}deg) rotateY(${current.ry}deg)`;
    if (unsettled) requestFrame();
  }

  function requestFrame() {
    if (!raf && isNightScene() && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function resetTilt() {
    target.rx = target.ry = 0;
    tiltHover = false;
    requestFrame();
  }

  function releaseDrag() {
    const id = dragId;
    dragId = null;
    dragOrigin = null;
    surface.classList.remove('is-dragging');
    if (id !== null && surface.hasPointerCapture(id)) surface.releasePointerCapture(id);
    resetTilt();
  }

  function resetPointer() {
    releaseDrag();
    light.classList.remove('is-tracking');
  }

  function stopActivity() {
    chart?.classList.remove('is-playing');
    finalScene.classList.remove('is-playing');
    activity?.abort();
    activity = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    resetPointer();
    cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = 0;
    image.style.transform = '';
    // Fade the shared light out at its last position; the next night entry
    // resets its coordinates before tracking resumes.
    current.rx = current.ry = target.rx = target.ry = 0;
  }

  function startNightActivity(options) {
    ensureChart();
    current.x = target.x = innerWidth / 2;
    current.y = target.y = innerHeight / 2;
    requestFrame();
    let touchLight = false;
    const trackLight = e => {
      if (state.transitioning || document.hidden || !help.hidden) return;
      if (mobile.matches && !touchLight) return;
      if (e.clientX < 0 || e.clientY < 0 || e.clientX >= innerWidth || e.clientY >= innerHeight) {
        resetPointer();
        return;
      }
      target.x = e.clientX;
      target.y = e.clientY;
      light.classList.add('is-tracking');
      requestFrame();
    };
    root.addEventListener('pointermove', trackLight, options);
    root.addEventListener('pointerdown', e => {
      if (!mobile.matches || e.pointerType !== 'touch') return;
      touchLight = true;
      trackLight(e);
    }, options);
    const endTouchLight = () => { touchLight = false; if (mobile.matches) resetPointer(); };
    window.addEventListener('pointerup', endTouchLight, options);
    window.addEventListener('pointercancel', endTouchLight, options);
    root.addEventListener('pointerleave', resetPointer, options);
    window.addEventListener('blur', resetPointer, options);
    window.addEventListener('mouseout', e => { if (!e.relatedTarget) resetPointer(); }, options);
    document.addEventListener('visibilitychange', () => {
      syncChart();
      if (document.hidden) {
        resetPointer();
        cancelAnimationFrame(raf);
        raf = 0;
        current.rx = current.ry = 0;
        image.style.transform = '';
      }
      lastFrame = 0;
    }, options);
    // O-06 uses the same light but never binds tilt or drag listeners.
    if (state.scene === 'O-02') startTiltActivity(options);
  }

  function startTiltActivity(options) {
    measure();
    surface.addEventListener('pointerenter', () => { tiltHover = true; }, options);
    surface.addEventListener('pointermove', e => {
      if (state.transitioning || reduced.matches || !bounds) return;
      if (e.clientX < 0 || e.clientY < 0 || e.clientX >= innerWidth || e.clientY >= innerHeight) {
        resetPointer();
        return;
      }
      if (dragId !== null) {
        if (e.pointerId !== dragId) return;
        target.ry = clamp(dragOrigin.ry + (e.clientX - dragOrigin.x) / bounds.width * 20, -9, 9);
        target.rx = clamp(dragOrigin.rx - (e.clientY - dragOrigin.y) / bounds.height * 20, -9, 9);
      } else if (tiltHover) {
        target.ry = clamp((e.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1) * 8;
        target.rx = -clamp((e.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1) * 8;
      }
      requestFrame();
    }, options);
    surface.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0 || state.transitioning || reduced.matches) return;
      e.preventDefault();
      if (mobile.matches) measure();
      dragId = e.pointerId;
      dragOrigin = { x: e.clientX, y: e.clientY, rx: current.rx, ry: current.ry };
      surface.setPointerCapture(e.pointerId);
      surface.classList.add('is-dragging');
    }, options);
    surface.addEventListener('pointerleave', () => { if (dragId === null) resetTilt(); }, options);
    surface.addEventListener('lostpointercapture', releaseDrag, options);
    window.addEventListener('pointerup', releaseDrag, options);
    window.addEventListener('pointercancel', releaseDrag, options);
    window.addEventListener('resize', measure, options);
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(surface);
    }
  }

  function startActivity() {
    activity = new AbortController();
    const options = { signal: activity.signal };
    bindTouchNavigation(options);
    if (state.scene === 'O-07') {
      ensureChart();
      syncFinalRotation();
      document.addEventListener('visibilitychange', syncFinalRotation, options);
      document.addEventListener('visibilitychange', syncChart, options);
    } else if (isNightScene()) startNightActivity(options);
    else bindExploration(options);
    lantern.addEventListener('click', onLanternClick, options);
    lantern.addEventListener('animationend', () => lantern.classList.remove('is-swinging'), options);
    close.addEventListener('click', () => setHelp(false, true), options);
    helpBackdrop.addEventListener('click', e => {
      // Keep direct lantern toggling while letting the full backdrop blur it.
      const r = lantern.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        onLanternClick();
        lantern.focus({ preventScroll: true });
      } else setHelp(false, true);
    }, options);
  }

  function bindTouchNavigation(options) {
    let gesture;
    const interactive = 'button,a,input,textarea,select,label,.o02__tilt-surface';
    root.addEventListener('touchstart', e => {
      gesture = null;
      if (!mobile.matches || state.transitioning || !help.hidden || e.touches.length !== 1 || performance.now() - lastWheel < 300) return;
      if (e.target instanceof Element && e.target.closest(interactive)) return;
      const scroller = scenes[state.scene]?.element;
      if (!scroller) return;
      const touch = e.touches[0];
      gesture = { x: touch.clientX, y: touch.clientY, scene: state.scene, top: scroller.scrollTop <= 2, bottom: scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2 };
    }, { ...options, passive: true });
    root.addEventListener('touchmove', e => {
      if (!gesture || e.touches.length !== 1) return;
      const dy = gesture.y - e.touches[0].clientY, dx = gesture.x - e.touches[0].clientX;
      if (e.cancelable && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.2 && (dy > 0 ? gesture.bottom : gesture.top)) e.preventDefault();
    }, { ...options, passive: false });
    root.addEventListener('touchend', e => {
      const start = gesture;
      gesture = null;
      if (!start || state.transitioning || state.scene !== start.scene || !help.hidden) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dy = start.y - touch.clientY, dx = start.x - touch.clientX;
      if (Math.abs(dy) < 80 || Math.abs(dy) <= Math.abs(dx) * 1.2) return;
      // A gesture that starts in the middle remains a reading scroll, even if
      // it reaches the boundary. A fresh outward swipe is required to navigate.
      if (dy > 0 ? !start.bottom : !start.top) return;
      lastWheel = performance.now();
      wheelAccum = 0;
      if (dy > 0) nextScene(); else previousScene();
    }, { ...options, passive: true });
    root.addEventListener('touchcancel', () => { gesture = null; }, { ...options, passive: true });
  }

  function afterFade(callback, duration = 680) {
    clearTimeout(transitionTimer);
    const generation = sceneGeneration;
    transitionTimer = setTimeout(() => {
      if (generation !== sceneGeneration) return;
      transitionTimer = 0;
      state.transitioning = false;
      lastWheel = performance.now();
      waitForQuiet = true;
      callback();
    }, reduced.matches ? 16 : duration);
  }

  function enter() {
    if (!bridge?.canEnter() || state.scene || state.transitioning) return false;
    ++sceneGeneration;
    bridge.onEnter();
    state.scene = 'O-02';
    state.explorationMode = null;
    state.hoveredGuardian = state.selectedGuardian = null;
    exploration.hidden = true;
    exploration.inert = true;
    exploration.classList.remove('is-visible', 'is-entering', 'is-selecting', 'is-deselecting');
    scenes['O-06'].element.hidden = true;
    scenes['O-06'].element.inert = true;
    scenes['O-06'].element.classList.remove('is-visible');
    finalScene.hidden = true;
    finalScene.inert = true;
    resetFinalScene();
    scenes['O-02'].element.hidden = false;
    scenes['O-02'].element.inert = false;
    scenes['O-02'].element.classList.remove('is-scene-exiting');
    root.dataset.theme = 'night';
    state.transitioning = true;
    waitForQuiet = true;
    wheelAccum = 0;
    root.hidden = false;
    root.inert = false;
    root.setAttribute('aria-hidden', 'false');
    helpContent.textContent = scenes[state.scene].help;
    setHelp(false);
    progress.querySelectorAll('.is-complete').forEach(el => el.classList.remove('is-complete'));
    // Commit the transparent starting frame once, not in the pointer loop.
    void root.offsetWidth;
    root.classList.add('is-visible');
    opening.classList.add('has-pc-scene');
    opening.dataset.stage = 'O-02';
    o01.inert = true;
    o01.setAttribute('aria-hidden', 'true');
    startActivity();
    prepareExploration().catch(() => {}); // Decode hover/active art before the next scene.
    setProgress('O-02');
    afterFade(() => {
      o01.hidden = true; // Also stops rendering hidden O-01 SVG animations.
      scenes[state.scene].element.focus({ preventScroll: true });
    });
    return true;
  }

  function returnToO01(immediate = false) {
    if (!state.scene) return false;
    ++sceneGeneration;
    exitController?.abort();
    exitController = null;
    clearTimeout(transitionTimer);
    setHelp(false);
    lantern.classList.remove('is-swinging');
    stopActivity();
    finalScene.hidden = true;
    resetFinalScene();
    state.transitioning = true;
    root.inert = true;
    root.setAttribute('aria-hidden', 'true');
    o01.hidden = false;
    opening.classList.add('is-pc-returning');
    void o01.offsetWidth;
    opening.classList.remove('has-pc-scene');
    root.classList.remove('is-visible');
    const finish = () => {
      root.hidden = true;
      o01.inert = false;
      o01.removeAttribute('aria-hidden');
      opening.classList.remove('is-pc-returning');
      opening.dataset.stage = 'O-01';
      state.scene = null;
      state.explorationMode = null;
      state.hoveredGuardian = state.selectedGuardian = null;
      syncChart();
      state.transitioning = false;
      wheelAccum = 0;
      bridge?.onReturn();
      if (!immediate) document.getElementById('o01-lantern-btn').focus({ preventScroll: true });
    };
    if (immediate) {
      waitForQuiet = false;
      finish();
    } else afterFade(finish);
    return true;
  }

  // Called by opening.js's existing capture listener. No competing wheel owner.
  function handleWheel(e) {
    const now = performance.now();
    const quiet = now - lastWheel > 350;
    lastWheel = now;
    if (state.transitioning) return true;
    if (waitForQuiet) {
      if (!quiet) return true;
      waitForQuiet = false;
    }
    if (!state.scene) return false;
    if (!help.hidden) return true;
    if (dragId !== null) return true;
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    if (!delta) return true;
    if (quiet || Math.sign(wheelAccum) !== Math.sign(delta)) wheelAccum = 0;
    wheelAccum += delta;
    if (Math.abs(wheelAccum) >= 140) {
      wheelAccum = 0;
      if (delta < 0) previousScene();
      else nextScene();
    }
    return true;
  }

  function handleKey(e) {
    if (!state.scene) return;
    if (e.repeat && ['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); return; }
    if (state.transitioning) {
      if (['Tab', 'Enter', ' ', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      return;
    }
    if (e.key === 'Tab') {
      const sceneControls = isNightScene() || state.scene === 'O-07' ? [] : state.scene === 'O-05' ? starButtons : [...guardianButtons.values()];
      const controls = help.hidden ? [lantern, ...sceneControls] : [close];
      const index = controls.indexOf(document.activeElement);
      e.preventDefault();
      const next = index < 0 ? (e.shiftKey ? controls.length - 1 : 0) : (index + (e.shiftKey ? -1 : 1) + controls.length) % controls.length;
      controls[next].focus({ preventScroll: true });
    } else if (e.key === 'Escape' && !help.hidden) { e.preventDefault(); setHelp(false, true); }
    else if (!help.hidden && ['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    else if (['PageUp', 'ArrowUp', 'ArrowLeft'].includes(e.key) && !state.transitioning) {
      e.preventDefault();
      previousScene();
    } else if (['PageDown', 'ArrowDown', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      nextScene();
    }
  }

  mobile.addEventListener('change', () => {
    // Resizing changes presentation/input only; the shared scene and selection stay.
    if (state.scene && !handingOff && !finalScene.classList.contains('is-closing')) {
      stopActivity();
      startActivity();
    }
  });
  reduced.addEventListener('change', () => { syncChart(); syncFinalRotation(); if (state.scene) resetTilt(); });
  window.openingPC = Object.freeze({
    enter, handleWheel, handleKey, setProgress,
    connect(callbacks) { bridge = callbacks; },
    setHelpContent(id, text) {
      if (!scenes[id] || typeof text !== 'string') return false;
      scenes[id].help = text;
      if (state.scene === id) helpContent.textContent = text;
      return true;
    },
    // O-04/O-05 require a real guardian interaction, never a blind page jump.
    goTo(id) {
      if (id === 'O-07' || (id === 'O-06' && state.scene === 'O-07')) return switchFinalScene(id);
      if (id === 'O-06' || id === 'O-05') return switchDetailScene(id);
      if (id === 'O-03') return state.scene === 'O-02' ? enterExploration() : state.scene === 'O-05' ? deselectGuardian() : false;
      if (id === 'O-02') return ['O-03', 'O-04'].includes(state.scene) ? returnToO02() : enter();
      return false;
    },
    getState() { return { ...state }; },
    getCardData() { return finalCards.map(card => ({ ...card })); },
    setCardImage(id, src) {
      const card = finalCards.find(card => card.id === id);
      if (!card || typeof src !== 'string') return false;
      card.image = src;
      const art = finalScene.querySelector(`[data-card-id="${id}"] .o07__card-image`);
      if (art) { if (src) art.src = src; else art.removeAttribute('src'); }
      return true;
    },
  });
})();
