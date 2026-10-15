/**
 * 별운관 — 가로형 메인 사이트 1차 구현
 * 가로 진행 엔진: wheel / drag 입력을 모두 받아, 이징(lerp)으로 부드럽게
 * 보간한 뒤 .track 에 translate3d(-x, 0, 0) 를 매 프레임 적용한다.
 *
 * REFERENCE_CANALS.md 14번 항목의 구조(입력 정규화 → 중앙 상태값 → DOM
 * transform 레이어 → UI 메타 반영)를 그대로 따르되, WebGL 레이어는 쓰지
 * 않고 CSS transform만으로 구현했다.
 *
 * 화면 1개 "기준 폭"의 값: window.innerWidth(=100vw) 대신 .viewport
 * 요소를 getBoundingClientRect() 로 "실측"한 값을 쓴다. 모니터 배율/OS
 * 디스플레이 설정 등 환경에 따라 100vw 계산이 실제 렌더링 폭과 어긋나는
 * 경우가 있어, 실제 DOM 측정값을 유일한 기준으로 삼아 모든 모니터
 * 크기에서 동일하게 동작하도록 했다.
 *
 * 화면마다 폭이 다를 수 있다: 각 .screen 은 기본적으로 이 기준 폭 1장
 * 만큼이지만, data-width-multiplier="3" 처럼 지정하면 그 배수만큼
 * 넓어진다(예: E-00 뒤에 콘텐츠 없는 여유 공간을 더 둬서, 그 구간을
 * 지나가는 배경 패럴랙스가 더 오래/크게 보이도록). 그래서 "몇 번째
 * 화면이 어디서 시작하는지"는 단순히 index*unitWidth가 아니라
 * screenStarts[] 배열(각 화면의 실제 시작 px, 누적합)로 관리한다.
 */
