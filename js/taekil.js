/* ============================================================
   이사택일(移徙擇日) 엔진  taekil.js
   - 손없는 날(음력) · 황도길일(黃道) · 삼살방·대장군방 · 띠충 회피
   - 대상 연·월을 주면 그 달의 이사 길일을 가려 준다
   - 계산은 만세력(computeSaju)로 각 날의 일진·월지·음력일을 얻음
   - 전역: window.taekilScan(year, month, myYearBranch), window.taekilYearInfo(year)
   * 전통 택일법의 참고 자료이며, 실제 이사는 형편에 맞게 정하시면 됩니다.
   ============================================================ */
(function (global) {
'use strict';

const BRANCH = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
const BRANCH_H = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const ZODIAC = ['쥐','소','호랑이','토끼','용','뱀','말','양','원숭이','닭','개','돼지'];

const yearBranchOf = y => ((y - 4) % 12 + 12) % 12;

// 삼살방(三殺方) — 이사 해의 지지 기준, 피할 방위
function samsalDir(yb) {
  if ([8,0,4].includes(yb)) return '남';   // 申子辰
  if ([2,6,10].includes(yb)) return '북';  // 寅午戌
  if ([5,9,1].includes(yb)) return '동';   // 巳酉丑
  return '서';                              // 亥卯未
}
// 대장군방(大將軍方) — 이사 해의 지지 기준
function daejanggunDir(yb) {
  if ([11,0,1].includes(yb)) return '서';  // 亥子丑
  if ([2,3,4].includes(yb)) return '북';   // 寅卯辰
  if ([5,6,7].includes(yb)) return '동';   // 巳午未
  return '남';                             // 申酉戌
}

// 손없는 날: 음력 끝자리 9,0 (9·10·19·20·29·30)
const isSonEobs = lunarDay => [9,10,19,20,29,30].includes(lunarDay);
// 손 있는 방위(음력 끝자리) — 그 방위로 이사·수리 피함
function sonDir(lunarDay) {
  const t = lunarDay % 10;
  if (t === 1 || t === 2) return '동';
  if (t === 3 || t === 4) return '남';
  if (t === 5 || t === 6) return '서';
  if (t === 7 || t === 8) return '북';
  return '';  // 9,0 = 손 없음
}

// 황도(黃道) 12신 — 월지 기준 일지로 판정
const SHIN = ['청룡','명당','천형','주작','금궤','천덕','백호','옥당','천뢰','현무','사명','구진'];
const HWANGDO_OFFSETS = [0,1,4,5,7,10];  // 청룡·명당·금궤·천덕·옥당·사명 = 황도(길)
const HWANGDO_START = { 2:0,8:0, 3:2,9:2, 4:4,10:4, 5:6,11:6, 0:8,6:8, 1:10,7:10 };
function hwangdo(monthBranch, dayBranch) {
  const start = HWANGDO_START[monthBranch];
  const off = ((dayBranch - start) % 12 + 12) % 12;
  return { shin: SHIN[off], good: HWANGDO_OFFSETS.includes(off) };
}

const daysInMonth = (y, m) => new Date(y, m, 0).getDate();  // m: 1~12

function taekilYearInfo(year) {
  const yb = yearBranchOf(year);
  return {
    year, yearGanjiBranch: BRANCH[yb],
    samsal: samsalDir(yb), daejanggun: daejanggunDir(yb),
    note: `${year}년(${BRANCH_H[yb]}년)에는 <b>${samsalDir(yb)}쪽(삼살방)</b>과 <b>${daejanggunDir(yb)}쪽(대장군방)</b>으로의 이사·큰 공사를 피하는 것이 전통입니다.`,
  };
}

/**
 * 대상 연·월의 이사 길일 스캔
 * myYearBranch: 본인 띠의 지지 인덱스(0~11). 없으면 띠충 판정 생략.
 */
function taekilScan(year, month, myYearBranch) {
  if (typeof computeSaju !== 'function') return { error: '만세력 엔진이 필요합니다.' };
  if (year < 1901 || year > 2049) return { error: '1901~2049년만 지원합니다.' };
  const N = daysInMonth(year, month);
  const days = [];
  for (let d = 1; d <= N; d++) {
    const s = computeSaju({ year, month, day: d, hour: null, minute: 0, calendar: 'solar' });
    if (s.error) continue;
    const ilju = s.pillars.find(p => p.name === '일주');
    const wolju = s.pillars.find(p => p.name === '월주');
    if (!ilju || !wolju) continue;
    const ilji = ilju.branch, wolji = wolju.branch, lday = s.lunar ? s.lunar.day : null;
    const hd = hwangdo(wolji, ilji);
    const son = lday != null ? isSonEobs(lday) : false;
    const chung = (myYearBranch != null) && (((ilji - myYearBranch) % 12 + 12) % 12 === 6);  // 지지충
    // 등급
    let grade, mark;
    if (chung) { grade = '피함'; mark = '×'; }
    else if (son && hd.good) { grade = '최길'; mark = '★★★'; }
    else if (son || hd.good) { grade = '길'; mark = '★★'; }
    else if (!hd.good) { grade = '보통'; mark = '·'; }
    else { grade = '보통'; mark = '·'; }
    days.push({
      day: d, weekday: ['일','월','화','수','목','금','토'][new Date(year, month-1, d).getDay()],
      lunar: lday, ilji: BRANCH[ilji] + '일', iljiZodiac: ZODIAC[ilji],
      shin: hd.shin, hwangdo: hd.good, sonEobs: son, sonDir: lday!=null?sonDir(lday):'',
      chung, grade, mark,
    });
  }
  const rank = { '최길':0, '길':1, '보통':2, '피함':3 };
  const picks = days.filter(x => x.grade === '최길' || x.grade === '길')
                    .sort((a,b) => rank[a.grade]-rank[b.grade] || a.day-b.day)
                    .slice(0, 8);
  return { year, month, yearInfo: taekilYearInfo(year), days, picks };
}

global.taekilScan = taekilScan;
global.taekilYearInfo = taekilYearInfo;
global.taekilYearBranchOf = yearBranchOf;

})(window);
