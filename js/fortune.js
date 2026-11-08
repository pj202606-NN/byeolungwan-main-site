(() => {
  'use strict';
  const section = document.getElementById('F-02');
  const catalog = window.ByeolConstellations;
  const stars = window.ByeolStars;
  if (!section || !catalog || !stars) return;
  // Reuse the explicitly approved exhibition-site/pages/fortune.html demo.
  // Replace this adapter when the project's final assignment data arrives.
  const lines = [
    '오늘은 서두르지 않아도 좋을 하루입니다.',
    '작은 인연 하나가 마음에 오래 남을 것입니다.',
    '미뤄둔 말을 꺼내기에 나쁘지 않은 때입니다.',
    '생각보다 몸이 먼저 움직이는 하루가 될 수 있습니다.',
    '혼자만의 시간이 오늘의 답을 줄지도 모릅니다.',
    '뜻밖의 곳에서 좋은 소식이 들려올 수 있습니다.',
    '평소보다 조금 더 마음을 열어보세요.',
    '오늘 내린 결정은 두고두고 도움이 될 것입니다.',
  ];
  function calculate({ year, month, day }) {
    year = Number(year); month = Number(month); day = Number(day);
    if (![year, month, day].every(Number.isInteger)) return null;
    const timestamp = Date.UTC(year, month - 1, day), date = new Date(timestamp);
    if (year < 1930 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    const dayOfYear = Math.round((timestamp - Date.UTC(year, 0, 0)) / 86400000);
    const index = dayOfYear % catalog.length;
    const seed = index + year + month * 31 + day;
    return { year, month, day, index, star: catalog[index], description: stars[index].desc,
      today: lines[seed % lines.length], advice: `${lines[(seed + 3) % lines.length]} ${lines[(seed + 5) % lines.length]}` };
  }
  function render(birthdate) {
    const result = calculate(birthdate);
    if (!result) return false;
    const { star } = result;
    section.dataset.starId = star.file;
    section.dataset.guardian = star.guardian;
    section.dataset.birthdate = `${result.year}-${String(result.month).padStart(2, '0')}-${String(result.day).padStart(2, '0')}`;
    section.querySelector('.f02__title').textContent = star.name;
    section.querySelector('.f02__subtitle').textContent = `${star.hanja}宿 · ${star.animal}자리`;
    section.querySelector('.f02__desc').textContent = `${star.name}의 상징 동물은 ${star.animal}입니다. ${star.direction} ${star.groupName}에 속한 일곱 별자리 중 하나로, ${result.description}`;
    const art = section.querySelector('.f02__star'), card = section.querySelector('.f02__card');
    art.src = `01_SITE_IMAGES/28su/${star.file}.svg`;
    art.alt = `${star.name} 별자리`;
    card.src = `01_SITE_IMAGES/28su/${star.file}-card.webp`;
    card.alt = `${star.name} 별자리 카드`;
    section.querySelector('.f02__fortune-p1').textContent = result.today;
    section.querySelector('.f02__fortune-p2').textContent = result.advice;
    return true;
  }
  window.ByeolFortune = Object.freeze({ calculate });
  window.addEventListener('byeol:birthdate', event => render(event.detail));
  try {
    const stored = JSON.parse(sessionStorage.getItem('byeolungwan-f01-birthdate'));
    if (stored) render(stored);
  } catch {}
})();
