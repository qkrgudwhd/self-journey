/* ============================================================
   서양의 세 상징 — 수비학 · 타로 탄생 카드 · 탄생석/탄생화
   - 전부 생년월일(양력)만으로 계산, 추가 입력 없음
   - 수비학: 생애 경로수(년·월·일 각각 축약 후 합산 — 마스터수 11/22/33 보존)
             + 생일수(태어난 날)
   - 타로: 생년월일 전체 자릿수 합 → 1~21 카드, 22는 0 바보(The Fool)
   - 탄생석·탄생화: 월별 12종 (보석 색 HEX 포함)
   ============================================================ */

// ---------- 수비학 ----------
const MASTER = [11, 22, 33];

function digitSum(n) {
  let s = 0;
  for (const c of String(n)) s += +c;
  return s;
}
// 마스터수를 보존하며 한 자리로 축약
function reduceNum(n, keepMaster = true) {
  while (n > 9 && !(keepMaster && MASTER.includes(n))) n = digitSum(n);
  return n;
}

// 생애 경로수: 년·월·일을 각각 축약한 뒤 합산 (정통 계산법)
function lifePathNumber(y, m, d) {
  const parts = [reduceNum(digitSum(y)), reduceNum(m), reduceNum(digitSum(d))];
  return { num: reduceNum(parts.reduce((a, b) => a + b, 0)), parts };
}

const LIFE_PATH_DESC = {
  1:  { key:'개척자',   text:'스스로 길을 내는 수입니다. 남의 지도를 따라가기보다 첫 발자국을 찍을 때 살아나며, 독립과 리더십이 평생의 화두입니다.' },
  2:  { key:'중재자',   text:'둘 사이의 다리가 되는 수입니다. 경청과 조율의 재능으로 관계 속에서 힘을 발휘하며, 협력할 때 혼자보다 몇 배로 커집니다.' },
  3:  { key:'표현자',   text:'말과 글, 예술로 세상과 통하는 수입니다. 창조적 에너지가 넘치며, 표현할 통로를 가진 만큼 인생이 밝아집니다.' },
  4:  { key:'건축가',   text:'돌 위에 돌을 쌓는 수입니다. 성실과 체계로 오래가는 것을 지으며, 신뢰라는 자산이 평생 이자를 붙여 돌아옵니다.' },
  5:  { key:'자유인',   text:'변화가 곧 산소인 수입니다. 여행·모험·새로움 속에서 배우며, 묶어두려는 순간 시들고 풀어주는 순간 만개합니다.' },
  6:  { key:'수호자',   text:'품고 돌보는 수입니다. 가정과 공동체에 대한 책임을 기꺼이 지며, 사랑을 주고받는 균형이 인생의 열쇠입니다.' },
  7:  { key:'구도자',   text:'표면 아래의 진실을 파는 수입니다. 혼자만의 탐구 시간에서 지혜가 자라며, 깊이가 곧 이 수의 매력입니다.' },
  8:  { key:'성취자',   text:'현실의 산을 오르는 수입니다. 물질과 권한을 다루는 그릇을 타고났으며, 힘을 어디에 쓰는가가 평생의 시험입니다.' },
  9:  { key:'대양(大洋)', text:'모든 강을 받아들이는 수입니다. 공감과 이상이 크고, 베푼 것이 돌아오는 순환 속에 사는 완성의 수입니다.' },
  11: { key:'직관의 등대', text:'마스터수 11 — 예민한 직관과 영감의 수입니다. 남들이 못 보는 것을 먼저 느끼며, 그 빛으로 사람들을 비추는 소명이 있습니다.' },
  22: { key:'마스터 건축가', text:'마스터수 22 — 꿈을 현실의 구조물로 세우는 가장 강력한 수입니다. 이상과 실행력을 함께 지녀, 크게 그리고 크게 짓습니다.' },
  33: { key:'마스터 교사', text:'마스터수 33 — 조건 없는 사랑과 가르침의 수입니다. 존재 자체로 사람을 치유하고 성장시키는 드문 소명의 수입니다.' },
};

