/* ============================================================
   만세력 계산 엔진 (나를 찾는 여정)
   - 사주팔자(년·월·일·시주): 절입 시각(분 단위) 기준
   - 진태양시 보정: 경도차 + 균시차, 한국 표준시 변천·서머타임 반영
   - 음양력 변환: KASI 기준 테이블(1900~2050)
   - 오행 분포(지장간 포함), 십성, 대운
   필요: lunar_table.js, solar_terms.js 먼저 로드
   ============================================================ */

// ---------- 기초 상수 ----------
const STEMS  = ['갑','을','병','정','무','기','경','신','임','계'];
const STEMS_H= ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCH = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
const BRANCH_H=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const ZODIAC = ['쥐','소','호랑이','토끼','용','뱀','말','양','원숭이','닭','개','돼지'];

const ELEM   = ['목','화','토','금','수'];
const ELEM_H = ['木','火','土','金','水'];
const STEM_ELEM   = [0,0,1,1,2,2,3,3,4,4];          // 갑을=목 병정=화 무기=토 경신=금 임계=수
const BRANCH_ELEM = [4,2,0,0,2,1,1,2,3,3,2,4];      // 자=수 축=토 인묘=목 진=토 사오=화 미=토 신유=금 술=토 해=수

// 지장간 [여기, (중기), 정기] — 스템 인덱스
const HIDDEN = [
  [8,9],      // 자: 임 계
  [9,7,5],    // 축: 계 신 기
  [4,2,0],    // 인: 무 병 갑
  [0,1],      // 묘: 갑 을
  [1,9,4],    // 진: 을 계 무
  [4,6,2],    // 사: 무 경 병
  [2,5,3],    // 오: 병 기 정
  [3,1,5],    // 미: 정 을 기
  [4,8,6],    // 신: 무 임 경
  [6,7],      // 유: 경 신
  [7,3,4],    // 술: 신 정 무
  [4,0,8],    // 해: 무 갑 임
];

const TERM_NAMES = ['소한','대한','입춘','우수','경칩','춘분','청명','곡우','입하','소만','망종','하지',
                    '소서','대서','입추','처서','백로','추분','한로','상강','입동','소설','대설','동지'];

const EPOCH_ANCHOR_DAY_PILLAR = 10;   // 1900-01-01 = 갑술일 (KASI 검증)
const SEOUL_LON = 126.9784;

// ---------- 달력 유틸 ----------
function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
       - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
const JDN_1900 = jdn(1900, 1, 1);   // 2415021

function isLeapYear(y){ return (y%4===0 && y%100!==0) || y%400===0; }
function daysInMonth(y,m){ return [31,isLeapYear(y)?29:28,31,30,31,30,31,31,30,31,30,31][m-1]; }

// 민간 시계 시각(한국) → UTC 경과분(1900-01-01 00:00 UTC 기준)
// KST_HISTORY: [[UTC경과분, 오프셋분], ...]
function localToUtcMin(y, mo, d, hh, mi) {
  const localMin = (jdn(y, mo, d) - JDN_1900) * 1440 + hh * 60 + mi;
  let utc = localMin - 540;                       // 1차 추정
  for (let k = 0; k < 3; k++) {
    let off = KST_HISTORY[0][1];
    for (const [t, o] of KST_HISTORY) { if (t <= utc) off = o; else break; }
    utc = localMin - off;
  }
  return utc;
}
function utcOffsetAt(utcMin){
  let off = KST_HISTORY[0][1];
  for (const [t, o] of KST_HISTORY) { if (t <= utcMin) off = o; else break; }
  return off;
}

