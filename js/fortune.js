(() => {
  'use strict';
  const section = document.getElementById('F-02');
  const data = window.ByeolData;
  if (!section || !data) return;
  const daily = new Map(data.fortune.today
    .filter(row => row['카테고리'] === '종합')
    .map(row => [`${row['날짜']}:${row['번호']}`, row]));
  let renderedBirthdate = null, renderedDate = null;

  function calculate({ year, month, day }) {
    year = Number(year); month = Number(month); day = Number(day);
    if (!data.validateSolarBirthdate(year, month, day)) return null;
    const star = data.resolveBirthdate(year, month, day);
    const date = data.fortuneDate;
    const fortune = daily.get(`${date}:${star.id}`);
    if (!fortune) return null;
    return { year, month, day, index: data.catalog.indexOf(star), star,
      description: star.resultDescription, date,
      today: fortune['간략'], detail: fortune['상세'], advice: fortune['상세'] };
  }

  function render(birthdate, { personal = true } = {}) {
    const result = calculate(birthdate);
    if (!result) return false;
    renderedBirthdate = { year: result.year, month: result.month, day: result.day };
    renderedDate = result.date;
    const { star } = result;
    section.dataset.starId = star.file;
    section.dataset.mansionId = String(star.id);
    section.dataset.guardian = star.guardian;
    section.dataset.birthdate = `${result.year}-${String(result.month).padStart(2, '0')}-${String(result.day).padStart(2, '0')}`;
    section.querySelector('.f02__title').textContent = star.name;
    const identity = document.createElement('span');
    identity.textContent = `${star.hanja}宿 · ${star.constellationName}`;
    const range = document.createElement('span');
    range.className = 'f02__birth-range';
    range.textContent = star.dateRange;
    section.querySelector('.f02__subtitle').replaceChildren(identity, range);
    const description = section.querySelector('.f02__desc');
    description.textContent = result.description ?? '별자리 소개 데이터를 불러오지 못했습니다.';
    description.toggleAttribute('data-description-error', result.description === null);
    const art = section.querySelector('.f02__star'), card = section.querySelector('.f02__card');
    art.src = `01_SITE_IMAGES/28su/${star.file}.svg`;
    art.alt = `${star.name} · ${star.constellationName} 별자리`;
    card.src = `01_SITE_IMAGES/28su/${star.file}-card.webp`;
    card.alt = `${star.name} · ${star.constellationName} 카드`;
    section.querySelector('.f02__fortune-p1').textContent = result.today;
    section.querySelector('.f02__fortune-p2').textContent = result.detail;
    const date = section.querySelector('.f02__fortune-date');
    date.dateTime = result.date;
    date.textContent = result.date.replaceAll('-', '.');
    if (personal) data.selectPersonalStar(star.id);
    return true;
  }
  window.ByeolFortune = Object.freeze({ calculate, render });
  window.addEventListener('byeol:birthdate', event => render(event.detail));
  let restored = false;
  try {
    const stored = JSON.parse(sessionStorage.getItem('byeolungwan-f01-birthdate'));
    if (stored) restored = render(stored);
  } catch {}
  if (!restored) {
    render({ year: 2002, month: 4, day: 30 }, { personal: false });
    delete section.dataset.birthdate;
  }
  // Refresh an already open result at Korean midnight, or when returning to a suspended tab.
  function refreshFortune() {
    if (!renderedBirthdate || renderedDate === data.fortuneDate) return;
    const hadBirthdate = section.hasAttribute('data-birthdate');
    render(renderedBirthdate, { personal: false });
    if (!hadBirthdate) delete section.dataset.birthdate;
  }
  function scheduleMidnightRefresh() {
    const dayMs = 86400000, koreaOffsetMs = 9 * 3600000;
    setTimeout(() => {
      refreshFortune();
      scheduleMidnightRefresh();
    }, dayMs - ((Date.now() + koreaOffsetMs) % dayMs) + 50);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshFortune(); });
  window.addEventListener('pageshow', refreshFortune);
  scheduleMidnightRefresh();
})();
