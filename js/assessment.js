/* ============================================================
   성향 검사 채점 엔진
   - 입력: answers[i] = 1~5 (QUESTIONS 순서대로)
   - 5점 척도: (응답-3) × 방향 → 축별 합산 (축 범위 ±46)
   - 선호 강도 % = 50 + (합계/46)×50, 동점이면 I/N/F/P (관례)
   ============================================================ */

const AXES = [
  { key:'EI', first:'E', second:'I', firstName:'외향', secondName:'내향', theme:'에너지의 방향' },
  { key:'SN', first:'S', second:'N', firstName:'감각', secondName:'직관', theme:'정보를 받아들이는 방식' },
  { key:'TF', first:'T', second:'F', firstName:'사고', secondName:'감정', theme:'판단의 기준' },
  { key:'JP', first:'J', second:'P', firstName:'판단', secondName:'인식', theme:'삶을 대하는 태도' },
];

const TYPE_INFO = {
  ISTJ:{ name:'원칙의 관리자',   brief:'약속과 책임을 끝까지 지키는, 신뢰 그 자체인 사람입니다.' },
  ISFJ:{ name:'따뜻한 수호자',   brief:'조용히 곁을 지키며 필요한 것을 먼저 채워 주는 사람입니다.' },
  INFJ:{ name:'통찰의 조언자',   brief:'사람과 세상의 이면을 읽고 의미를 찾아 주는 사람입니다.' },
  INTJ:{ name:'전략의 설계자',   brief:'멀리 보고 체계를 세워 목표를 현실로 만드는 사람입니다.' },
  ISTP:{ name:'과묵한 해결사',   brief:'말보다 손이 먼저 움직여 문제를 풀어내는 사람입니다.' },
  ISFP:{ name:'온화한 예술가',   brief:'자신만의 미감과 속도로 세상을 부드럽게 물들이는 사람입니다.' },
  INFP:{ name:'이상의 중재자',   brief:'마음속 깊은 가치를 나침반 삼아 걷는 사람입니다.' },
  INTP:{ name:'논리의 탐구자',   brief:'끝없이 질문하며 원리를 파고드는 사람입니다.' },
  ESTP:{ name:'행동의 승부사',   brief:'지금 이 순간에 뛰어들어 기회를 잡아내는 사람입니다.' },
  ESFP:{ name:'무대의 에너자이저', brief:'있는 곳마다 생기를 불어넣는 사람입니다.' },
  ENFP:{ name:'열정의 불꽃',     brief:'가능성을 발견하면 주변까지 뜨겁게 만드는 사람입니다.' },
  ENTP:{ name:'발상의 변론가',   brief:'통념에 물음표를 던지고 새 길을 여는 사람입니다.' },
  ESTJ:{ name:'현실의 경영자',   brief:'목표를 세우고 조직을 움직여 결과를 만드는 사람입니다.' },
  ESFJ:{ name:'화합의 조율사',   brief:'모두가 편안하도록 관계의 온도를 맞추는 사람입니다.' },
  ENFJ:{ name:'사람의 인도자',   brief:'타인의 성장을 도우며 함께 나아가는 사람입니다.' },
  ENTJ:{ name:'비전의 통솔자',   brief:'큰 그림을 그리고 사람들을 이끌어 이루어 내는 사람입니다.' },
};

function strengthLabel(pct) {
  if (pct >= 80) return '매우 뚜렷';
  if (pct >= 65) return '뚜렷';
  if (pct >= 55) return '약간 우세';
  return '균형에 가까움';
}

/**
 * answers: 길이 92 배열 (1~5)
 * 반환: { type, typeName, brief, axes:[{axis, letter, pct, ...}] }
 */
function scoreAssessment(answers) {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length)
    return { error: `응답 ${QUESTIONS.length}개가 필요합니다 (현재 ${answers ? answers.length : 0}개).` };

  const sums = { EI:0, SN:0, TF:0, JP:0 };
  const counts = { EI:0, SN:0, TF:0, JP:0 };
  for (let i = 0; i < QUESTIONS.length; i++) {
    const v = answers[i];
    if (!(v >= 1 && v <= 5)) return { error: `${i + 1}번 응답이 올바르지 않습니다.` };
    sums[QUESTIONS[i].a] += (v - 3) * QUESTIONS[i].d;
    counts[QUESTIONS[i].a]++;
  }

  let type = '';
  const axesOut = AXES.map(ax => {
    const max = counts[ax.key] * 2;                       // 축당 최대 절댓값 (23×2=46)
    const firstPct = Math.round(50 + (sums[ax.key] / max) * 50);
    const secondPct = 100 - firstPct;
    // 동점(50:50)은 관례상 둘째 극(I/N/F/P)
    const letter = firstPct > 50 ? ax.first : ax.second;
    const pct = Math.max(firstPct, secondPct);
    type += letter;
    return {
      axis: ax.key, theme: ax.theme,
      first: ax.first, firstName: ax.firstName, firstPct,
      second: ax.second, secondName: ax.secondName, secondPct,
      letter, letterName: letter === ax.first ? ax.firstName : ax.secondName,
      pct, strength: strengthLabel(pct),
    };
  });

  return { type, typeName: TYPE_INFO[type].name, brief: TYPE_INFO[type].brief, axes: axesOut };
}

if (typeof module !== 'undefined') module.exports = { scoreAssessment, AXES, TYPE_INFO };
