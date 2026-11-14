import {
  loadMansionReference,
  validateSolarBirthdate,
  resolveMansionBySolarBirthdate,
} from './byeolungwan_28su_birthdate_resolver.js';

// Keep asset filenames separate from the authored names and date ranges.
const files = [
  'CD-01-gak', 'CD-02-hang', 'CD-03-jeo', 'CD-04-bang', 'CD-05-sim', 'CD-06-mi', 'CD-07-gi',
  'HM-01-du', 'HM-02-u', 'HM-03-yeo', 'HM-04-heo', 'HM-05-wi', 'HM-06-sil', 'HM-07-byeok',
  'BH-01-gyu', 'BH-02-ru', 'BH-03-wi', 'BH-04-myo', 'BH-05-pil', 'BH-06-ja', 'BH-07-sam',
  'JJ-01-jeong', 'JJ-02-gwi', 'JJ-03-ryu', 'JJ-04-seong', 'JJ-05-jang', 'JJ-06-ik', 'JJ-07-jin',
];
const groups = {
  동방청룡: { guardian: 'cheongryong', groupName: '청룡', direction: '동방' },
  북방현무: { guardian: 'hyeonmu', groupName: '현무', direction: '북방' },
  서방백호: { guardian: 'baekho', groupName: '백호', direction: '서방' },
  남방주작: { guardian: 'jujak', groupName: '주작', direction: '남방' },
};
const [reference, fortune, compatibility, descriptionRows] = await Promise.all([
  loadMansionReference(new URL('../data/byeolungwan_28su_birthdate_reference.json', import.meta.url)),
  fetch(new URL('../data/byeolungwan_28su_today_WEB_20261119_25.json', import.meta.url)).then(response => {
    if (!response.ok) throw new Error(`운세 데이터 로드 실패: HTTP ${response.status}`);
    return response.json();
  }),
  fetch(new URL('../data/byeolungwan_28su_compatibility_v2.json', import.meta.url)).then(response => {
    if (!response.ok) throw new Error(`궁합 데이터 로드 실패: HTTP ${response.status}`);
    return response.json();
  }),
  fetch(new URL('../data/byeolungwan_28su_descriptions_v3.json', import.meta.url)).then(response => {
    if (!response.ok) throw new Error(`별자리 소개 데이터 로드 실패: HTTP ${response.status}`);
    return response.json();
  }).catch(error => {
    console.error('[별운관 소개 데이터]', error);
    return undefined;
  }),
]);
// Match authored descriptions by numeric ID, then verify every identity field.
// Failed descriptions must not prevent the existing fortune/compatibility tools from loading.
let descriptions = new Map();
if (descriptionRows !== undefined) {
  try {
    if (!Array.isArray(descriptionRows) || descriptionRows.length !== 28) {
      throw new Error('별자리 소개 데이터는 28개 항목의 배열이어야 합니다.');
    }
    const checked = new Map();
    for (const row of descriptionRows) {
      const id = row['번호'];
      const star = reference.mansions.find(mansion => mansion.id === id);
      if (!Number.isInteger(id) || !star || checked.has(id)
        || row['28수'] !== star.mansion || row['별자리'] !== star.name
        || row['사신'] !== star.sashin || row['동물'] !== star.animal
        || !['결과_소개', '사전_소개'].every(field => typeof row[field] === 'string' && row[field].trim())) {
        throw new Error(`별자리 소개 ID·기본정보·본문 오류: ${id}`);
      }
      checked.set(id, Object.freeze(row));
    }
    descriptions = checked;
  } catch (error) {
    console.error('[별운관 소개 데이터]', error);
  }
}
const catalog = Object.freeze(reference.mansions.map(mansion => {
  const match = /^(.+)\((.+)\)$/.exec(mansion.mansion);
  const file = files[mansion.id - 1];
  if (!match || !file || !groups[mansion.sashin]) throw new Error(`별자리 기준 데이터 오류: ${mansion.id}`);
  return Object.freeze({
    id: mansion.id, file, openingId: file.slice(0, 5),
    name: `${match[1]}수`, hanja: match[2],
    constellationName: mansion.name, animal: mansion.animal,
    sashin: mansion.sashin, ...groups[mansion.sashin],
    dateRange: mansion.date_range, shortAnalysis: mansion.short_analysis,
    resultDescription: descriptions.get(mansion.id)?.['결과_소개'] ?? null,
    dictionaryDescription: descriptions.get(mansion.id)?.['사전_소개'] ?? null,
  });
}));
const byId = new Map(catalog.map(star => [star.id, star]));
let personalStar = null;
const pairs = new Map(compatibility.pairs.map(pair => [`${pair.id_a}:${pair.id_b}`, pair]));
const same = new Map(compatibility.same_constellation.map(pair => [pair.star_id, pair]));
const featured = new Map(catalog.map(star => [star.id, compatibility.featured
  .filter(row => row.star_id === star.id)
  .sort((a, b) => ['천생연분', '보완', '주의'].indexOf(a.type) - ['천생연분', '보완', '주의'].indexOf(b.type) || a.rank - b.rank)]));
const fortuneDates = [...new Set(fortune.today.map(row => row['날짜']))].sort();
const koreanDate = new Intl.DateTimeFormat('en', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
});
function currentFortuneDate() {
  const parts = Object.fromEntries(koreanDate.formatToParts(new Date()).map(part => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  // Use the first authored day before launch and the latest available day after the data ends.
  return fortuneDates.filter(date => date <= today).at(-1) ?? fortuneDates[0];
}
window.ByeolData = Object.freeze({
  reference, catalog, byId, fortune, compatibility,
  get fortuneDate() { return currentFortuneDate(); },
  getPersonalStar() { return personalStar; },
  selectPersonalStar(id) {
    const star = byId.get(id);
    if (!star) return false;
    personalStar = star;
    window.dispatchEvent(new CustomEvent('byeol:personal-star', { detail: { id, index: catalog.indexOf(star) } }));
    return true;
  },
  featuredOf(id) { return featured.get(id) || []; },
  compatibilityOf(idA, idB) {
    return idA === idB ? same.get(idA) : pairs.get(`${Math.min(idA, idB)}:${Math.max(idA, idB)}`);
  },
  validateSolarBirthdate,
  resolveBirthdate(year, month, day) {
    return byId.get(resolveMansionBySolarBirthdate(reference, year, month, day).id);
  },
});

// Classic scripts keep their existing execution order and see ready data at startup.
for (const file of ['main', 'date-select', 'e02', 'constellation-dictionary', 'compatibility-images',
  'fortune', 'map-viewer', 'opening-pc', 'opening', 'chart-cache']) {
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(`./${file}.js?v=20261119.1`, import.meta.url).href;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`스크립트 로드 실패: ${file}`));
    document.body.append(script);
  });
}
