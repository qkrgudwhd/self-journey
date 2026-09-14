/* ============================================================
   퍼스널 컬러(My Color) 자가진단 엔진
   - 3축 채점: 톤(웜/쿨) · 명도(라이트/딥) · 채도(브라이트/뮤트)
   - 판정: 4계절 → 8타입 (봄라이트·봄브라이트·여름라이트·여름뮤트
                         ·가을뮤트·가을딥·겨울브라이트·겨울딥)
   - 각 타입: 베스트 10색 + 워스트 4색 (HEX)
   - 오행 보완색: 사주 오행과 교차 분석용 (리포트에서 사용)
   ============================================================ */

// 문항: axis = t(톤) | b(명도) | s(채도), 각 선택지에 점수
// 톤: +웜 / −쿨,  명도: +라이트 / −딥,  채도: +브라이트 / −뮤트
// sw: 선택지 색 견본(실제 색으로 고르기), demo: 문항 아래 보여주는 견본 팔레트, grid: 색칩 그리드 배치
const COLOR_QUESTIONS = [
  { axis:'t', grid:true, t:'손목 안쪽의 혈관 색을 실제로 확인해 보세요. 어느 색에 가장 가깝습니까?',
    opts:[
      {label:'올리브빛 초록', v:+2, sw:['#6B8E5A']},
      {label:'청록빛',       v:+1, sw:['#4E8D7C']},
      {label:'초록·파랑 반반', v:0,  sw:['#5E7D8C']},
      {label:'파란빛',       v:-2, sw:['#4A6FA5']},
      {label:'보랏빛',       v:-2, sw:['#6D5A9E']},
    ] },
  { axis:'t', t:'골드와 실버 액세서리 중 어느 쪽이 얼굴을 살려 줍니까?',
    opts:[
      {label:'골드가 잘 어울립니다', v:+2, sw:['#F5D67B','#D4A937','#B8860B']},
      {label:'실버가 잘 어울립니다', v:-2, sw:['#F2F2F5','#BFC3CC','#8E939E']},
      {label:'둘 다 비슷합니다',     v:0,  sw:['#D4A937','#BFC3CC']},
    ] },
  { axis:'t', t:'두 가지 흰색 중 얼굴을 더 화사하게 하는 쪽은 어느 것입니까?',
    opts:[
      {label:'아이보리(크림빛 흰색)', v:+2, sw:['#FFF8E7','#F7EED3']},
      {label:'순백색(푸른빛 흰색)',   v:-2, sw:['#FFFFFF','#F4F7FB']},
      {label:'차이를 못 느낍니다',    v:0 },
    ] },
  { axis:'t', t:'햇볕에 오래 있으면 피부는 어느 쪽에 가까워집니까?',
    opts:[
      {label:'황갈색으로 그을립니다',        v:+2, sw:['#C68B59','#A9713F']},
      {label:'붉어졌다가 금방 돌아옵니다',   v:-2, sw:['#E8A29A','#D97B6C']},
      {label:'중간쯤입니다',                v:0 },
    ] },
  { axis:'t', grid:true, t:'립 컬러를 직접 골라 보세요. 가장 자연스럽게 어울리는 색은?',
    opts:[
      {label:'코랄',       v:+2, sw:['#FF7F50']},
      {label:'피치',       v:+1, sw:['#FFA07A']},
      {label:'오렌지레드', v:+2, sw:['#FF5A36']},
      {label:'잘 모르겠음', v:0,  sw:['#C08081']},
      {label:'로즈핑크',   v:-2, sw:['#E75480']},
      {label:'푸시아',     v:-1, sw:['#D93B8B']},
      {label:'베리·와인',  v:-2, sw:['#8E3A59']},
    ] },
  { axis:'t', grid:true, t:'자연 상태의 머리카락 색을 골라 보세요.',
    opts:[
      {label:'밝은 갈색',   v:+1, sw:['#8B5A2B']},
      {label:'짙은 갈색',   v:+1, sw:['#5C4033']},
      {label:'중간',        v:0,  sw:['#40342B']},
      {label:'잿빛 검정',   v:-1, sw:['#3A3A40']},
      {label:'새까만 검정', v:-1, sw:['#141416']},
    ] },

  { axis:'b', t:'이런 밝은 파스텔 옷을 입으면 얼굴이 어떻게 됩니까?',
    demo:['#FFD9E8','#D6EBFF','#FFF6C9','#DFF5D8','#EADCF9'],
    opts:[ {label:'얼굴이 환해 보입니다', v:+2}, {label:'들떠 보이거나 밋밋해집니다', v:-2}, {label:'그저 그렇습니다', v:0} ] },
  { axis:'b', t:'검정 옷을 입으면 얼굴이 어떻게 보입니까?',
    demo:['#0A0A0C'],
    opts:[ {label:'또렷하고 세련되어 보입니다', v:-2}, {label:'칙칙하고 피곤해 보입니다', v:+2}, {label:'별 차이 없습니다', v:0} ] },
  { axis:'b', t:'전체적인 인상은 어느 쪽입니까?',
    opts:[ {label:'맑고 부드러운 인상이라는 말을 듣습니다', v:+1}, {label:'또렷하고 깊은 인상이라는 말을 듣습니다', v:-1}, {label:'반반입니다', v:0} ] },

  { axis:'s', t:'이런 쨍하고 선명한 원색을 입으면 어떻습니까?',
    demo:['#FF0033','#0047AB','#00A86B','#FFD700','#FF00AA'],
    opts:[ {label:'생기 있어 보입니다', v:+2}, {label:'색만 붕 떠 보입니다', v:-2}, {label:'모르겠습니다', v:0} ] },
  { axis:'s', t:'이런 안개 낀 듯 부드러운(뮤트) 색을 입으면 어떻습니까?',
    demo:['#B4A7B0','#9FB4C7','#C4B49F','#8FA3AD','#A99A8F'],
    opts:[ {label:'우아하게 어울립니다', v:-2}, {label:'왠지 아파 보입니다', v:+2}, {label:'모르겠습니다', v:0} ] },
  { axis:'s', t:'화장이나 스타일링은 어느 쪽이 더 어울립니까?',
    opts:[ {label:'또렷한 포인트를 준 스타일', v:+1}, {label:'번지듯 자연스러운 스타일', v:-1}, {label:'둘 다 무난합니다', v:0} ] },
];

