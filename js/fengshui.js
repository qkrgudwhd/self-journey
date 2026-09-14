/* ============================================================
   풍수지리(개인) 엔진  fengshui.js
   - 본명성(구성 九星) → 괘 → 동사택/서사택
   - 팔택(八宅) 유년: 8방위 길흉(생기·천의·연년·복위 / 화해·육살·오귀·절명)
   - 침실·현관·책상·주방 방위 권고 + 사주 부족오행 보완
   - 전역: window.fengshuiReading(year, gender, elements?)
   * 방위 길흉은 전통 팔택명경(八宅明鏡)의 유년 배치를 따른 참고 자료입니다.
   ============================================================ */
(function (global) {
'use strict';

// 생년(입춘 기준 권장)의 각 자리 숫자를 한 자리로 축약
function reduce9(y) {
  let s = String(y).split('').reduce((a, c) => a + (+c || 0), 0);
  while (s > 9) s = String(s).split('').reduce((a, c) => a + (+c || 0), 0);
  return s; // 1~9
}

// 본명성(1~9) — 남녀 공식, 5(中宮)는 남=2(坤)·여=8(艮)
function bonmyeongStar(year, male) {
  const r = reduce9(year);
  let b = male ? (11 - r) : (r + 4);
  if (b > 9) b -= 9;
  if (b < 1) b += 9;
  if (b === 5) b = male ? 2 : 8;
  return b;
}

const STAR_NAME = { 1:'일백수성(一白水星)', 2:'이흑토성(二黑土星)', 3:'삼벽목성(三碧木星)',
  4:'사록목성(四綠木星)', 6:'육백금성(六白金星)', 7:'칠적금성(七赤金星)',
  8:'팔백토성(八白土星)', 9:'구자화성(九紫火星)' };
const STAR_GUA = { 1:'坎', 2:'坤', 3:'震', 4:'巽', 6:'乾', 7:'兌', 8:'艮', 9:'離' };
const GUA_NAME = { 坎:'감(坎)', 坤:'곤(坤)', 震:'진(震)', 巽:'손(巽)', 乾:'건(乾)', 兌:'태(兌)', 艮:'간(艮)', 離:'리(離)' };
const EAST_GUA = ['坎', '離', '震', '巽'];   // 동사택
// 동사택 = 북·남·동·남동 / 서사택 = 북동·남서·서·북서

// 팔택 유년표: 본괘 → {방위: 유년}  (방위 8: 북·북동·동·남동·남·남서·서·북서)
const YEONYUN = {
  坎: { 남동:'생기', 동:'천의', 남:'연년', 북:'복위', 서:'화해', 북서:'육살', 북동:'오귀', 남서:'절명' },
  離: { 동:'생기', 남동:'천의', 북:'연년', 남:'복위', 북서:'화해', 서:'육살', 남서:'오귀', 북동:'절명' },
  震: { 남:'생기', 북:'천의', 남동:'연년', 동:'복위', 남서:'화해', 북동:'육살', 북서:'오귀', 서:'절명' },
  巽: { 북:'생기', 남:'천의', 동:'연년', 남동:'복위', 북동:'화해', 남서:'육살', 서:'오귀', 북서:'절명' },
  乾: { 서:'생기', 북동:'천의', 남서:'연년', 북서:'복위', 남동:'화해', 북:'육살', 남:'오귀', 동:'절명' },
  坤: { 북동:'생기', 서:'천의', 북서:'연년', 남서:'복위', 북:'화해', 남동:'육살', 동:'오귀', 남:'절명' },
  艮: { 남서:'생기', 북서:'천의', 서:'연년', 북동:'복위', 남:'화해', 동:'육살', 남동:'오귀', 북:'절명' },
  兌: { 북서:'생기', 남서:'천의', 북동:'연년', 서:'복위', 동:'화해', 남:'육살', 북:'오귀', 남동:'절명' },
};
const DIRS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];

const YY_INFO = {
  생기: { grade:'대길', star:'탐랑목성', use:'현관·침실·공부방', text:'가장 좋은 방위입니다. 활력·발전·자녀·인기의 기운으로, 현관·안방·아이 공부방을 두면 크게 좋습니다.' },
  천의: { grade:'대길', star:'거문토성', use:'침실·주방', text:'건강과 재물의 방위입니다. 잠자리와 부엌을 두면 몸이 편안하고 재물이 모입니다.' },
  연년: { grade:'대길', star:'무곡금성', use:'침실·거실', text:'부부 화합과 인간관계·장수의 방위입니다. 안방이나 어른 자리로 좋습니다.' },
  복위: { grade:'소길', star:'보필', use:'서재·안정', text:'평온과 안정의 방위입니다. 크게 발전하진 않아도 무탈하니 서재·휴식 공간에 알맞습니다.' },
  화해: { grade:'소흉', star:'녹존토성', use:'창고·화장실', text:'구설과 다툼의 방위입니다. 잠자리·현관은 피하고 창고나 화장실로 눌러 두면 좋습니다.' },
  육살: { grade:'흉', star:'문곡수성', use:'화장실·주차', text:'손재와 관재의 방위입니다. 중요한 자리를 피하고 화장실·잡공간으로 두는 것이 무난합니다.' },
  오귀: { grade:'대흉', star:'염정화성', use:'화장실', text:'사고·질병·화재의 방위입니다. 침실·부엌은 절대 피하고, 화장실로 흉기를 눌러 두는 것이 상책입니다.' },
  절명: { grade:'대흉', star:'파군금성', use:'창고·화장실', text:'가장 피할 방위입니다. 큰 손실과 건강 악화의 기운이니, 잠자리·현관·부엌을 두지 마세요.' },
};

function fengshuiReading(year, gender, elements) {
  const male = gender === 'M';
  const star = bonmyeongStar(year, male);
  const gua = STAR_GUA[star];
  const east = EAST_GUA.includes(gua);
  const map = YEONYUN[gua];
  const directions = DIRS.map(d => {
    const yy = map[d];
    return { dir: d, yeonyun: yy, grade: YY_INFO[yy].grade, use: YY_INFO[yy].use, text: YY_INFO[yy].text, star: YY_INFO[yy].star };
  });
  const good = directions.filter(x => x.grade.indexOf('길') >= 0).sort((a,b)=> (a.grade==='대길'?0:1)-(b.grade==='대길'?0:1));
  const bad = directions.filter(x => x.grade.indexOf('흉') >= 0).sort((a,b)=> (b.grade==='대흉'?1:0)-(a.grade==='대흉'?1:0));

  const saengki = directions.find(x=>x.yeonyun==='생기').dir;
  const cheonui = directions.find(x=>x.yeonyun==='천의').dir;
  const yeonnyeon = directions.find(x=>x.yeonyun==='연년').dir;
  const jeolmyeong = directions.find(x=>x.yeonyun==='절명').dir;
  const ogwi = directions.find(x=>x.yeonyun==='오귀').dir;

  const advice = [
    `침대 머리와 안방은 <b>${cheonui}쪽(천의)</b> 또는 <b>${yeonnyeon}쪽(연년)</b>에 두면 건강과 부부운이 좋습니다.`,
    `현관·대문과 아이 공부방·책상은 <b>${saengki}쪽(생기)</b>이 가장 좋습니다.`,
    `화장실은 흉방인 <b>${jeolmyeong}쪽(절명)</b>이나 <b>${ogwi}쪽(오귀)</b>에 두어 나쁜 기운을 눌러 주세요.`,
    `잠잘 때 머리를 <b>${jeolmyeong}쪽(절명)</b>으로 두는 것은 피하세요.`,
  ];

  // 사주 부족오행 보완 (있으면)
  let elemAdvice = '';
  if (Array.isArray(elements) && elements.length) {
    const weak = [...elements].sort((a,b)=>a.pct-b.pct)[0];
    const COLOR = { 목:'초록·청색 계열과 나무·화분', 화:'빨강·분홍과 조명·촛불', 토:'노랑·황토색과 도자기·돌', 금:'흰색·금속색과 금속 소품', 수:'검정·남색과 물·유리·어항' };
    elemAdvice = `사주에 <b>${weak.name}(${weak.hanja})</b> 기운이 ${weak.pct}%로 가장 약하니, 공간에 <b>${COLOR[weak.name]}</b>을 더하면 부족한 기운을 채웁니다.`;
  }

  return {
    star, starName: STAR_NAME[star], gua, guaName: GUA_NAME[gua],
    house: east ? '동사택(東四宅)' : '서사택(西四宅)',
    houseNote: east ? '북·남·동·남동이 길한 동사택입니다. 집도 이 방위로 트인 곳이 잘 맞습니다.'
                    : '북동·남서·서·북서가 길한 서사택입니다. 집도 이 방위로 트인 곳이 잘 맞습니다.',
    directions, good, bad, advice, elemAdvice,
  };
}

global.fengshuiReading = fengshuiReading;
global.fengshuiStar = bonmyeongStar;

})(window);