// 균시차(분): 근사식 (±20초 수준)
function equationOfTime(utcMin) {
  const days = utcMin / 1440 - 36524.5;           // J2000 기준 일수 (2000-01-01 12:00 UTC)
  const B = 2 * Math.PI * ((days % 365.2422) - 80) / 365.2422;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

// 진태양시 경과분 (1900-01-01 00:00 서울 진태양시 기준)
function apparentSolarMin(utcMin, lon, useEoT) {
  let t = utcMin + lon * 4;
  if (useEoT) t += equationOfTime(utcMin);
  return t;
}

// ---------- 음양력 변환 (KASI 테이블) ----------
// 반환: {year, month, day, leap} / 실패 시 null
function solar2lunar(y, mo, d) {
  const j = jdn(y, mo, d);
  for (let ly = Math.min(y, LUNAR_YEAR_MAX); ly >= LUNAR_YEAR_MIN; ly--) {
    const [leapM, firstJdn, months] = LUNAR_TABLE[ly];
    if (firstJdn > j) continue;
    let off = j - firstJdn, mIdx = 0;
    while (mIdx < months.length && off >= months[mIdx]) { off -= months[mIdx]; mIdx++; }
    if (mIdx >= months.length) return null;       // 다음 해 소속
    let m = 0, leap = false, count = 0;
    for (let k = 1; k <= 12; k++) {
      count++; if (count - 1 === mIdx) { m = k; leap = false; break; }
      if (k === leapM) { count++; if (count - 1 === mIdx) { m = k; leap = true; break; } }
    }
    return { year: ly, month: m, day: off + 1, leap };
  }
  return null;
}
function lunar2solar(ly, lm, ld, leap) {
  if (!(ly in LUNAR_TABLE)) return null;
  const [leapM, firstJdn, months] = LUNAR_TABLE[ly];
  let mIdx = 0;
  for (let k = 1; k <= 12; k++) {
    if (k === lm && !leap) break;
    mIdx++;
    if (k === leapM) { if (k === lm && leap) break; mIdx++; }
    if (k === 12) return null;
  }
  if (leap && lm !== leapM) return null;
  if (ld > months[mIdx]) return null;
  let j = firstJdn + ld - 1;
  for (let i = 0; i < mIdx; i++) j += months[i];
  // JDN → 양력
  let a = j + 32044, b = Math.floor((4*a+3)/146097), c = a - Math.floor(146097*b/4);
  let dd = Math.floor((4*c+3)/1461), e = c - Math.floor(1461*dd/4), mm = Math.floor((5*e+2)/153);
  return { year: 100*b + dd - 4800 + Math.floor(mm/10),
           month: mm + 3 - 12*Math.floor(mm/10),
           day: e - Math.floor((153*mm+2)/5) + 1 };
}

// ---------- 절기 ----------
// utcMin 시점 직전의 '절(節)' (짝수 인덱스: 소한0 입춘2 경칩4 ...) 반환
function lastJie(utcMin) {
  // 해당 utc가 속한 서기년 부근 3개년에서 탐색
  const approxYear = 1900 + Math.floor(utcMin / 525949);
  let best = null;
  for (let y = approxYear - 1; y <= approxYear + 1; y++) {
    if (!(y in SOLAR_TERMS)) continue;
    for (let i = 0; i < 24; i += 2) {
      const t = SOLAR_TERMS[y][i];
      if (t <= utcMin && (!best || t > best.t)) best = { t, y, i };
    }
  }
  return best;
}
function nextJie(utcMin) {
  const approxYear = 1900 + Math.floor(utcMin / 525949);
  let best = null;
  for (let y = approxYear - 1; y <= approxYear + 1; y++) {
    if (!(y in SOLAR_TERMS)) continue;
    for (let i = 0; i < 24; i += 2) {
      const t = SOLAR_TERMS[y][i];
      if (t > utcMin && (!best || t < best.t)) best = { t, y, i };
    }
  }
  return best;
}

// ---------- 십성 ----------
function tenGod(dayStem, otherStem) {
  const de = STEM_ELEM[dayStem], oe = STEM_ELEM[otherStem];
  const same = (dayStem % 2) === (otherStem % 2);
  if (de === oe)            return same ? '비견' : '겁재';
  if ((de + 1) % 5 === oe)  return same ? '식신' : '상관';
  if ((oe + 1) % 5 === de)  return same ? '편인' : '정인';
  if ((de + 2) % 5 === oe)  return same ? '편재' : '정재';
  return same ? '편관' : '정관';
}

// ---------- 메인: 사주 계산 ----------
/*
 input = {
   year, month, day,            // 출생 '민간 시계' 날짜
   hour, minute,                // 시각 (모르면 hour: null)
   calendar: 'solar'|'lunar',   // 입력이 음력이면 'lunar'
   leapMonth: false,            // 음력 윤달 여부
   gender: 'M'|'F',
   longitude: 126.9784,         // 출생지 경도 (기본 서울)
   useEoT: true,                // 균시차 적용
   yajasi: false,               // 야자시 적용 여부
 }
*/
function computeSaju(input) {
  let { year: y, month: mo, day: d } = input;
  const hh = (input.hour === null || input.hour === undefined) ? 12 : input.hour;
  const mi = input.minute || 0;
  const hourUnknown = (input.hour === null || input.hour === undefined);
  const lon = input.longitude || SEOUL_LON;
  const useEoT = input.useEoT !== false;

  // 음력 입력 → 양력 변환
  let lunarInput = null;
  if (input.calendar === 'lunar') {
    const s = lunar2solar(y, mo, d, !!input.leapMonth);
    if (!s) return { error: '음력 날짜 변환 실패 — 날짜를 확인해 주세요.' };
    lunarInput = { year: y, month: mo, day: d, leap: !!input.leapMonth };
    y = s.year; mo = s.month; d = s.day;
  }
  if (y < 1901 || y > 2049) return { error: '지원 범위는 1901~2049년입니다.' };

  const utcMin = localToUtcMin(y, mo, d, hh, mi);
  const solarMin = apparentSolarMin(utcMin, lon, useEoT);
  const solarCorrection = solarMin - (utcMin + utcOffsetAt(utcMin));   // 민간시 대비 보정분

  // ----- 일주 (진태양시 자시 경계: 23:00에 날 바뀜) -----
  const solarDay23 = Math.floor((solarMin + 60) / 1440);   // 자시 기준 일 번호
  const solarDay00 = Math.floor(solarMin / 1440);          // 자정 기준 일 번호
  const dayNo = input.yajasi ? solarDay00 : solarDay23;
  const dayIdx = ((dayNo + EPOCH_ANCHOR_DAY_PILLAR) % 60 + 60) % 60;
  const dayStem = dayIdx % 10, dayBranch = dayIdx % 12;

  // ----- 년주 (입춘 절입 시각 기준) -----
  const ipchunThis = SOLAR_TERMS[y][2];
  const sajuYear = utcMin >= ipchunThis ? y : y - 1;
  const yearIdx = ((sajuYear - 1864) % 60 + 60) % 60;      // 1864 = 갑자년
  const yearStem = yearIdx % 10, yearBranch = yearIdx % 12;

  // ----- 월주 (직전 '절' 기준) -----
  const jie = lastJie(utcMin);
  const n = ((jie.i - 2) / 2 + 12) % 12;                   // 입춘 후 몇 번째 절인가 (0=인월)
  const monthBranch = (2 + n) % 12;
  const monthStem = ((yearStem % 5) * 2 + 2 + n) % 10;     // 오호둔

  // ----- 시주 (진태양시, 오서둔) -----
  let hourStem = null, hourBranch = null;
  if (!hourUnknown) {
    const tod = ((solarMin % 1440) + 1440) % 1440;
    hourBranch = Math.floor(((tod + 60) % 1440) / 120);
    const stemDayNo = solarDay23;                          // 시간(干)은 항상 자시 기준 일간을 따름
    const stemDayIdx = ((stemDayNo + EPOCH_ANCHOR_DAY_PILLAR) % 60 + 60) % 60;
    hourStem = ((stemDayIdx % 10) % 5) * 2 + hourBranch;
    hourStem = hourStem % 10;
  }

  // ----- 절입 경계 경고 -----
  const nj = nextJie(utcMin);
  const distPrev = utcMin - jie.t, distNext = nj ? nj.t - utcMin : 1e9;
  let boundaryWarn = null;
  if (Math.min(distPrev, distNext) <= 120) {
    const which = distPrev <= distNext ? TERM_NAMES[jie.i] : TERM_NAMES[nj.i];
    boundaryWarn = `절입(${which}) 경계 ±2시간 이내 출생 — 출생 시각의 정확성이 매우 중요합니다.`;
  }

  // ----- 오행 분포 (천간 1.0 / 지지 정기 1.0 / 지장간 여기·중기 0.3) -----
  const elemScore = [0,0,0,0,0];
  const pillars = [
    { name:'년주', stem: yearStem,  branch: yearBranch },
    { name:'월주', stem: monthStem, branch: monthBranch },
    { name:'일주', stem: dayStem,   branch: dayBranch },
  ];
  if (!hourUnknown) pillars.push({ name:'시주', stem: hourStem, branch: hourBranch });

  for (const p of pillars) {
    elemScore[STEM_ELEM[p.stem]] += 1.0;
    const hid = HIDDEN[p.branch];
    hid.forEach((s, i) => {
      elemScore[STEM_ELEM[s]] += (i === hid.length - 1) ? 1.0 : 0.3;
    });
  }
  const total = elemScore.reduce((a,b)=>a+b,0);
  const elements = ELEM.map((e,i)=>({
    name: e, hanja: ELEM_H[i],
    score: +elemScore[i].toFixed(1),
    pct: Math.round(elemScore[i] / total * 100),
  }));

  // ----- 십성 -----
  const decorate = p => ({
    ...p,
    stemName: STEMS[p.stem], stemHanja: STEMS_H[p.stem],
    branchName: BRANCH[p.branch], branchHanja: BRANCH_H[p.branch],
    ganji: STEMS[p.stem] + BRANCH[p.branch],
    ganjiHanja: STEMS_H[p.stem] + BRANCH_H[p.branch],
    stemElem: ELEM[STEM_ELEM[p.stem]],
    branchElem: ELEM[BRANCH_ELEM[p.branch]],
    stemGod: (p.name === '일주') ? '일간(나)' : tenGod(dayStem, p.stem),
    branchGod: tenGod(dayStem, HIDDEN[p.branch][HIDDEN[p.branch].length-1]),
    hidden: HIDDEN[p.branch].map(s => STEMS[s]),
  });
  const P = pillars.map(decorate);

  // ----- 대운 -----
  let daewoon = null;
  if (input.gender) {
    const yangYear = yearStem % 2 === 0;
    const forward = (yangYear && input.gender === 'M') || (!yangYear && input.gender === 'F');
    const gapMin = forward ? (nj.t - utcMin) : (utcMin - jie.t);
    const num = Math.max(1, Math.round(gapMin / 1440 / 3));   // 3일 = 1년
    const list = [];
    const mIdx = ((monthStem * 6 - monthBranch * 5) % 60 + 60) % 60;  // 월주 60갑자 인덱스 (i≡간 mod10, i≡지 mod12)
    for (let k = 1; k <= 8; k++) {
      const gi = ((mIdx + (forward ? k : -k)) % 60 + 60) % 60;
      list.push({
        age: num + (k - 1) * 10,
        ganji: STEMS[gi % 10] + BRANCH[gi % 12],
        ganjiHanja: STEMS_H[gi % 10] + BRANCH_H[gi % 12],
      });
    }
    daewoon = { forward, startAge: num, list };
  }

  // ----- 음력 병기 -----
  const lunar = lunarInput || solar2lunar(y, mo, d);

  return {
    input: { ...input, solarYear: y, solarMonth: mo, solarDay: d, hourUnknown },
    pillars: P,
    dayMaster: { stem: STEMS[dayStem], hanja: STEMS_H[dayStem], elem: ELEM[STEM_ELEM[dayStem]],
                 yinyang: dayStem % 2 === 0 ? '양' : '음' },
    zodiac: ZODIAC[yearBranch] + '띠',
    elements,
    daewoon,
    lunar,
    meta: {
      solarCorrectionMin: Math.round(solarCorrection),
      utcOffsetMin: utcOffsetAt(utcMin),
      boundaryWarn,
      sajuYear,
      note: '년주=입춘 절입시각 기준 · 월주=절(節) 기준 · 시주=진태양시(경도' +
            (useEoT ? '+균시차' : '') + ' 보정) 기준',
    },
  };
}

// Node 테스트용 내보내기 (브라우저에선 무시됨)
if (typeof module !== 'undefined') {
  module.exports = { computeSaju, solar2lunar, lunar2solar, jdn, localToUtcMin,
                     STEMS, BRANCH, tenGod };
}