const BIRTHDAY_DESC = {
  1:'시작에 강한 사람', 2:'함께일 때 빛나는 사람', 3:'유쾌함이 무기인 사람',
  4:'꾸준함이 재능인 사람', 5:'변화를 타는 사람', 6:'돌봄이 체질인 사람',
  7:'깊이 파는 사람', 8:'판을 키우는 사람', 9:'품이 넓은 사람',
};

function computeNumerology(y, m, d) {
  const lp = lifePathNumber(y, m, d);
  const bd = reduceNum(d, false);
  return {
    lifePath: lp.num, lifePathParts: lp.parts,
    lifePathInfo: LIFE_PATH_DESC[lp.num],
    birthday: bd, birthdayInfo: BIRTHDAY_DESC[bd],
  };
}

// ---------- 타로 탄생 카드 ----------
const TAROT_MAJOR = [
  { n:0,  name:'바보',        en:'The Fool',            line:'계산 없이 절벽 끝에서 첫걸음을 떼는 순수한 모험의 카드 — 시작할 용기가 곧 재능입니다.' },
  { n:1,  name:'마법사',      en:'The Magician',        line:'가진 도구로 무엇이든 만들어내는 창조의 카드 — 의지가 곧 마법입니다.' },
  { n:2,  name:'여사제',      en:'The High Priestess',  line:'말하지 않아도 아는 직관의 카드 — 침묵 속에서 답을 듣는 사람입니다.' },
  { n:3,  name:'여황제',      en:'The Empress',         line:'풍요와 돌봄의 카드 — 곁에 있는 것들을 자라게 하는 손을 지녔습니다.' },
  { n:4,  name:'황제',        en:'The Emperor',         line:'질서를 세우고 지키는 카드 — 흔들리는 곳에 기둥을 박는 사람입니다.' },
  { n:5,  name:'교황',        en:'The Hierophant',      line:'지혜를 전하는 카드 — 배운 것을 나눌 때 가장 빛납니다.' },
  { n:6,  name:'연인',        en:'The Lovers',          line:'선택과 사랑의 카드 — 마음이 가리키는 쪽을 고르는 용기가 인생을 만듭니다.' },
  { n:7,  name:'전차',        en:'The Chariot',         line:'상반된 힘을 한 방향으로 모는 카드 — 의지로 승리를 끌어내는 사람입니다.' },
  { n:8,  name:'힘',          en:'Strength',            line:'사자의 입을 맨손으로 다루는 카드 — 부드러움이 진짜 힘임을 아는 사람입니다.' },
  { n:9,  name:'은둔자',      en:'The Hermit',          line:'등불을 들고 홀로 걷는 카드 — 고독 속에서 길을 밝히는 지혜가 있습니다.' },
  { n:10, name:'운명의 수레바퀴', en:'Wheel of Fortune', line:'돌고 도는 운명의 카드 — 오르내림을 두려워하지 않는 큰 리듬의 사람입니다.' },
  { n:11, name:'정의',        en:'Justice',             line:'저울과 검의 카드 — 공정함이 이 사람의 중심축입니다.' },
  { n:12, name:'매달린 사람', en:'The Hanged Man',      line:'거꾸로 매달려 세상을 새로 보는 카드 — 멈춤과 관점 전환이 무기입니다.' },
  { n:13, name:'죽음',        en:'Death',               line:'끝이 아니라 탈피의 카드 — 낡은 것을 떠나보내고 거듭나는 힘이 있습니다.' },
  { n:14, name:'절제',        en:'Temperance',          line:'두 잔의 물을 섞는 카드 — 섞고 조율해 새로운 것을 빚는 연금술사입니다.' },
  { n:15, name:'악마',        en:'The Devil',           line:'욕망과 집착을 직시하는 카드 — 제 사슬을 아는 자만이 풀 수 있습니다.' },
  { n:16, name:'탑',          en:'The Tower',           line:'번개가 낡은 탑을 부수는 카드 — 무너짐 뒤에 진짜 기초를 놓는 사람입니다.' },
  { n:17, name:'별',          en:'The Star',            line:'어둠 속의 희망의 카드 — 존재만으로 누군가의 길잡이가 되는 사람입니다.' },
  { n:18, name:'달',          en:'The Moon',            line:'꿈과 무의식의 카드 — 보이지 않는 것을 느끼는 깊은 감수성이 있습니다.' },
  { n:19, name:'태양',        en:'The Sun',             line:'가장 밝은 축복의 카드 — 있는 그대로 빛나며 주변까지 환하게 만듭니다.' },
  { n:20, name:'심판',        en:'Judgement',           line:'나팔 소리에 깨어나는 카드 — 부름에 응답해 거듭나는 소명의 사람입니다.' },
  { n:21, name:'세계',        en:'The World',           line:'춤추며 원을 완성하는 카드 — 시작한 것을 끝내 완성하는 대성(大成)의 사람입니다.' },
];

