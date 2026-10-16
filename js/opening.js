// ============================================================
// 별운관 — 오프닝 시퀀스 (O-01 첫 화면) 동작 스크립트
//
// js/main.js(기존 메인 사이트의 가로 스크롤 엔진)는 전혀 건드리지
// 않는다. 대신 이 파일이 window에 capture 단계로 wheel/keydown
// 리스너를 먼저 등록해 이벤트를 가로채고 stopPropagation으로
// main.js의 버블 단계 리스너까지 전달되지 않게 막는다 — main.js는
// window에서 버블 단계로만 듣고 있어서(둘 다 캡처를 안 쓰면 등록
// 순서가 중요해지는데, 캡처 단계는 항상 버블 단계보다 먼저 실행되므로
// 등록 순서와 무관하게 항상 여기서 먼저 가로채진다), 이 파일을
// main.js보다 나중에 로드해도 안전하다.
// ============================================================
(() => {
  'use strict';

  // --------------------------------------------------------------
  // 설정값 — 문 열림/닫힘, 페이드 등 "모든" 타이밍은 여기 한 곳만
  // 고치면 전체에 반영된다. (css/opening.css에는 각 전환의 기본값만
  // 적어두고, 실제 적용되는 duration은 여기서 inline style로 주입)
  // --------------------------------------------------------------
  const TIMING = {
    doorHoldMs: 500,      // 첫 진입 시 닫힌 채로 대기 (지시값 0.3~0.8s)
    doorOpenMs: 1350,     // 문이 열리는 시간 (지시값 1.2~1.5s)
    doorCloseMs: 1100,    // 스크롤 트랜지션에서 문이 닫히는 시간
    hintFadeMs: 450,      // 유도 문구 페이드아웃 — 이게 끝나야 사운드 바 접힘이 시작됨(순차 진행)
    logoFadeMs: 600,      // 기존 문 닫힘 전 대기 안에서 중앙 로고·부제를 정리
    soundFoldMs: 400,     // 소리 바가 위로 접히며 사라지는 시간
    preCloseGapMs: 300,   // 두 UI가 완전히 정리된 뒤 문이 닫히기 시작하기 전 pause
    blackoutMs: 400,      // 블랙아웃 opacity 전환 시간
    blackoutHoldMs: 700,  // 문이 다 닫힌 뒤 블랙아웃이 안정적으로 깔릴 때까지 여유
    openingFadeMs: 900,   // O-01 <-> 메인 사이트(M-00) 전환 시 .opening 레이어 자체의 페이드 시간
  };

  // 기계적이지 않고 부드럽게 감속하는 곡선 — 문 열고 닫을 때 공통 사용
  const DOOR_EASE = 'cubic-bezier(0.22, 0.61, 0.26, 1)';

  const WHEEL_TRIGGER_THRESHOLD = 140; // 누적 deltaY가 이 값을 넘으면 1회 트랜지션 발동
  const WHEEL_IDLE_RESET_MS = 350;     // 이 시간 동안 추가 입력이 없으면 누적값 리셋
  const TOUCH_TRIGGER_PX = 70;         // 터치 스와이프 최소 이동량(아래로)

  // --------------------------------------------------------------
  // DOM 참조
  // --------------------------------------------------------------
  const opening = document.getElementById('opening');
  if (!opening) return; // 이 페이지에 오프닝 마크업이 없으면 아무것도 하지 않음

  const scene = document.getElementById('o01-scene');
  const center = opening.querySelector('.o01__center');
  const hint = document.getElementById('o01-hint');
  const lanternBtn = document.getElementById('o01-lantern-btn');
  const soundUi = document.getElementById('o01-soundui');
  const soundBtn = document.getElementById('o01-soundui-btn');
  const soundMenu = document.getElementById('o01-soundui-menu');
  const doorLeft = document.getElementById('o01-door-left');
  const doorRight = document.getElementById('o01-door-right');
  const blackout = document.getElementById('o01-blackout');
  const chartMount = document.getElementById('o01-chart-mount');

  // 설정값을 CSS 쪽 기본 transition-duration에도 1회 주입 (이후로는
  // 여기 있는 TIMING 값이 유일한 기준).
  hint.style.transitionDuration = `${TIMING.hintFadeMs}ms`;
  center.style.transitionDuration = `${TIMING.logoFadeMs}ms`;
  blackout.style.transitionDuration = `${TIMING.blackoutMs}ms`;
  opening.style.transitionDuration = `${TIMING.openingFadeMs}ms`;

  // --------------------------------------------------------------
  // 상태 머신: closed(초기) -> opening -> open(대기, 입력 수신) ->
  // closing -> blackout(암전 안정) -> hidden(.opening 레이어가 완전히
  // 페이드아웃되어 메인 사이트(M-00)가 활성 상태 — 오프닝의 입력 차단도
  // 이때부터 해제된다). hidden에서 다시 오프닝으로 돌아오면(메인 사이트
  // '오프닝 페이지로 이동') closed로 복귀해 같은 흐름을 재사용한다.
  // --------------------------------------------------------------
  let stage = 'closed';

  function setDoorDuration(ms) {
    const t = `transform ${ms}ms ${DOOR_EASE}`;
    doorLeft.style.transition = t;
    doorRight.style.transition = t;
  }

  // --------------------------------------------------------------
  // 별 궤적 / 별자리 성도 SVG
  //
  // 2026-10-13: 이전에는 fetch()로 01_SITE_IMAGES/*.svg를 받아와
  // 인라인 삽입했으나(내부 요소를 CSS로 개별 제어하려면 <img>가
  // 아니라 인라인 DOM이어야 하므로), 이 방식이 fetch가 실패하는
  // 환경(대표적으로 서버 없이 index.html을 그냥 더블클릭해서 여는
  // file:// 프로토콜 — 크로미움 계열 브라우저는 file:// 오리진
  // 간의 fetch/XHR을 CORS 정책으로 차단한다)에서는 두 SVG가 전혀
  // 삽입되지 않고 콘솔에만 에러가 찍힌 채 화면엔 아무 폴백도 없이
  // 완전히 비어 보이는 문제가 있었다(Playwright로 로컬 서버 환경
  // 에서는 정상 렌더링을 재확인했으나, 그 환경이 아니면 보장할 수
  // 없다는 근본적 약점). → 네트워크/프로토콜과 전혀 무관하게 항상
  // 동작하도록, 두 SVG의 전체 마크업을 index.html의
  // #o01-trails-mount / #o01-chart-mount 안에 직접 인라인으로
  // 심어뒀다(파일 자체의 좌표/데이터는 변경하지 않음 — 그대로
  // 복사). 이제 이 스크립트는 그 DOM을 그대로 참조만 하면 된다.
  // --------------------------------------------------------------

  // --------------------------------------------------------------
  // 성도 반짝임 1회 초기화 — 2026-10-14 4차 성능 개선.
  // 예전에는 circle.st1 1447개 "전부"에 CSS :nth-of-type로 개별
  // twinkle이 걸려 있었다(매 프레임 1447개의 opacity를 갱신하는
  // 비용 — "전체적으로 렉이 심하다" 피드백의 핵심 원인으로 추정).
  // 이제는 페이지 로드 시 딱 한 번(반복 타이머 아님) 무작위로 일부
  // 요소만 골라 inline style로 animation을 걸어두는 방식으로 바꿔
  // 애니메이션 대상 수 자체를 크게 줄였다 — ambient twinkle은
  // 완전히 폐지, flare/묶음호흡/연결선호흡만 "일부"에 적용한다.
  // CSS :nth-of-type는 부모(묶음)마다 자식 수가 달라 의도한 비율대로
  // 안 뽑히는 문제도 있었는데(예: flare 9% 의도 → 실측 15%대), 여기
  // 배열을 진짜로 셔플해 고르므로 그 문제도 함께 해결된다 — 또한
  // delay/duration이 전부 난수라 "반짝임이 동기화돼 보인다"는
  // 피드백에 맞춰 비동기 정도가 CSS 9분할보다 훨씬 자연스럽다.
  // --------------------------------------------------------------
  function shuffleSample(list, count) {
    const pool = list.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return pool.slice(0, count);
  }

  function initChartAnimations(mount, prefix) {
    if (!mount) return;
    const stars = Array.from(mount.querySelectorAll('circle.st1'));
    shuffleSample(stars, Math.min(70, stars.length)).forEach((el) => {
      const dur = (5 + Math.random() * 4).toFixed(1);
      const delay = (Math.random() * dur).toFixed(1);
      el.style.animation = `${prefix}-star-flare ${dur}s ease-in-out infinite`;
      el.style.animationDelay = `-${delay}s`;
    });

    // O-01의 인라인 성도 SVG는 최상위 <g>가 3개(테두리/별묶음/연결선)
    // 라 별묶음은 2번째, 연결선은 3번째다.
    // 2026-10-14 12차: 원판 전체 회전 래퍼 #o01-chart-spin이 추가되며
    // 이 3개 <g>가 svg의 "직계 자식"이 아니라 #o01-chart-spin의
    // 자식으로 한 단계 더 들어갔다 — svg > g:nth-of-type(N)은 이제
    // #o01-chart-spin 자신(유일한 직계 자식, nth-of-type(1))만
    // 가리키므로 기존 선택자로는 별묶음/연결선을 전혀 못 찾는다.
    // #o01-chart-spin을 기준점으로 삼아 한 단계 보정했다(M-00처럼
    // 아예 명시적 id로 바꾸는 대신 최소 수정으로 맞춤 — SVG 내부
    // 구조 자체는 더 건드리지 않기 위함).
    const groups = Array.from(mount.querySelectorAll('#o01-chart-spin > g:nth-of-type(2) > g'));
    shuffleSample(groups, Math.round(groups.length / 3)).forEach((el) => {
      const dur = (8 + Math.random() * 5).toFixed(1);
      const delay = (Math.random() * dur).toFixed(1);
      el.style.animation = `${prefix}-chart-breathe ${dur}s ease-in-out infinite`;
      el.style.animationDelay = `-${delay}s`;
    });

    const lines = Array.from(mount.querySelectorAll('#o01-chart-spin > g:nth-of-type(3) > line'));
    shuffleSample(lines, Math.round(lines.length / 3)).forEach((el) => {
      const dur = (9 + Math.random() * 5).toFixed(1);
      const delay = (Math.random() * dur).toFixed(1);
      el.style.animation = `${prefix}-chart-breathe-line ${dur}s ease-in-out infinite`;
      el.style.animationDelay = `-${delay}s`;
    });
  }

  initChartAnimations(chartMount, 'o01');

  // --------------------------------------------------------------
  // 문 자동 열림 (최초 진입 + 개발자 리셋 시 재사용)
  // --------------------------------------------------------------
  function playDoorOpen() {
    stage = 'opening';
    setDoorDuration(TIMING.doorOpenMs);
    void doorLeft.offsetWidth; // 강제 reflow — 직전 0ms 스냅과 이번 transition이 분리되게
    doorLeft.classList.add('is-open');
    doorRight.classList.add('is-open');

    window.setTimeout(() => {
      stage = 'open';
      hint.classList.add('is-visible');
    }, TIMING.doorOpenMs);
  }

  window.setTimeout(playDoorOpen, TIMING.doorHoldMs);

  // --------------------------------------------------------------
  // 등롱 — 클릭/키보드로 점등 토글 + 흔들림.
  // O-01 자체는 설명 텍스트 박스를 띄우지 않는다 — 다른 오프닝
  // 페이지에서 "등롱 클릭 시 설명 박스 표시" 기능을 붙일 자리로
  // onLanternClick만 남겨둔다(여기서는 토글 로직만 수행).
  // 장면이 바뀌면 항상 OFF로 리셋돼야 하므로 상태를 모듈 스코프
  // 안에서만 들고 있고, resetO01Scene()에서 같이 리셋한다.
  // --------------------------------------------------------------
  let lanternLit = false;

  function onLanternClick() {
    lanternLit = !lanternLit;
    lanternBtn.classList.toggle('is-lit', lanternLit);
    lanternBtn.setAttribute('aria-pressed', String(lanternLit));

    lanternBtn.classList.remove('is-swinging');
    void lanternBtn.offsetWidth;
    lanternBtn.classList.add('is-swinging');
  }
  lanternBtn.addEventListener('click', onLanternClick);
  lanternBtn.addEventListener('animationend', (e) => {
    if (e.animationName === 'o01-lantern-swing') lanternBtn.classList.remove('is-swinging');
  });

  // --------------------------------------------------------------
  // 소리 UI — 클릭하면 ON/OFF 메뉴 토글. 실제 오디오 파일이 아직
  // 없으므로(임의 대체 금지) 여기서는 UI 상태만 바꾸고 실제 재생은
  // 시작하지 않는다 — 아무것도 재생하지 않으니 "재생 중"이라고
  // 잘못 표시할 위험도 없다. bar 높이는 지금은 고정값/장식용 애니
  // 메이션이며, 추후 실제 오디오 분석 데이터가 생기면 soundBars의
  // style.height를 매 프레임 갱신하도록 바꾸면 된다.
  // --------------------------------------------------------------
  const soundBars = soundUi.querySelectorAll('.o01__soundui-bar');
  soundBtn.setAttribute('aria-label', `배경음 설정 열기 (현재 ${soundBtn.dataset.soundOn === 'true' ? 'ON' : 'OFF'})`);

  function closeSoundMenu() {
    soundMenu.classList.remove('is-open');
    soundBtn.setAttribute('aria-expanded', 'false');
  }
  function openSoundMenu() {
    soundMenu.classList.add('is-open');
    soundBtn.setAttribute('aria-expanded', 'true');
  }
  soundBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (soundMenu.classList.contains('is-open')) closeSoundMenu(); else openSoundMenu();
  });
  soundMenu.querySelectorAll('button[data-sound-choice]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const on = btn.dataset.soundChoice === 'on';
      soundBtn.dataset.soundOn = String(on);
      soundBtn.setAttribute('aria-label', `배경음 설정 열기 (현재 ${on ? 'ON' : 'OFF'})`);
      soundMenu.querySelectorAll('button[data-sound-choice]').forEach((b) => {
        b.setAttribute('aria-checked', String(b === btn));
      });
      closeSoundMenu();
    });
  });
  document.addEventListener('click', (e) => {
    if (!soundUi.contains(e.target)) closeSoundMenu();
  });

  // --------------------------------------------------------------
  // 스크롤(휠/터치) → 다음 오프닝 장면으로의 전환 트리거
  //
  // main.js도 window의 'wheel'을 버블 단계로 듣는다. 여기서는 capture
  // 단계에서 항상 먼저 가로채 preventDefault + stopPropagation 하므로
  // main.js의 리스너에는 아예 도달하지 않는다 — 페이지 자체가
  // 시각적으로 움직이는 일이 없다. keydown(화살표/PageUp/PageDown)도
  // 같은 이유로 capture 단계에서 항상 stopPropagation 한다. 단,
  // stopPropagation은 "다른 리스너로의 전파"만 막을 뿐 포커스된
  // 버튼의 Enter/Space 활성화, Tab 이동 같은 브라우저 기본 동작과는
  // 무관하다 — 그래서 등롱/소리 버튼은 키보드로도 정상 동작한다.
  // --------------------------------------------------------------
  let wheelAccum = 0;
  let wheelIdleTimer = null;

  function resetWheelAccum() {
    wheelAccum = 0;
    if (wheelIdleTimer) window.clearTimeout(wheelIdleTimer);
    wheelIdleTimer = null;
  }

  window.addEventListener('wheel', (e) => {
    // stage === 'hidden'(오프닝이 완전히 사라지고 메인 사이트가 활성
    // 상태)일 때는 아무것도 하지 않고 그대로 통과시켜, 메인 사이트의
    // 가로 스크롤(js/main.js, window의 버블 단계 'wheel' 리스너)이
    // 정상적으로 동작하게 한다.
    if (stage === 'hidden') return;

    // 그 외(오프닝이 화면을 덮고 있는 모든 상태)에는 아래 메인 사이트가
    // 절대 스크롤되면 안 되므로 항상 막는다.
    e.preventDefault();
    e.stopPropagation();

    if (stage !== 'open') return; // 문 여닫는 중/트랜지션 중엔 입력 무시 — 중복 트리거 방지
    if (e.deltaY <= 0) return; // 아래로 내리는 입력만 "다음 장면" 신호로 취급

    wheelAccum += e.deltaY;
    if (wheelIdleTimer) window.clearTimeout(wheelIdleTimer);
    wheelIdleTimer = window.setTimeout(resetWheelAccum, WHEEL_IDLE_RESET_MS);

    if (wheelAccum >= WHEEL_TRIGGER_THRESHOLD) {
      resetWheelAccum();
      playTransitionOut();
    }
  }, { capture: true, passive: false });

  window.addEventListener('keydown', (e) => {
    // wheel과 동일한 이유로, 오프닝이 비활성 상태면 메인 사이트의
    // 키보드 입력(화살표/PageUp/PageDown 등)을 그대로 통과시킨다.
    if (stage === 'hidden') return;

    if (stage === 'blackout' && e.key === '0') {
      // 개발자 전용 리셋 단축키 — 콘솔에서 window.o01DevReset()으로도
      // 호출 가능. 암전이 안정되면 곧 자동으로 goToNextScene()이
      // 실행되어 stage가 'hidden'으로 바뀌므로, 이 단축키가 쓸 수
      // 있는 창은 매우 짧다(= 일반 방문자가 우연히 누를 가능성이
      // 사실상 없다).
      resetO01Scene();
    }
    e.stopPropagation();
  }, { capture: true });

  let touchStartY = null;
  scene.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0] ? e.touches[0].clientY : null;
  }, { passive: true });

  scene.addEventListener('touchmove', (e) => {
    e.preventDefault(); // 모바일 브라우저 바운스/스크롤 방지
  }, { passive: false });

  scene.addEventListener('touchend', (e) => {
    if (stage !== 'open' || touchStartY === null) return;
    const endY = e.changedTouches[0] ? e.changedTouches[0].clientY : touchStartY;
    const dy = touchStartY - endY;
    touchStartY = null;
    if (dy >= TOUCH_TRIGGER_PX) playTransitionOut();
  });

  // --------------------------------------------------------------
  // 다음 장면으로의 전환 시퀀스:
  // 유도 문구 페이드아웃 → 소리 UI 접힘 → 짧은 pause → 문 닫힘(완료) →
  // 블랙아웃 → 블랙아웃 유지 → 다음 장면(M-00) 전환
  // --------------------------------------------------------------
  function playTransitionOut() {
    if (stage !== 'open') return;
    stage = 'closing';
    // 기존 1150ms 대기와 겹쳐 재생하므로 문·장면 전환 시점은 그대로다.
    opening.classList.add('is-exiting');

    // 열려 있던 메뉴는 즉시 정리(비주얼 fold와는 별개로, 떠 있는 채로
    // 남아있으면 안 되므로) — 아래 순서 자체에는 영향 없음.
    closeSoundMenu();

    // 1) 안내 문구가 먼저 사라진다
    hint.classList.remove('is-visible');

    // 2) 문구가 "다 사라진 뒤에" 사운드 바가 접힌다 — 동시에 시작하면
    // 두 UI가 한꺼번에 사라지는 것처럼 보여 순차감이 안 느껴지므로,
    // hintFadeMs만큼 기다렸다가 시작한다.
    window.setTimeout(() => {
      soundUi.style.animationDuration = `${TIMING.soundFoldMs}ms`;
      soundUi.classList.add('is-folding');
    }, TIMING.hintFadeMs);

    // 3) 두 UI가 완전히 정리된 뒤 짧은 정적, 그 다음에야 문이 닫히기
    // 시작한다.
    const doorStartDelay = TIMING.hintFadeMs + TIMING.soundFoldMs + TIMING.preCloseGapMs;
    window.setTimeout(() => {
      setDoorDuration(TIMING.doorCloseMs);
      doorLeft.classList.remove('is-open');
      doorRight.classList.remove('is-open');

      // 2026-10-14: "창호지가 끝까지 닫히기 전에 화면이 어두워진다"는
      // 신고로 수정. 처음엔 "문이 닫히는 도중(doorCloseMs - blackoutMs
      // 시점)에 블랙아웃을 겹쳐 시작"해서 문제였고, 그 다음엔 "문 닫힘
      // 시작으로부터 TIMING.doorCloseMs만큼 setTimeout으로 기다린 뒤
      // 블랙아웃 시작"으로 바꿨지만, 저사양 환경이나 창이 백그라운드에
      // 있다가 돌아온 경우 등 실제 CSS 트랜지션이 지정 시간(1100ms)보다
      // 오래 걸릴 수 있어 setTimeout만으로는 "진짜로 다 닫힌 뒤"를
      // 보장하지 못한다. 그래서 지정 시간만큼 기다리는 대신, 문
      // (doorLeft)의 transform transitionend 이벤트를 직접 구독해 —
      // 실제로 트랜지션이 끝난 바로 그 순간에만 블랙아웃을 시작한다.
      doorLeft.addEventListener('transitionend', function onDoorFullyClosed(e) {
        if (e.propertyName !== 'transform') return;
        doorLeft.removeEventListener('transitionend', onDoorFullyClosed);

        blackout.classList.add('is-active');

        window.setTimeout(() => {
          stage = 'blackout';
          goToNextScene();
        }, TIMING.blackoutMs + TIMING.blackoutHoldMs);
      });
    }, doorStartDelay);
  }

  // --------------------------------------------------------------
  // O-01 종료 → 다음 장면 연결 지점
  //
  // 지금은 O-02~O-09가 아직 없으므로, 암전이 안정된 직후 곧장 메인
  // 사이트 표지(M-00)로 넘어간다. js/main.js가 window에 노출해 둔
  // m00Enter()로 메인 사이트 스크롤 위치를 M-00으로 먼저(아직 화면엔
  // 안 보이는 상태에서) 스냅시킨 뒤, .opening 레이어 자체를
  // 페이드아웃시켜 "암전 → 메인 사이트" 크로스페이드를 만든다.
  //
  // 추후 O-02가 추가되면 이 함수의 내용만 "O-02로 전환"하는 로직으로
  // 바꾸면 된다 — 문 열림/닫힘, 블랙아웃, 스크롤 트리거 등 나머지
  // 상태 머신은 그대로 재사용 가능하다.
  // --------------------------------------------------------------
  function goToNextScene() {
    stage = 'hidden';
    if (window.m00Enter) window.m00Enter();
    document.body.classList.remove('is-o01-active');
    opening.classList.add('is-hidden');
    opening.setAttribute('aria-hidden', 'true');

    // 2026-10-14 4차 성능 개선(점검 항목 D): 페이드아웃(opacity 1->0,
    // openingFadeMs)이 "실제로 끝난 뒤"에만 display:none을 걸어
    // #opening을 렌더 트리에서 완전히 뺀다 — opacity:0만으로는 문/
    // 별 궤적/성도 애니메이션이 화면엔 안 보여도 계속 돌면서
    // 리페인트 비용을 쓴다. transitionend 전에 display:none을 걸면
    // 트랜지션 자체가 생략돼 크로스페이드가 깨지므로 반드시 전환이
    // 끝난 뒤에만 적용한다. stage 가드는 페이드가 끝나기 전에
    // 사용자가 다시 '오프닝으로 이동'을 눌러 되돌아온 극단적인 경우,
    // 방금 다시 보이기 시작한 #opening을 실수로 숨기지 않기 위함.
    opening.addEventListener('transitionend', function onFadeOutDone(e) {
      if (e.propertyName !== 'opacity') return;
      opening.removeEventListener('transitionend', onFadeOutDone);
      if (stage === 'hidden') opening.style.display = 'none';
    });
  }

  // 문 닫힘/등롱/사운드 UI 등을 "닫힌 초기 상태"로 즉시(트랜지션 없이)
  // 되돌리는 공통 부분. resetO01Scene(개발자 콘솔용)과
  // enterFromMainSite(메인 사이트 '오프닝 페이지로 이동') 양쪽에서
  // 재사용한다.
  function resetSceneToClosedInstant() {
    opening.classList.remove('is-exiting');
    blackout.classList.remove('is-active');
    hint.classList.remove('is-visible');
    soundUi.classList.remove('is-folding');

    lanternLit = false;
    lanternBtn.classList.remove('is-lit', 'is-swinging');
    lanternBtn.setAttribute('aria-pressed', 'false');
    closeSoundMenu();

    setDoorDuration(0);
    doorLeft.classList.remove('is-open');
    doorRight.classList.remove('is-open');
    void doorLeft.offsetWidth;
  }

  // 개발 콘솔 전용 리셋 — O-01을 처음부터 다시 재생한다. 방문자용
  // UI에는 이 함수로 이어지는 노출된 버튼/링크가 없다(블랙아웃 클릭으로
  // 트리거되던 과거 동작은 제거됨 — 암전 뒤에는 자동으로 M-00으로
  // 넘어가므로, 그 화면을 일반 방문자가 클릭해도 아무 일도 일어나지
  // 않아야 한다).
  function resetO01Scene() {
    stage = 'closed';
    resetSceneToClosedInstant();
    window.setTimeout(playDoorOpen, TIMING.doorHoldMs);
  }
  window.o01DevReset = resetO01Scene;

  // --------------------------------------------------------------
  // 메인 사이트 → O-01 복귀 ('오프닝 페이지로 이동', js/main.js에서
  // window.o01Enter()로 호출)
  //
  // stage가 'hidden'일 때만 동작한다(= 오프닝이 메인 사이트에 완전히
  // 가려진 상태일 때만) — 이미 오프닝이 보이는 중에 중복 호출돼도
  // 아무 일도 하지 않아, 반복 전환 시 애니메이션이 겹쳐 재생되는 것을
  // 막는다. 화면이 아직 투명한(opacity 0) 동안 조용히 "문 닫힌 초기
  // 상태"로 되돌린 뒤, .opening의 opacity를 1로 되돌려(= 암전으로
  // 자연스럽게 페이드인) 그 페이드가 끝나는 시점에 기존 첫 진입
  // 시퀀스(playDoorOpen)를 그대로 재생한다.
  // --------------------------------------------------------------
  function enterFromMainSite() {
    if (stage !== 'hidden') return;

    stage = 'closed';
    resetSceneToClosedInstant();
    // display:none부터 해제해야 아래 opacity 트랜지션이 다시 재생된다
    // (display:none인 요소는 트랜지션을 타지 않고 즉시 적용되어 버림).
    opening.style.display = '';
    opening.removeAttribute('aria-hidden');
    document.body.classList.add('is-o01-active'); // M-00 쪽 애니메이션을 다시 멈춤(css/main.css 참고)

    void opening.offsetWidth; // reflow — 아래 클래스 제거가 새 트랜지션으로 인식되게
    opening.classList.remove('is-hidden'); // opacity 0 -> 1, 암전 페이드인

    window.setTimeout(playDoorOpen, TIMING.openingFadeMs + TIMING.doorHoldMs);
  }
  window.o01Enter = enterFromMainSite;
})();