const COLOR_TYPES = {
  '봄 라이트':   { season:'봄', tone:'웜', emoji:'🌸',
    desc:'맑은 봄볕 같은 분입니다. 밝고 투명한 웜톤이 생기를 살려 줍니다.',
    best:['#FFB7A1','#FFD1A6','#FFF3B0','#C9E4A5','#A8E6CF','#FFDAB9','#F4C2C2','#BDE0FE','#FFE5B4','#E6F5C9'],
    worst:['#000000','#4A235A','#5D6D7E','#7B241C'] },
  '봄 브라이트': { season:'봄', tone:'웜', emoji:'🌷',
    desc:'생동감 넘치는 분입니다. 선명하고 따뜻한 원색이 매력을 끌어올립니다.',
    best:['#FF6F3C','#FFC300','#2ECC71','#00CED1','#FF4D6D','#FFA07A','#7FFF00','#FF8C00','#40E0D0','#FFD700'],
    worst:['#808B96','#6E2C00','#AAB7B8','#2C3E50'] },
  '여름 라이트': { season:'여름', tone:'쿨', emoji:'🩵',
    desc:'초여름 아침 안개 같은 분입니다. 밝고 시원한 파스텔이 얼굴을 맑게 틔워 줍니다.',
    best:['#F8BBD9','#C8A2C8','#AEC6CF','#B2F2E5','#FADADD','#D7BDE2','#A9CCE3','#F5CBA7','#D5F5E3','#EBDEF0'],
    worst:['#E67E22','#7B241C','#145A32','#6E2C00'] },
  '여름 뮤트':   { season:'여름', tone:'쿨', emoji:'🌫',
    desc:'차분한 우아함을 지닌 분입니다. 안개를 머금은 듯 부드러운 색이 품격을 살립니다.',
    best:['#C4A69F','#A0A5B9','#9FB4C7','#BFA6A0','#AAB7B8','#B5A8C9','#8FA3AD','#C9B8C4','#95A5A6','#B4C7DC'],
    worst:['#FF5733','#FFC300','#28B463','#FF4D6D'] },
  '가을 뮤트':   { season:'가을', tone:'웜', emoji:'🍂',
    desc:'가을 들녘의 온기를 지닌 분입니다. 흙과 나무의 낮은 채도가 깊이를 더합니다.',
    best:['#C19A6B','#8A9A5B','#B7745C','#A67B5B','#9C7C38','#8B7D6B','#C08552','#7D8471','#B49A67','#A0785A'],
    worst:['#FF69B4','#00BFFF','#FFFFFF','#9B59B6'] },
  '가을 딥':     { season:'가을', tone:'웜', emoji:'🌰',
    desc:'깊은 숲 같은 분입니다. 무르익은 진한 웜톤이 관록과 신뢰를 입혀 줍니다.',
    best:['#6B3226','#7D6608','#4A5D23','#8B4513','#800000','#5C4033','#B8860B','#556B2F','#8B0000','#654321'],
    worst:['#F8BBD9','#AEC6CF','#FFF3B0','#B2F2E5'] },
  '겨울 브라이트':{ season:'겨울', tone:'쿨', emoji:'❄️',
    desc:'첫눈 오는 밤의 네온처럼 강렬한 분입니다. 선명한 쿨톤 원색이 카리스마를 살립니다.',
    best:['#E91E63','#1F51FF','#00A86B','#FF0033','#FFF700','#8A2BE2','#00FFFF','#FF00FF','#0047AB','#FFFFFF'],
    worst:['#C19A6B','#BFA6A0','#8B7D6B','#F5CBA7'] },
  '겨울 딥':     { season:'겨울', tone:'쿨', emoji:'🌌',
    desc:'깊은 겨울밤 같은 분입니다. 짙고 무게 있는 색이 존재감을 완성합니다.',
    best:['#000000','#191970','#4B0082','#800020','#2F4F4F','#36454F','#0B3D91','#3B0A45','#013220','#1C1C1C'],
    worst:['#FFDAB9','#FFF3B0','#C9E4A5','#F5CBA7'] },
};

