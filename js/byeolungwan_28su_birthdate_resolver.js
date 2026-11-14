/**
 * 별운관 28수 생년월일 판정 모듈.
 * 근거: data.zip / data/28su_dates_v3.js
 * JSON을 로드하며, 양력 생년월일의 월·일 기준으로 판정합니다.
 * 음력 입력은 외부에서 양력 변환 후 호출해야 합니다.
 */
export async function loadMansionReference(url = "./data/byeolungwan_28su_birthdate_reference.json") {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`별자리 기준 데이터 로드 실패: HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.mansions) || data.mansions.length !== 28) {
    throw new Error("별자리 기준 데이터가 올바르지 않습니다.");
  }
  return data;
}

/** 날짜 입력의 유효성을 검증합니다. 출생연도는 윤년 검증에만 사용됩니다. */
export function validateSolarBirthdate(year, month, day) {
  if (![year, month, day].every(Number.isInteger)) return false;
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= monthDays[month - 1];
}

/** 이미 양력으로 확인된 생년월일을 판정합니다. 반환 값은 mansions의 한 항목입니다. */
export function resolveMansionBySolarBirthdate(reference, year, month, day) {
  if (!validateSolarBirthdate(year, month, day)) throw new RangeError("올바르지 않은 양력 생년월일입니다.");
  if (!reference || !Array.isArray(reference.mansions)) throw new TypeError("별자리 기준 데이터가 필요합니다.");
  const value = month * 100 + day;
  const found = reference.mansions.filter((m) => {
    const start = m.start.month * 100 + m.start.day;
    const end = m.end.month * 100 + m.end.day;
    return start <= end ? value >= start && value <= end : value >= start || value <= end;
  });
  if (found.length !== 1) throw new Error(`별자리 판정 범위 오류: ${month}/${day} (${found.length}건)`);
  return found[0];
}

// 사용 예:
// const reference = await loadMansionReference();
// const mansion = resolveMansionBySolarBirthdate(reference, 2002, 4, 10);
// console.log(mansion.id, mansion.name); // 1, 이무기자리