function tarotBirthCard(y, m, d) {
  let n = digitSum(y) + digitSum(m) + digitSum(d);
  while (n > 22) n = digitSum(n);
  const idx = n === 22 ? 0 : n;          // 22 = 0 바보(The Fool) 관례
  return TAROT_MAJOR[idx];
}

// ---------- 탄생석 · 탄생화 ----------
const BIRTH_SYMBOLS = [
  { m:1,  stone:'가넷',       hex:'#7B1B2B', stoneMeaning:'변치 않는 우정과 신뢰',  flower:'카네이션',     flowerMeaning:'순수한 사랑' },
  { m:2,  stone:'자수정',     hex:'#7D4FA8', stoneMeaning:'평온과 성실',           flower:'제비꽃',       flowerMeaning:'겸손한 진심' },
  { m:3,  stone:'아쿠아마린', hex:'#7FD1DC', stoneMeaning:'젊음과 용기',           flower:'수선화',       flowerMeaning:'다시 피는 희망' },
  { m:4,  stone:'다이아몬드', hex:'#E8F1F5', stoneMeaning:'영원한 사랑',           flower:'데이지',       flowerMeaning:'숨겨진 순정' },
  { m:5,  stone:'에메랄드',   hex:'#1E8F5A', stoneMeaning:'행복과 재생',           flower:'은방울꽃',     flowerMeaning:'틀림없는 행복' },
  { m:6,  stone:'진주',       hex:'#F2E9DC', stoneMeaning:'순결과 건강',           flower:'장미',         flowerMeaning:'사랑의 절정' },
  { m:7,  stone:'루비',       hex:'#C1122F', stoneMeaning:'열정과 위엄',           flower:'참제비고깔',   flowerMeaning:'자유로운 마음' },
  { m:8,  stone:'페리도트',   hex:'#A6C34C', stoneMeaning:'부부의 화합과 지혜',    flower:'글라디올러스', flowerMeaning:'견고한 승리' },
  { m:9,  stone:'사파이어',   hex:'#1D3F8F', stoneMeaning:'진실과 성스러움',       flower:'과꽃',         flowerMeaning:'믿는 사랑' },
  { m:10, stone:'오팔',       hex:'#D9C8E8', stoneMeaning:'희망과 순수',           flower:'금잔화',       flowerMeaning:'반드시 오는 행복' },
  { m:11, stone:'토파즈',     hex:'#E8A33D', stoneMeaning:'우정과 건강',           flower:'국화',         flowerMeaning:'고결한 진실' },
  { m:12, stone:'터콰이즈',   hex:'#2FB5B0', stoneMeaning:'성공과 행운',           flower:'포인세티아',   flowerMeaning:'축복의 마음' },
];

function birthSymbols(month) {
  return BIRTH_SYMBOLS[month - 1];
}

if (typeof module !== 'undefined')
  module.exports = { computeNumerology, lifePathNumber, reduceNum, digitSum,
                     tarotBirthCard, birthSymbols,
                     LIFE_PATH_DESC, TAROT_MAJOR, BIRTH_SYMBOLS };