(() => {
  const viewport = document.getElementById('viewport');
  const track = document.getElementById('track');
  const screens = Array.from(track.children);
  const rail = document.querySelector('.rail');
  const progressFill = document.getElementById('rail-progress-fill');
  const railNavEntrance = document.getElementById('rail-navitem-entrance');

  // 화면별 폭 배율 (지정 없으면 1 = 기준 폭 1장)
  const widthMultipliers = screens.map((s) => parseFloat(s.dataset.widthMultiplier || '1'));

  const state = {
    current: 0,   // 실제로 화면에 적용되는 값 (매 프레임 target 을 따라감)
    target: 0,    // 입력에 의해 즉시 갱신되는 목표값
    max: 0,       // 가로로 이동 가능한 최대 거리(px)
    unitWidth: 0, // 화면 "기준 폭" 1장의 실측 폭(px) — 배율의 기준 단위
    screenStarts: [], // 화면별 시작 위치(px, 누적합)
    screenWidths: [], // 화면별 실제 폭(px) = unitWidth * 배율
  };

  const EASE = 0.1; // 값이 작을수록 더 느리고 부드럽게 따라감

  // 2026-10-14 9차(성능): rail.getBoundingClientRect()를 매 프레임
  // updateRailChrome() 안에서 직접 호출하던 것을 없애고, 리사이즈 시
  // (applySizes 안에서) 한 번만 측정해 캐시해 둔다 — getBoundingClientRect
  // 는 레이아웃이 "더럽혀져" 있으면 그 자리에서 강제로 동기 레이아웃을
  // 일으키는 호출이라, 60fps 루프 안에 있으면 "매 프레임 강제 레이아웃"
  // 이 되어 가장 비싼 축에 속한다(아래 raf() 주석의 실측 트레이스 참고).
  let cachedRailWidth = 0;

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  // pos(트랙 좌표계의 한 지점)가 속한 화면의 인덱스를 찾는다.
  // starts/widths를 인자로 받아서, 리사이즈 중 "이전 크기 기준"과
  // "새 크기 기준" 양쪽에 재사용할 수 있게 했다.
  function findScreenIndexAtPosition(pos, starts, widths) {
    for (let i = 0; i < starts.length; i++) {
      if (pos < starts[i] + widths[i] || i === starts.length - 1) return i;
    }
    return starts.length - 1;
  }

  // 레일이 현재 "겹쳐 있는" 화면을 기준으로 레일 배경/글자/선 색을 그
  // 화면의 data-rail-theme 값에 맞춰 바꾸고, 좌상단부터 차오르는 진행
  // 바도 함께 갱신한다. Canals Amsterdam의 nav가 현재 섹션 배경에
  // 맞춰 색이 바뀌던 것과 같은 원리(REFERENCE_CANALS.md 9, 11번 참고).
  //
  // "겹쳐 있다"의 기준점은 레일의 왼쪽 끝(x=0)이 아니라 오른쪽 끝
  // (x=railWidth)이다 — 다음 화면이 왼쪽으로 밀려 들어올 때, 그
  // 경계선이 레일의 가장 오른쪽에 닿는 순간 곧바로 색이 바뀌어야
  // 레일 전체가 새 배경 안에 들어갈 때까지 기다리지 않는다.
  function updateRailChrome() {
    if (state.unitWidth <= 0) return;

    const railWidth = cachedRailWidth || rail.getBoundingClientRect().width;
    const idx = findScreenIndexAtPosition(state.current + railWidth, state.screenStarts, state.screenWidths);
    const theme = screens[idx].dataset.railTheme || 'dark';
    if (rail.dataset.theme !== theme) {
      rail.dataset.theme = theme;
    }

    // '입구'는 M-00(메인 사이트 표지)에서는 아직 어느 메뉴에도 "들어가
    // 있지" 않은 상태라 다른 미구현 항목들처럼 옅게, E-00/E-01/E-02 중
    // 하나라도 걸쳐 있으면(=입구 섹션 안에 있으면) 밝게 표시한다.
    const inEntranceSection = (screens[idx].dataset.screenId || '').startsWith('E-');
    railNavEntrance.classList.toggle('is-dimmed', !inEntranceSection);

    // M-00(진행도 0%)에서도 바가 완전히 비어 있지 않고, 햄버거 영역
    // 경계선(65/1024 지점)까지는 이미 내려와 있는 상태로 시작한다.
    // 스크롤하면 그 지점부터 바닥까지 더 내려간다.
    const MIN_PROGRESS_PCT = 6.3477; // 65 / 1024 * 100
    const progress = state.max > 0 ? state.current / state.max : 0;
    const pct = MIN_PROGRESS_PCT + clamp(progress, 0, 1) * (100 - MIN_PROGRESS_PCT);
    progressFill.style.height = `${pct}%`;
  }

  // ------------------------------------------------------------
  // 요소별 등장(reveal) 효과
  // REFERENCE_CANALS.md에서 분석한 "텍스트·이미지가 한 타이밍에
  // 같이 움직이지 않고 요소마다 조금씩 다른 시점/속도로 나타나며
  // 입체감을 만드는" 구조(5·6·15-3번 항목)를 CSS transform만으로
  // 옮긴 것.
  //
  // reveal 기준은 "이 화면 자체의 0~1"이 아니라 "바로 이전 화면 →
  // 이 화면으로 들어오는 전환 구간"이다: 그 화면이 뷰포트에 온전히
  // 들어오는 순간(local=1) 지정된 구간(data-reveal-start~end)에
  // 맞춰 이미 자리를 잡는다. 이 전환 구간의 길이는 항상 "기준 폭
  // 1장"이다 — 이 화면 자신이 data-width-multiplier로 더 넓어져
  // 있어도(예: E-00), 그 추가분은 전환 구간이 아니라 화면이 자리잡은
  // "이후" 구간이므로 reveal 타이밍에는 영향이 없다.
  const revealItems = Array.from(document.querySelectorAll('.reveal')).map((el) => ({
    el,
    screenIndex: screens.indexOf(el.closest('.screen')),
    start: parseFloat(el.dataset.revealStart || '0'),
    end: parseFloat(el.dataset.revealEnd || '0'),
    offset: el.classList.contains('reveal--image') ? 32 : 24,
  }));

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function updateReveals() {
    if (state.unitWidth <= 0) return;
    revealItems.forEach((item) => {
      const transitionStart = state.screenStarts[item.screenIndex] - state.unitWidth;
      const local = clamp((state.current - transitionStart) / state.unitWidth, 0, 1);
      const span = item.end - item.start;
      const raw = span > 0 ? clamp((local - item.start) / span, 0, 1) : (local >= item.start ? 1 : 0);
      const t = easeOutCubic(raw);
      item.el.style.opacity = String(t);
      item.el.style.transform = `translateY(${(1 - t) * item.offset}px)`;
    });
  }

  function measureUnitWidth() {
    return viewport.getBoundingClientRect().width;
  }

  // ------------------------------------------------------------
  // E-01 / E-02 대표 이미지 "들어올 때는 확대, 다 들어오면 원래 크기"
  // 효과. 원본 사이트(REFERENCE_CANALS.md 5번 — 요소마다 자기만의
  // 활성 구간을 갖고 그 구간에서 트랜스폼이 변하는 구조)를 참고해,
  // reveal과 똑같은 "이 화면의 진입 구간(= 바로 전 화면 → 이 화면,
  // 길이는 항상 unitWidth 1장)"을 재사용한다. 틀(.e0x__photo-wrap)
  // 크기·위치는 절대 건드리지 않고, 그 안의 img 하나만 scale/zoom을
  // 바꿔서 "이미지가 안쪽에서 줌되는" 느낌을 낸다.
  const e01PhotoImg = document.querySelector('.e01__photo-img');
  const e02PhotoImg = document.querySelector('.e02__photo-img');
  const e01ScreenIndex = screens.findIndex((s) => s.dataset.screenId === 'E-01');
  const e02ScreenIndex = screens.findIndex((s) => s.dataset.screenId === 'E-02');

  // E-01은 사진 자체가 가로로 완만한 톤의 실내 사진이라, E-02(별자리
  // 점·선이라 축척 변화가 눈에 선명하게 드러남)와 같은 배율·같은
  // easeOutCubic(초반에 급히 변하고 후반은 거의 안 바뀜)로는 체감이
  // 거의 안 됐다. E-01만 (1) 확대 배율을 훨씬 크게, (2) easeInCubic
  // (초반엔 거의 안 바뀌다 후반에 몰아서 바뀌는 커브)으로 바꿔서,
  // 화면에 거의 다 들어올 때까지도 눈에 띄게 확대된 채로 남아 있다가
  // 막판에 "느리게 줄어들며" 정착하는 느낌을 낸다.
  const E01_ZOOM_ENTRANCE_FACTOR = 1.35;
  const E02_ZOOM_ENTRANCE_FACTOR = 1.08; // 진입 시작 시점엔 최종 상태보다 8% 더 확대
  const E02_ZOOM_REST = 0.93; // css의 --e02-zoom 기본값과 반드시 맞춰둘 것

  function easeInCubic(t) {
    return t * t * t;
  }

  // 화면이 뷰포트에 들어오기 시작해서(0) 완전히 자리잡을 때까지(1)의
  // "가공 전" 진행도. updateReveals()의 local 계산과 동일한 기준점을
  // 쓴다 — 이징은 쓰는 쪽에서 용도에 맞게 따로 적용한다.
  function screenEntranceLocal(screenIndex) {
    if (screenIndex < 0 || state.unitWidth <= 0) return 1;
    const transitionStart = state.screenStarts[screenIndex] - state.unitWidth;
    return clamp((state.current - transitionStart) / state.unitWidth, 0, 1);
  }

  function updateImageZooms() {
    if (e01PhotoImg) {
      const t = easeInCubic(screenEntranceLocal(e01ScreenIndex));
      const scale = E01_ZOOM_ENTRANCE_FACTOR + (1 - E01_ZOOM_ENTRANCE_FACTOR) * t; // 1.35 → 1.0
      e01PhotoImg.style.transform = `scale(${scale})`;
    }
    if (e02PhotoImg) {
      const t = easeOutCubic(screenEntranceLocal(e02ScreenIndex));
      const zStart = E02_ZOOM_REST * E02_ZOOM_ENTRANCE_FACTOR;
      const z = zStart + (E02_ZOOM_REST - zStart) * t; // 확대 상태 → E02_ZOOM_REST
      e02PhotoImg.style.setProperty('--e02-zoom', String(z));
    }
  }

  // ------------------------------------------------------------
  // E-00 → E-01 배경 패럴랙스 (REFERENCE_CANALS.md 5·7·15-3번 참고)
  //
  // Canals Amsterdam의 Overview → Noord-Holland 전환을 참고한 구조.
  // 밤하늘 이미지(.e00-bg-layer)는 .track(전경 — 표지 패널, 본문 등)과
  // 같은 트랙에 묶이지 않고 완전히 독립된 레이어다. .track은 스크롤
  // 그대로(배속 1.0) 움직이지만, 이 배경 레이어는 그보다 느린 배속
  // (E00_PARALLAX_FACTOR)으로만 움직인다.
  //
  // E-00 화면 자체를 data-width-multiplier="3"으로 기준폭의 3배까지
  // 넓혀뒀다(실제 콘텐츠는 그 중 앞 1장 분량에만 있고 나머지는 빈
  // 투명 공간). 그래서 패널이 화면을 빠져나간 뒤에도 배경이 "뒤이어
  // 오는 E-01에 도착하기까지" 훨씬 더 긴 구간 동안 크게 남아있다가
  // 서서히 덮인다 — 배속(E00_PARALLAX_FACTOR) 자체는 그대로 두고
  // 화면 폭만 늘렸을 뿐인데도 효과가 보이는 구간이 그만큼 길어진다.
  //
  // 기준점: E-00이 화면에 정확히 다 들어왔을 때(스크롤 진행이 E-00
  // 시작점과 같을 때) 이미지가 뷰포트에 꽉 차게(왼쪽 끝=0) 둔다.
  // 이때는 왼쪽 65.14%가 불투명한 패널에 가려져 있어서 오른쪽
  // 34.86%만 자연스럽게 드러나 보인다 — 지금까지의 고정 크롭과
  // 시각적으로 동일한 시작 상태.
  const e00BgLayer = document.getElementById('e00-bg-layer');
  const e00ScreenIndex = screens.findIndex((s) => s.dataset.screenId === 'E-00');
  const E00_PARALLAX_FACTOR = 0.5; // 1.0 = 전경과 같은 속도, 작을수록 더 느리게(더 오래 남음)

  function updateE00ParallaxBg() {
    if (!e00BgLayer || state.unitWidth <= 0 || e00ScreenIndex < 0) return;
    const e00Start = state.screenStarts[e00ScreenIndex];
    const x = e00Start * E00_PARALLAX_FACTOR - state.current * E00_PARALLAX_FACTOR;
    e00BgLayer.style.transform = `translate3d(${x}px, 0, 0)`;
  }

  // ------------------------------------------------------------
  // M-00 표지 배경 패럴랙스 — E-00과 같은 원리지만 훨씬 더 미묘하게.
  // 화면 폭을 늘리는 건 필요 없고(= M-00은 기준 폭 1장 그대로), 그냥
  // 스크롤할 때 전경(패널/텍스트, 배속 1.0)과 배경이 완전히 한 덩어리로
  // 붙어 움직이는 느낌을 살짝 덜어내는 정도만 원해서 배속을 1에 아주
  // 가깝게(0.85) 둔다. M-00은 항상 트랙의 맨 앞(시작 0)이라 공식이
  // 더 단순하다.
  const m00BgLayer = document.getElementById('m00-bg-layer');
  const m00ScreenIndex = screens.findIndex((s) => s.dataset.screenId === 'M-00');
  const M00_PARALLAX_FACTOR = 0.85;

  function updateM00ParallaxBg() {
    if (!m00BgLayer || state.unitWidth <= 0 || m00ScreenIndex < 0) return;
    const m00Start = state.screenStarts[m00ScreenIndex];
    const x = m00Start * M00_PARALLAX_FACTOR - state.current * M00_PARALLAX_FACTOR;
    m00BgLayer.style.transform = `translate3d(${x}px, 0, 0)`;
  }

  // 화면 폭이 바뀌면(창 리사이즈, 모니터 이동, OS 배율 변경, 브라우저
  // 줌 등) "몇 번째 화면 근처에 있었는지"를 기존 screenStarts 기준으로
  // 찾아서, 새 크기에서도 그 화면의 시작 지점으로 다시 맞춘다.
  // .screen / .track 의 실제 px 폭도 여기서 함께 다시 적용한다.
  function applySizes() {
    const newWidth = measureUnitWidth();
    // 아래 width 쓰기(screens[i].style.width 등)보다 먼저, viewport
    // 측정과 같은 타이밍에 함께 읽어서 별도의 강제 레이아웃이 한 번
    // 더 발생하지 않게 한다 — 두 getBoundingClientRect 호출 모두
    // "쓰기 전"이라 같은 레이아웃 패스에서 한 번에 처리된다.
    cachedRailWidth = rail.getBoundingClientRect().width;

    const screenWidths = widthMultipliers.map((m) => newWidth * m);
    const screenStarts = [];
    let acc = 0;
    for (let i = 0; i < screenWidths.length; i++) {
      screenStarts.push(acc);
      acc += screenWidths[i];
    }
    const totalTrackWidth = acc;

    const oldStarts = state.screenStarts.length ? state.screenStarts : screenStarts;
    const oldWidths = state.screenWidths.length ? state.screenWidths : screenWidths;
    const indexBefore = findScreenIndexAtPosition(state.target, oldStarts, oldWidths);
    const clampedIndex = clamp(indexBefore, 0, screens.length - 1);

    screens.forEach((s, i) => { s.style.width = `${screenWidths[i]}px`; });
    track.style.width = `${totalTrackWidth}px`;

    state.unitWidth = newWidth;
    state.screenStarts = screenStarts;
    state.screenWidths = screenWidths;
    state.max = Math.max(0, totalTrackWidth - newWidth);
    state.target = clamp(screenStarts[clampedIndex], 0, state.max);
    state.current = state.target; // 리사이즈 중에는 애니메이션 없이 즉시 맞춤

    track.style.transform = `translate3d(${-state.current}px, 0, 0)`;
    updateRailChrome();
    updateReveals();
    updateE00ParallaxBg();
    updateM00ParallaxBg();
    updateImageZooms();
  }

  // ------------------------------------------------------------
  // 전체 메뉴 오버레이 — 햄버거를 누르면 레일 왼쪽 끝부터 네이비 배경이
  // 오른쪽으로 퍼져나가며(.nav-overlay__bg, CSS transform) 펼쳐지고,
  // 조금 늦게(.nav-overlay__content, CSS transition-delay) 칼럼 내용이
  // 드러난다. 열려 있는 동안은 뒤의 가로 스크롤 입력(휠/드래그/화살표)을
  // 받지 않는다 — 안 그러면 메뉴가 열린 채로 뒤에서 스크롤 위치가 바뀌어
  // 닫을 때 화면이 갑자기 튀어 보인다.
  const navOverlay = document.getElementById('nav-overlay');
  const railBurger = document.getElementById('rail-burger');

  function isNavOverlayOpen() {
    return navOverlay.classList.contains('is-open');
  }
  function openNavOverlay() {
    navOverlay.classList.add('is-open');
    navOverlay.setAttribute('aria-hidden', 'false');
    railBurger.setAttribute('aria-expanded', 'true');
    railBurger.classList.add('is-active');
  }
  function closeNavOverlay() {
    navOverlay.classList.remove('is-open');
    navOverlay.setAttribute('aria-hidden', 'true');
    railBurger.setAttribute('aria-expanded', 'false');
    railBurger.classList.remove('is-active');
  }
  railBurger.addEventListener('click', () => {
    if (isNavOverlayOpen()) closeNavOverlay(); else openNavOverlay();
  });
  // 배경(칼럼이 아닌 빈 영역)을 눌러도 닫히게 — 흔한 오버레이 UX 관례
  navOverlay.querySelector('.nav-overlay__bg').addEventListener('click', closeNavOverlay);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isNavOverlayOpen()) closeNavOverlay();
  });

  // 전체 메뉴의 '오프닝 페이지로 이동' 칼럼 — 기존 마크업(과거
  // is-disabled 상태였던 바로 그 요소)에 클릭 동작만 추가한다. 새
  // 버튼/중복 메뉴는 만들지 않는다. js/opening.js가 window에 노출한
  // o01Enter()를 호출해 O-01 첫 화면(문 닫힌 상태)으로 복귀시킨다.
  const navOverlayOpeningCol = document.querySelector('.nav-overlay__col--opening');
  if (navOverlayOpeningCol) {
    navOverlayOpeningCol.addEventListener('click', (e) => {
      e.stopPropagation();
      closeNavOverlay();
      if (window.o01Enter) window.o01Enter();
    });
  }

  // ------------------------------------------------------------
  // 입력 1: 마우스 휠 / 트랙패드
  // ------------------------------------------------------------
  window.addEventListener('wheel', (e) => {
    if (isNavOverlayOpen()) return;
    e.preventDefault();
    const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    state.target = clamp(state.target + delta, 0, state.max);
  }, { passive: false });

  // ------------------------------------------------------------
  // 입력 2: 마우스 드래그 / 터치
  // ------------------------------------------------------------
  let isDragging = false;
  let dragStartX = 0;
  let dragStartTarget = 0;

  function onPointerDown(e) {
    if (isNavOverlayOpen()) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartTarget = state.target;
    track.style.cursor = 'grabbing';
  }
  function onPointerMove(e) {
    if (!isDragging) return;
    const delta = dragStartX - e.clientX;
    state.target = clamp(dragStartTarget + delta, 0, state.max);
  }
  function onPointerUp() {
    isDragging = false;
    track.style.cursor = 'grab';
  }

  track.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  track.style.cursor = 'grab';

  // ------------------------------------------------------------
  // 입력 3: 좌우 화살표 키 (화면 단위 이동 — 브라우저 확인 편의용 보조 기능)
  // ------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (isNavOverlayOpen()) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      goToIndex(nearestIndex() + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      goToIndex(nearestIndex() - 1);
    }
  });

  function nearestIndex() {
    return findScreenIndexAtPosition(state.target, state.screenStarts, state.screenWidths);
  }

  function goToIndex(i) {
    const clamped = clamp(i, 0, screens.length - 1);
    state.target = clamp(state.screenStarts[clamped], 0, state.max);
  }

  function goToScreenId(id) {
    const i = screens.findIndex((s) => s.dataset.screenId === id);
    if (i >= 0) goToIndex(i);
  }

  // --------------------------------------------------------------
  // O-01(오프닝) <-> 메인 사이트 임시 연결 지점
  //
  // js/opening.js가 O-01 종료 직후(암전이 안정된 시점) window에 노출된
  // 이 함수를 호출해, 메인 사이트 스크롤 위치를 M-00(맨 처음)으로
  // "트랜지션 없이 즉시" 맞춘다 — 오프닝이 아직 화면을 덮고 있는
  // 동안(페이드 전)에 미리 맞춰두는 것이라, 화면에는 전혀 보이지
  // 않는다. 전체 메뉴가 열려 있었다면 함께 닫아, M-00이 드러날 때
  // 메뉴가 그 위에 남아있는 일이 없게 한다.
  // --------------------------------------------------------------
  function m00Enter() {
    goToIndex(screens.findIndex((s) => s.dataset.screenId === 'M-00'));
    state.current = state.target;
    track.style.transform = `translate3d(${-state.current}px, 0, 0)`;
    updateRailChrome();
    updateReveals();
    updateE00ParallaxBg();
    updateM00ParallaxBg();
    updateImageZooms();
    if (isNavOverlayOpen()) closeNavOverlay();
  }
  window.m00Enter = m00Enter;

  // --------------------------------------------------------------
  // M-00 성도 반짝임 1회 초기화 — js/opening.js의 initChartAnimations와
  // 같은 이유(성능 — 1447개 전부에 개별 twinkle을 거는 대신 일부만
  // 무작위로 골라 inline animation을 준다)로 동일한 패턴을 썼다.
  // O-01과 완전히 같은 함수를 공유하지 않고 파일을 분리해 둔 이유는
  // "M-00용 스타일/로직은 O-01과 분리"라는 이 프로젝트의 기존 원칙을
  // 따른 것.
  // 2026-10-14 5차: 별묶음/연결선 선택자를 svg > g:nth-of-type(N)
  // 같은 위치 기반 방식에서 명시적 id(#m00-chart-stars/#m00-chart-lines)
  // 기반으로 바꿨다 — 성도 전체를 감싸는 회전 그룹(#m00-chart-spin)과
  // 장식 복제 그룹(#m00-chart-deco-group)이 새로 추가되면서 중첩
  // 단계가 바뀌었는데, 위치 기반 선택자는 이런 구조 변경 때마다
  // 다시 세어야 해서(과거에 O-01/M-00 간 nth-of-type(2)/(3) 혼동
  // 버그가 실제로 있었음) 더 안정적인 id 기반으로 정리했다. stars
  // 선택자(circle.st1)는 범위를 mount 전체로 그대로 둬서, 장식
  // 복제 그룹 안의 점들도 flare 대상에 자연스럽게 포함되게 했다
  // (복제도 "같은 밤하늘"이니 반짝임도 같이 적용되는 게 자연스럽다).
  //
  // 2026-10-14 6차(성능+템포): "회전이 뚝뚝 끊긴다" 신고의 핵심
  // 원인은 flare/breathe가 opacity(+fill/filter)를 매 프레임 바꾸는
  // 대상인데, 이 대상들이 전부 회전 중인 합성 레이어(#m00-chart-spin)
  // "안"에 있어서 하나라도 다시 칠해지면 그 레이어 전체가 다시
  // 래스터화된다는 점이었다(회전 자체는 GPU가 텍스처만 돌리면 되는
  // 저비용 작업인데, flare/breathe가 그 텍스처를 계속 무효화시킴).
  // duration을 늘리는 것만으로는 "동시에 바뀌고 있는 대상 수"가
  // 줄지 않으므로(각 요소가 keyframe 전 구간에 걸쳐 매 프레임
  // 보간되는 건 느리게 돌아도 마찬가지), 성능 쪽은 대상 "개수"를
  // 줄이는 쪽으로 처리하고, 템포(더 천천히 반짝이는 느낌)는
  // duration/delay 범위를 늘리는 쪽으로 분리해서 처리했다.
  //
  // 2026-10-14 7차: 사용자가 직접 제작한 m-00-celestial-chart-custom.svg로
  // 교체되며 내부 구조가 바뀌었다 — 이전 파일은 별(circle.st1)과
  // 연결선(line.st3)이 완전히 분리된 그룹(#m00-chart-stars /
  // #m00-chart-lines)이었지만, 새 파일은 별자리 330개가 각자 자기
  // 그룹 안에 별점(circle)과 연결 도형(polygon/path)을 함께 갖고
  // 있고 클래스도 .st0 하나뿐이다(연결 도형이 stroke 선이 아니라
  // 채움 폴리곤/패스라서 .st1/.st3처럼 fill/stroke로 나눌 필요가
  // 없어짐). 그래서 선택자를 실제 구조에 맞게 다시 잡았다 —
  // 별(flare): mount 전체의 circle.st0(그룹에 속하지 않은 낱개 별
  // 79개도 포함 — 아래 참고). 연결 도형("line" 호흡 자리):
  // #m00-chart-stars 아래 모든 polygon.st0/path.st0(어느 깊이에
  // 중첩돼 있든, 심지어 그룹 밖에 있든 태그명으로 찾음). 묶음
  // 호흡은 이전과 동일하게 #m00-chart-stars의 바로 아래 자식 <g>만
  // 대상으로 한다(317개 — 새 SVG의 개별 별자리 묶음).
  //
  // 새 SVG를 실제로 열어보니 330개 <g> 묶음 외에, 그 어느 그룹에도
  // 속하지 않고 #m00-chart-stars 바로 아래 낱개로 떠 있는 요소가
  // 81개(별 79개 + 연결 도형 2개) 더 있었다 — 사용자가 직접 배치한
  // 파일 내용 그대로이므로 그룹으로 묶거나 다른 방식으로 손대지
  // 않았고, 각 선택자가 "그룹 소속 여부와 무관하게" 태그/클래스
  // 기준으로 잡도록 해서 이 낱개 요소들도 자연스럽게 같은 애니메이션
  // 대상 풀에 포함되게 했다(별은 flare, 낱개 연결 도형 2개는 호흡
  // 대상 풀에 들어감 — 묶음 호흡만 "묶여 있는 것"이 전제라 낱개는
  // 대상에서 빠진다, 의미상 당연한 결과).
  //
  // 대상 수/비율 공식(flare는 최대 55개 절대 상한, 묶음·연결 도형
  // 호흡은 각각 전체의 1/4)은 6차와 동일하게 유지하되, 새 파일의
  // 실제 개수(별 2043개, 묶음 317개, 연결 도형 432개)에 맞춰 다시
  // 계산되므로 결과 개수는 55 / 79 / 108로 바뀐다 — "구조(알고리즘)는
  // 유지, 숫자는 새 SVG 실측에 맞게 자동 반영"이 이번 교체의
  // 원칙이었다.
  // --------------------------------------------------------------
  function shuffleSample(list, count) {
    const pool = list.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return pool.slice(0, count);
  }

  // 2026-10-14 10차(성능, 핵심 재발견): "일시정지해도 렉이 줄지
  // 않는다"는 재신고로 CDP Tracing을 다시 떠서 양쪽을 직접 비교했다
  // — animation-play-state:paused로 "멈춰만" 둔 상태(요소는 그대로
  // DOM에 있고 style.animation도 그대로 붙어 있음)와, style.animation
  // 자체를 아예 비워 "애니메이션을 떼어낸" 상태. 결과: play-state만
  // paused로는 UpdateLayoutTree(~300ms)/Layerize(~700ms)/Paint
  // (~500ms, 전부 4초 기준)가 "전혀" 줄지 않았는데, style.animation을
  // 비우자 전부 4초에 1ms 안팎까지 떨어졌다(static 빈 페이지 수준).
  // 즉 Blink는 "일시정지된" CSS Animation 객체도 매 프레임 계속
  // 들여다보고 있었다 — paused는 "값이 안 바뀌게" 만들 뿐 "확인
  // 자체를 안 하게" 만들지는 않는다. 그래서 이번엔 멈출 때
  // animation-play-state 대신 style.animation을 통째로 비우고
  // (clearM00Animations), 다시 보일 때 비워뒀던 값을 그대로
  // 복원한다(applyM00Animations) — 대상 선택/난수(dur/delay)는
  // 페이지 로드 시 딱 한 번만 뽑고, 이후로는 그 결과를 재사용만
  // 한다(재선택 안 함 — 매번 다른 별이 반짝이게 바뀌면 "똑같은
  // 밤하늘"이라는 느낌이 깨짐).
  // 회전(궤적 2개 + 성도 1개)은 JS가 직접 duration을 주지 않고
  // css/main.css의 애니메이션을 그대로 쓰므로, 멈출 때 style.animation
  // = 'none'으로 덮어쓰고, 복원할 때는 style.animation을 비워 다시
  // CSS 쪽 정의로 돌아가게 하되, "멈춰 있던 동안 돈 것처럼" 보이도록
  // animation-delay를 경과 시간 기준으로 음수로 계산해 넣는다 —
  // 그냥 처음부터 다시 돌리면 매번 0도로 튀어 보이기 때문. flare/
  // 호흡처럼 위치가 random이라 "어디서 멈췄는지"가 의미 없는 것과
  // 달리, 회전은 계속 한 방향으로 도는 단일 움직임이라 튀는 게
  // 눈에 띌 수 있어 이렇게 구분했다. */
  const m00AnimEntries = []; // {el, anim, delay} — flare/묶음호흡/연결도형호흡
  // 2026-10-14 11차: css/main.css의 회전 duration(85/120/170s ->
  // 105/147/205s로 감속)과 반드시 같은 값을 유지해야 한다 — 여기
  // duration은 "멈췄다 재개할 때 경과 시간 기준으로 끊김 없이
  // 이어지도록" 위상(phase)을 계산하는 데 쓰이므로, CSS 쪽
  // animation-duration과 어긋나면 재개 시 각도가 미묘하게 틀어져
  // 보인다.
  const M00_ROTATIONS = [
    { id: 'm00-trails-inner', duration: 105 },
    { id: 'm00-trails-outer', duration: 147 },
    { id: 'm00-chart-spin', duration: 205 },
  ];
  const m00EpochMs = performance.now();
  let m00AnimationsActive = true;

  function initM00ChartAnimations() {
    const mount = document.getElementById('m00-chart-mount');
    if (!mount) return;
    const stars = Array.from(mount.querySelectorAll('circle.st0'));
    shuffleSample(stars, Math.min(55, stars.length)).forEach((el) => {
      const dur = (9 + Math.random() * 6).toFixed(1);
      const delay = `-${(Math.random() * dur).toFixed(1)}s`;
      m00AnimEntries.push({ el, anim: `m00-star-flare ${dur}s ease-in-out infinite`, delay });
    });

    const groups = Array.from(mount.querySelectorAll('#m00-chart-stars > g'));
    shuffleSample(groups, Math.round(groups.length / 4)).forEach((el) => {
      const dur = (13 + Math.random() * 7).toFixed(1);
      const delay = `-${(Math.random() * dur).toFixed(1)}s`;
      m00AnimEntries.push({ el, anim: `m00-chart-breathe ${dur}s ease-in-out infinite`, delay });
    });

    const connectors = Array.from(mount.querySelectorAll('#m00-chart-stars polygon.st0, #m00-chart-stars path.st0'));
    shuffleSample(connectors, Math.round(connectors.length / 4)).forEach((el) => {
      const dur = (14 + Math.random() * 7).toFixed(1);
      const delay = `-${(Math.random() * dur).toFixed(1)}s`;
      m00AnimEntries.push({ el, anim: `m00-chart-breathe-line ${dur}s ease-in-out infinite`, delay });
    });
  }
  initM00ChartAnimations();

  function applyM00Animations() {
    m00AnimEntries.forEach(({ el, anim, delay }) => {
      el.style.animation = anim;
      el.style.animationDelay = delay;
    });
    M00_ROTATIONS.forEach(({ id, duration }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const elapsedSec = (performance.now() - m00EpochMs) / 1000;
      el.style.animation = '';
      el.style.animationDelay = `-${(elapsedSec % duration).toFixed(2)}s`;
    });
  }

  function clearM00Animations() {
    m00AnimEntries.forEach(({ el }) => {
      el.style.animation = '';
      el.style.animationDelay = '';
    });
    M00_ROTATIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) el.style.animation = 'none';
    });
  }

  // 2026-10-14 9차(성능): M-00이 가로 스크롤로 화면 밖으로 완전히
  // 밀려난 뒤(E-00/E-01/E-02로 이동한 뒤)에도 애니메이션이 계속
  // 돌고 있었다 — 기존 일시정지 구조(body.is-o01-active)는 "O-01이
  // 보일 때"만 걸려 있어서, M-00이 그냥 스크롤로 안 보이게 된
  // 경우는 전혀 다루지 않았다. IntersectionObserver로 #M-00 섹션이
  // 실제 화면에 하나도 안 보이는 상태를 감지해 body에 m00-offscreen
  // 클래스를 붙인다(css/main.css의 :is() 일시정지 규칙도 defense-
  // in-depth로 계속 유지 — 혹시 아래 JS 쪽 처리가 누락되는 순간이
  // 있어도 최소한 멈춰는 있도록).
  // 2026-10-14 10차: 클래스 토글만으로는(위 설명대로) 비용이 안
  // 줄어서, is-o01-active/m00-offscreen 둘 중 하나라도 켜지면
  // clearM00Animations()를, 둘 다 꺼지면 applyM00Animations()를
  // 직접 호출하도록 연결했다. is-o01-active는 js/opening.js가
  // 토글하는데 그 파일은 이번 라운드 수정 범위 밖이라, body의
  // class 속성 변화를 MutationObserver로 지켜보는 방식으로 건드리지
  // 않고 감지한다. */
  function updateM00AnimationActivity() {
    const shouldBeActive =
      !document.body.classList.contains('is-o01-active') &&
      !document.body.classList.contains('m00-offscreen');
    if (shouldBeActive === m00AnimationsActive) return;
    m00AnimationsActive = shouldBeActive;
    if (shouldBeActive) applyM00Animations();
    else clearM00Animations();
  }

  const m00Section = document.getElementById('M-00');
  if (m00Section && 'IntersectionObserver' in window) {
    const m00VisibilityObserver = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      document.body.classList.toggle('m00-offscreen', !entry.isIntersecting);
      updateM00AnimationActivity();
    }, { threshold: 0 });
    m00VisibilityObserver.observe(m00Section);
  }
  new MutationObserver(updateM00AnimationActivity)
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  updateM00AnimationActivity();

  // 내부 링크(별 수록 목차, breadcrumb, 레일 로고, 전체 메뉴 칼럼 등)로
  // 화면 이동. 전체 메뉴가 열려 있는 상태에서 누른 거라면 이동과 함께
  // 메뉴도 같이 닫는다. stopPropagation이 필요한 이유: 전체 메뉴의
  // '입구' 칼럼 자체도 data-target="E-00"을 갖고 있는데, 그 안에
  // data-target="E-01"/"E-02"인 하위 목록 링크가 중첩되어 있다.
  // 전파를 막지 않으면 하위 링크를 눌러도 이벤트가 부모까지 올라가
  // E-01로 이동한 직후 곧바로 E-00으로 덮어써 버린다.
  document.querySelectorAll('[data-target]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      goToScreenId(el.dataset.target);
      if (isNavOverlayOpen()) closeNavOverlay();
    });
  });

  // ------------------------------------------------------------
  // 렌더 루프
  // 2026-10-14 9차(성능, 가장 큰 변경): 이 루프는 이전까지 state.current
  // 가 실제로 변하는지와 무관하게 매 프레임(최초 로드부터 페이지를
  // 닫을 때까지, M-00이 보이든 E-00/E-01/E-02가 보이든, 스크롤 중이든
  // 완전히 멈춰 있든) 무조건 돌며 아래 5개 함수를 전부 호출했다.
  // 이 함수들(updateRailChrome/updateReveals/updateE00ParallaxBg/
  // updateM00ParallaxBg/updateImageZooms)은 전부 state.current "만의"
  // 함수라서, state.current가 이전 프레임과 같으면 결과도 100% 같다
  // — 즉 "아무것도 안 바뀌었는데도 매 프레임 style을 다시 쓰고 있던"
  // 구조였다. Chrome Tracing(Tracing.start, CDP)으로 idle 상태(스크롤
  // 없음, M-00 반짝임/회전만 도는 중) 4초를 실측해보니
  // FireAnimationFrame/UpdateLayoutTree(스타일 재계산)/Layout(강제
  // 레이아웃)/Layerize(레이어 트리 재구성)가 전부 "정확히 241회"로
  // 똑같이 찍혔다 — 즉 이 루프가 단순히 60fps로 도는 것을 넘어서
  // "매 프레임 빠짐없이" 레이아웃/스타일 재계산/레이어 재구성을
  // 유발하고 있었다는 뜻이다(특히 Layerize만 4초에 712ms — 이
  // 사이트의 핵심 성능 병목 중 하나로 실측 확인됨, IMPLEMENTATION_
  // STATUS.md 7.30 참고). 고친 방법: state.current가 "실제로"
  // 바뀐 프레임에서만 저 5개 함수를 호출하고, 안 바뀐 프레임(스크롤이
  // 완전히 멈춰 목표값에 도달한 뒤)에는 다음 rAF만 예약하고 즉시
  // 리턴한다 — 활성 스크롤/이징 중에는 지금처럼 매 프레임 그대로
  // 동작하고(체감 변화 없음), 정지해 있을 때만 이 비용이 통째로
  // 사라진다. 리사이즈 시에는 applySizes()가 이 5개 함수를 직접(한
  // 번만) 호출하므로 raf()가 건너뛰어도 반영이 누락되지 않는다. */
  function raf() {
    const prevCurrent = state.current;
    state.current += (state.target - state.current) * EASE;
    if (Math.abs(state.target - state.current) < 0.05) {
      state.current = state.target;
    }
    if (state.current !== prevCurrent) {
      track.style.transform = `translate3d(${-state.current}px, 0, 0)`;
      updateRailChrome();
      updateReveals();
      updateE00ParallaxBg();
      updateM00ParallaxBg();
      updateImageZooms();
    }
    requestAnimationFrame(raf);
  }

  // window 'resize' 이벤트는 브라우저 줌이나 OS 레벨 배율 변경 등에서
  // 누락될 수 있어, .viewport 자체 크기 변화를 직접 감시하는
  // ResizeObserver를 기본으로 쓰고 'resize' 는 보조 수단으로 둔다.
  if ('ResizeObserver' in window) {
    new ResizeObserver(applySizes).observe(viewport);
  } else {
    window.addEventListener('resize', applySizes);
  }

  applySizes();
  requestAnimationFrame(raf);
})();