// 오행 → 전통 오방색 + 현대 보완색 (사주 교차 분석용)
const OHAENG_COLORS = {
  목: { hanja:'木', classic:'청(靑)', hex:'#2E7D32', modern:['초록','연두','청록'], boost:'성장·시작의 기운' },
  화: { hanja:'火', classic:'적(赤)', hex:'#C62828', modern:['빨강','주황','분홍'], boost:'열정·표현의 기운' },
  토: { hanja:'土', classic:'황(黃)', hex:'#F9A825', modern:['노랑','베이지','갈색'], boost:'안정·중심의 기운' },
  금: { hanja:'金', classic:'백(白)', hex:'#ECEFF1', modern:['흰색','아이보리','메탈릭'], boost:'결단·정리의 기운' },
  수: { hanja:'水', classic:'흑(黑)', hex:'#263238', modern:['검정','남색','짙은 회색'], boost:'지혜·유연함의 기운' },
};

/**
 * answers: 문항별 선택지 인덱스 배열 (길이 12)
 * 반환: { type, season, tone, axes, best, worst, confidence, neutralNote }
 */
function scorePersonalColor(answers) {
  if (!Array.isArray(answers) || answers.length !== COLOR_QUESTIONS.length)
    return { error: `응답 ${COLOR_QUESTIONS.length}개가 필요합니다.` };

  const sums = { t: 0, b: 0, s: 0 };
  const maxes = { t: 0, b: 0, s: 0 };
  for (let i = 0; i < COLOR_QUESTIONS.length; i++) {
    const q = COLOR_QUESTIONS[i];
    const opt = q.opts[answers[i]];
    if (!opt) return { error: `${i + 1}번 응답이 올바르지 않습니다.` };
    sums[q.axis] += opt.v;
    maxes[q.axis] += Math.max(...q.opts.map(o => Math.abs(o.v)));
  }

  const warm = sums.t > 0;                        // 0이면 쿨 쪽(한국인 통계상 다수)
  const light = sums.b >= 0;
  const vivid = sums.s >= 0;

  // 4계절: 웜×라이트=봄, 웜×딥=가을, 쿨×라이트=여름, 쿨×딥=겨울
  // 8타입 세부: 채도로 갈라짐 (계절별 관례 조합)
  let type;
  if (warm && light)  type = vivid ? '봄 브라이트' : '봄 라이트';
  else if (warm)      type = vivid ? '가을 딥'     : '가을 뮤트';
  else if (light)     type = vivid ? '여름 라이트' : '여름 뮤트';
  else                type = vivid ? '겨울 브라이트' : '겨울 딥';

  const info = COLOR_TYPES[type];
  const toneConf = maxes.t ? Math.round(Math.abs(sums.t) / maxes.t * 100) : 0;

  return {
    type, ...info,
    axes: {
      tone:  { value: warm ? '웜' : '쿨', score: sums.t, confidence: toneConf },
      brightness: { value: light ? '라이트' : '딥', score: sums.b },
      saturation: { value: vivid ? '브라이트' : '뮤트', score: sums.s },
    },
    neutralNote: toneConf <= 25
      ? '웜·쿨 어느 한쪽으로 치우치지 않은 뉴트럴에 가깝습니다. 두 계절의 색을 오가며 쓰셔도 좋습니다.'
      : null,
  };
}

// 사주 오행 분포에서 가장 약한 오행의 보완색 제안 (리포트 교차 분석)
function ohaengBoostColor(elements) {
  // elements: computeSaju().elements — [{name, pct}...]
  const weakest = [...elements].sort((a, b) => a.pct - b.pct)[0];
  const strongest = [...elements].sort((a, b) => b.pct - a.pct)[0];
  const c = OHAENG_COLORS[weakest.name];
  return {
    weakest: weakest.name, weakestPct: weakest.pct,
    strongest: strongest.name, strongestPct: strongest.pct,
    color: c,
    advice: `사주에서 ${weakest.name}(${c.hanja}) 기운이 ${weakest.pct}%로 가장 약합니다. ` +
            `${c.modern.join('·')} 계열(전통 오방색 ${c.classic})을 소품이나 포인트로 곁에 두시면 ${c.boost}을 보완할 수 있습니다.`,
  };
}

if (typeof module !== 'undefined')
  module.exports = { COLOR_QUESTIONS, COLOR_TYPES, OHAENG_COLORS, scorePersonalColor, ohaengBoostColor };
