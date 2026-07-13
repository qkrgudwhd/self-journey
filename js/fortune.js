/* ============================================================
   운세·인연 엔진 (철학관 풀이 수준)
   ① 육친운: 궁위론(년=조상·월=부모·일지=배우자·시=자녀) × 십성
   ② 결혼·배우자운: 남=재성 / 여=관성 + 일지 배우자궁
   ③ 인연 지도: 천간합·오행 상생상극 → 좋은 인연 / 상반 인연
   ④ 띠 궁합: 삼합·육합(길) / 충·원진(주의)
   ⑤ 연애 추천: 사주 + MBTI 통용 궁합 종합
   ⑥ 1년 운세: 세운 십성 + 12개월 월운
   필요: manseryeok.js (STEMS/BRANCH/tenGod 등) 먼저 로드
   ============================================================ */

// ---------- 천간합 (하늘이 맺어준 합) ----------
const CHEONGAN_HAP = { 0:5, 5:0, 1:6, 6:1, 2:7, 7:2, 3:8, 8:3, 4:9, 9:4 };  // 갑기 을경 병신 정임 무계
const HAP_MEANING = { 0:'중정(中正)의 합 — 서로의 중심을 잡아주는 인연',
                      1:'인의(仁義)의 합 — 의리로 오래가는 인연',
                      2:'위엄(威嚴)의 합 — 서로를 귀하게 만드는 인연',
                      3:'인수(仁壽)의 합 — 따뜻하게 오래 함께하는 인연',
                      4:'무정(無情) 속의 합 — 달라서 더 끌리는 인연' };

// ---------- 지지 관계 ----------
const SAMHAP = [ [8,0,4], [5,9,1], [2,6,10], [11,3,7] ];   // 신자진 사유축 인오술 해묘미
const YUKHAP = { 0:1, 1:0, 2:11, 11:2, 3:10, 10:3, 4:9, 9:4, 5:8, 8:5, 6:7, 7:6 };
const CHUNG  = { 0:6, 6:0, 1:7, 7:1, 2:8, 8:2, 3:9, 9:3, 4:10, 10:4, 5:11, 11:5 };
const WONJIN = { 0:7, 7:0, 1:6, 6:1, 2:9, 9:2, 3:8, 8:3, 4:11, 11:4, 5:10, 10:5 };

// ---------- 십성별 세운(한 해) 풀이 ----------
const SEUN_DESC = {
  비견: { theme:'동행과 경쟁의 해', text:'나와 같은 기운이 들어오는 해입니다. 뜻을 같이할 동료와 귀인이 나타나지만, 같은 것을 노리는 경쟁자도 함께 옵니다. 협력할 사람과 겨룰 사람을 초반에 가려내는 것이 한 해 농사의 절반입니다. 동업·공동 투자는 지분과 역할을 문서로 명확히 해두셔야 뒤탈이 없습니다.' },
  겁재: { theme:'재물 단속의 해', text:'내 것을 나누자는 손길이 많아지는 해입니다. 빌려주는 돈은 돌려받기 어렵다고 보고 시작하시고, 보증·명의 대여는 반드시 피하셔야 합니다. 다만 과감한 승부수가 통하는 기운이기도 하여, 준비된 도전이라면 남들이 주저할 때 치고 나가 큰 것을 얻을 수 있습니다.' },
  식신: { theme:'결실과 여유의 해', text:'심어둔 것이 싹을 틔우는 넉넉한 해입니다. 의식주가 안정되고 표현력이 살아나 하는 일마다 윤기가 돕니다. 건강운도 함께 오르니 몸을 만들기에 최적기입니다. 새 취미·자격증·창작 활동을 시작하면 오래가는 결실이 됩니다.' },
  상관: { theme:'표현 폭발, 구설 주의의 해', text:'재능이 밖으로 터져 나오는 해입니다. 창작·기획·강의처럼 나를 드러내는 일에서 빛을 보지만, 같은 힘이 입으로 새면 구설과 시비가 됩니다. 윗사람·조직과의 마찰을 특히 조심하시고, 비판은 사석이 아닌 공식 통로로 하시는 것이 안전합니다.' },
  편재: { theme:'큰 기회, 큰 유동의 해', text:'돈이 크게 움직이는 해입니다. 부업·투자·사업 확장 등 굵직한 재물 기회가 오가지만, 들어오는 만큼 나가는 속도도 빠릅니다. 욕심의 크기를 정해두고 그 안에서만 움직이시면 남는 장사, 넘치면 밑 빠진 독이 됩니다. 발품을 판 만큼 벌리는 운입니다.' },
  정재: { theme:'착실한 축적의 해', text:'꾸준함이 그대로 통장에 쌓이는 해입니다. 큰 대박보다 월급·고정 수입·알뜰한 관리가 빛을 발합니다. 저축·청약·보험 정비 등 재무의 기초를 다지기에 최고의 시기이며, 성실함을 지켜본 사람이 좋은 제안을 들고 옵니다.' },
  편관: { theme:'시련이 벼려주는 해', text:'압박과 도전이 함께 오는 해입니다. 책임은 무거워지고 요구는 많아지지만, 이 풀무질을 견뎌내면 한 단계 높은 자리가 기다립니다. 무리한 확장보다 맡은 진지를 지키는 전략이 유리하며, 건강 관리(특히 과로)가 한 해의 숨은 열쇠입니다.' },
  정관: { theme:'명예와 인정의 해', text:'노력의 이력이 공식적으로 인정받는 해입니다. 승진·합격·계약·표창 등 이름이 바로 서는 일이 생기기 쉽습니다. 원칙대로 정도를 걸으면 걸을수록 운이 커지는 시기이니, 편법의 유혹만 멀리하시면 됩니다. 미혼이라면 혼담이 들어오는 운이기도 합니다.' },
  편인: { theme:'전환과 재충전의 해', text:'익숙한 판을 갈아엎고 싶어지는 해입니다. 이직·이사·유학·새 공부 등 변화의 문이 열리며, 남다른 분야(전문 기술·역학·예술)와 인연이 닿습니다. 다만 생각이 많아져 실행이 늦어질 수 있으니, 고민의 기한을 정해두고 움직이십시오.' },
  정인: { theme:'귀인과 문서의 해', text:'어른의 도움과 배움의 복이 들어오는 해입니다. 스승·상사·부모의 지원이 힘이 되고, 계약·자격·학위 같은 문서에 경사가 따릅니다. 공부를 시작하면 평생 자산이 되는 시기입니다. 베풀어 주는 이들에게 감사를 표현하면 운이 배가됩니다.' },
};

const MONTH_LINE = {
  비견:'협력과 경쟁이 교차 — 내 몫을 분명히', 겁재:'지출 단속 — 빌려주는 돈은 없는 셈',
  식신:'컨디션과 성과 상승 — 시작하기 좋은 달', 상관:'아이디어 만발 — 말은 한 번 삼키고',
  편재:'재물 유동 활발 — 발품이 곧 수익', 정재:'착실한 수확 — 재정 정리에 적기',
  편관:'업무 압박 — 건강과 페이스 조절', 정관:'인정과 승인 — 서류·시험에 길',
  편인:'변화 욕구 — 배움에 투자할 때', 정인:'귀인 등장 — 조언을 구하면 열림',
};

// ---------- 궁위 × 십성그룹 풀이 ----------
const GROUP_OF = { 비견:'비겁', 겁재:'비겁', 식신:'식상', 상관:'식상',
                   편재:'재성', 정재:'재성', 편관:'관성', 정관:'관성', 편인:'인성', 정인:'인성' };

const GUNGWI_DESC = {
  년주: {
    intro:'년주는 조상·뿌리·초년(0~20세)의 궁입니다.',
    비겁:'뿌리가 나와 같은 기운이니 자수성가의 명입니다. 물려받기보다 스스로 일으키며, 초년의 또래 인연이 평생 자산이 됩니다.',
    식상:'조상 자리에 재능의 별이 빛나니 어려서부터 끼와 표현이 남달랐습니다. 집안에 예술·기술의 내력이 흐르기 쉽습니다.',
    재성:'유복한 기운을 안고 시작한 명입니다. 초년에 물질의 소중함을 일찍 배워, 평생 재물을 다루는 감각이 남다릅니다.',
    관성:'가풍이 반듯한 집안의 기운입니다. 초년부터 책임과 규율을 배워 어디서든 "믿을 사람"이라는 평을 듣고 자랍니다.',
    인성:'학문과 덕이 흐르는 뿌리입니다. 조상·어른의 음덕이 두터워 위기마다 보이지 않는 손이 도와줍니다.',
  },
  월주: {
    intro:'월주는 부모·형제·사회 진출(20~40세)의 궁입니다.',
    비겁:'부모형제 자리에 내 기운이 서니 형제·친구가 인생의 큰 축입니다. 부모 곁보다 일찍 독립할수록 운이 열립니다.',
    식상:'부모궁에 식복이 앉으니 부모의 헌신이 각별하고, 사회에서도 기획·창작·언변으로 이름을 얻는 구조입니다.',
    재성:'부모궁에 재물의 별 — 실속을 아는 집안 기운이며, 사회 초년부터 돈 버는 길눈이 밝습니다. 아버지와의 인연이 각별합니다.',
    관성:'부모궁에 감투의 별이 앉아 부모의 기대가 크고 엄격했기 쉽습니다. 그 훈련이 조직에서의 빠른 승진으로 보답합니다.',
    인성:'부모궁에 학문의 별 — 어머니의 정성이 지극하고, 배움으로 서는 명입니다. 공부가 곧 출세의 사다리입니다.',
  },
  일지: {
    intro:'일지는 배우자의 궁 — 평생 곁을 지킬 사람의 자리입니다.',
    비겁:'배우자궁에 나와 같은 기운이 앉으니 친구 같은 배우자를 만납니다. 서로 존중하면 최고의 동지, 기 싸움이 붙으면 최대의 맞수 — 존중이 열쇠입니다.',
    식상:'배우자궁에 식복 — 다정하고 표현이 풍부한 배우자입니다. 함께 먹고 즐기는 낙이 부부의 윤활유가 되며 가정에 웃음이 잦습니다.',
    재성:'배우자궁에 재물의 별 — 알뜰하고 실속 있는 배우자입니다. 배우자 덕에 재산이 늘어나는 구조이니, 살림의 주도권을 믿고 맡기면 흥합니다.',
    관성:'배우자궁에 반듯한 별 — 원칙 있고 듬직한 배우자입니다. 다소 엄격해 보여도 울타리가 되어주는 사람이니, 그 틀을 답답해하지 말고 기대십시오.',
    인성:'배우자궁에 어진 별 — 헌신적이고 지혜로운 배우자입니다. 나를 가르치고 품어주는 인연이며, 나이 차이나 스승 같은 만남도 좋습니다.',
  },
  시주: {
    intro:'시주는 자녀·말년(60세 이후)의 궁입니다.',
    비겁:'자녀궁에 나와 같은 기운 — 자녀가 나를 닮아 주관이 뚜렷합니다. 친구처럼 지내는 부자(모녀) 사이가 되며, 말년까지 활동력이 왕성합니다.',
    식상:'자녀궁에 재능의 별 — 자녀에게 끼와 복이 있습니다. 말년이 넉넉하고 즐거우며, 손에서 일을 놓아도 소일거리가 끊이지 않습니다.',
    재성:'자녀궁에 재물의 별 — 자녀가 실속 있게 자립하고, 말년의 경제적 안정이 좋은 구조입니다. 노후 자금이 자녀를 통해 지켜집니다.',
    관성:'자녀궁에 벼슬의 별 — 자녀가 반듯하게 성취하여 부모의 이름을 세워줍니다. 말년에 존경받는 어른의 상입니다.',
    인성:'자녀궁에 학문의 별 — 공부하는 자녀를 두고, 말년에 배움과 신앙으로 평안을 얻는 상입니다. 손주 교육에 기쁨이 있습니다.',
  },
};

// ---------- 결혼·배우자운 ----------
function countGod(pillars, gods) {
  let n = 0;
  for (const p of pillars)
    for (const g of [p.stemGod, p.branchGod])
      if (gods.includes(g)) n++;
  return n;
}

function marriageFortune(saju, gender) {
  const star = gender === 'M' ? ['편재','정재'] : ['편관','정관'];
  const starName = gender === 'M' ? '재성(아내의 별)' : '관성(남편의 별)';
  const n = countGod(saju.pillars, star);
  const ilji = saju.pillars.find(p => p.name === '일주');
  const iljiGroup = GROUP_OF[ilji.branchGod];
  let text;
  if (n === 0) text = `${starName}이 팔자에 드러나지 않았습니다. 인연이 없다는 뜻이 아니라 "서두르지 않는 인연"입니다. 조건을 따지기보다 오래 곁에 있던 사람을 돌아볼 때 배필이 보이며, 결혼이 늦을수록 오히려 안정됩니다.`;
  else if (n <= 2) text = `${starName}이 알맞게 자리 잡아 배우자 인연이 안정적인 구조입니다. 때가 되면 자연스럽게 연이 닿고, 결혼 후 가정이 삶의 든든한 기반이 됩니다.`;
  else text = `${starName}이 ${n}곳에 들어 인연이 많은 명입니다. 만남의 기회는 풍성하나 그만큼 선택의 기로도 잦습니다. 비교보다 "함께 있을 때의 내 모습"을 기준으로 고르시면 후회가 없습니다.`;
  return { starName, count: n, text, iljiText: GUNGWI_DESC.일지[iljiGroup], iljiIntro: GUNGWI_DESC.일지.intro };
}

function childrenFortune(saju, gender) {
  const star = gender === 'M' ? ['편관','정관'] : ['식신','상관'];
  const starName = gender === 'M' ? '관성(자식의 별)' : '식상(자식의 별)';
  const n = countGod(saju.pillars, star);
  const siju = saju.pillars.find(p => p.name === '시주');
  let text;
  if (n === 0) text = `${starName}이 드러나지 않아 자녀와의 인연이 늦거나 담백한 편입니다. 낳은 정보다 기른 정이 크게 작용하는 명이니, 조급해하지 않으셔도 됩니다.`;
  else if (n <= 2) text = `${starName}이 반듯하게 자리해 자녀 인연이 순탄합니다. 자녀가 삶의 보람이 되는 구조입니다.`;
  else text = `${starName}이 왕성하여 자녀·후배·제자 복이 큰 명입니다. 내 자식뿐 아니라 아랫사람을 키우는 일 전반에서 복을 짓고 받습니다.`;
  return { starName, count: n, text,
           sijuText: siju ? GUNGWI_DESC.시주[GROUP_OF[siju.branchGod]] : null,
           sijuIntro: GUNGWI_DESC.시주.intro };
}

function parentsFortune(saju) {
  const n = countGod(saju.pillars, ['편인','정인']);
  const wolju = saju.pillars.find(p => p.name === '월주');
  let text;
  if (n === 0) text = '인성(부모·스승의 별)이 드러나지 않아 일찍 홀로서기를 배운 명입니다. 부모의 품보다 스스로의 힘으로 서지만, 그만큼 독립심이 강한 재산이 됩니다.';
  else if (n <= 2) text = '인성이 알맞아 부모의 사랑과 가르침을 온전히 받는 구조입니다. 어른의 조언이 인생의 고비마다 등불이 됩니다.';
  else text = '인성이 두터워 부모·어른의 그늘이 깊은 명입니다. 받는 사랑이 큰 만큼 마마보이/파파걸 소리를 듣지 않도록 홀로 서는 연습이 필요합니다.';
  return { count: n, text, woljuText: GUNGWI_DESC.월주[GROUP_OF[wolju.branchGod]], woljuIntro: GUNGWI_DESC.월주.intro };
}

// ---------- 인연 지도 (좋은 관계 / 상반 관계) ----------
function relationMap(saju) {
  const ds = STEMS.indexOf(saju.dayMaster.stem);
  const de = [0,0,1,1,2,2,3,3,4,4][ds];
  const ELEM_N = ['목','화','토','금','수'];
  const hapIdx = CHEONGAN_HAP[ds];
  const yb = BRANCH.indexOf(saju.pillars[0].branchName);   // 년지(띠)

  // 좋은 일간: 천간합 + 나를 생하는 오행(인성) + 내가 생하는 오행(식상)
  const good = [];
  good.push({ who:`${STEMS[hapIdx]}(${STEMS_H[hapIdx]}) 일간`,
              why:`천간합 — ${HAP_MEANING[Math.min(ds,hapIdx)%5] || HAP_MEANING[ds%5]}` });
  const saengMe = (de + 4) % 5, iSaeng = (de + 1) % 5;
  good.push({ who:`${ELEM_N[saengMe]} 기운의 사람 (${STEMS[saengMe*2]}·${STEMS[saengMe*2+1]} 일간)`,
              why:'나를 낳아주는 오행 — 지치면 기대게 되는 귀인' });
  good.push({ who:`${ELEM_N[iSaeng]} 기운의 사람 (${STEMS[iSaeng*2]}·${STEMS[iSaeng*2+1]} 일간)`,
              why:'내가 살리는 오행 — 아끼고 키워주고 싶은 인연' });

  // 상반 일간: 나를 극하는 오행(관), 특히 같은 음양(편관) + 내가 극하는 오행 과열
  const gukMe = (de + 3) % 5, iGuk = (de + 2) % 5;
  const chilsal = gukMe * 2 + (ds % 2);                    // 같은 음양 = 편관(칠살)
  const bad = [];
  bad.push({ who:`${STEMS[chilsal]}(${STEMS_H[chilsal]}) 일간`,
             why:'칠살 — 나를 강하게 억누르는 기운. 긴장을 조율해야 하는 관계' });
  bad.push({ who:`${ELEM_N[iGuk]} 기운이 강한 사람`,
             why:'내가 극하는 오행 — 내가 통제하려 들기 쉬워, 존중을 잃으면 부서지는 관계' });

  // 띠 궁합
  const myGroup = SAMHAP.find(g => g.includes(yb));
  const samhapZ = myGroup.filter(b => b !== yb).map(b => ZODIAC[b] + '띠');
  const yukhapZ = ZODIAC[YUKHAP[yb]] + '띠';
  const chungZ = ZODIAC[CHUNG[yb]] + '띠';
  const wonjinZ = ZODIAC[WONJIN[yb]] + '띠';

  return { good, bad,
    zodiacGood: [...samhapZ.map(z => ({ who:z, why:'삼합 — 뜻이 모이면 큰일을 이루는 조합' })),
                 { who:yukhapZ, why:'육합 — 곁에 있으면 편안해지는 짝' }],
    zodiacBad: [{ who:chungZ, why:'충 — 서로 정면으로 부딪치는 자리. 애증이 교차' },
                { who:wonjinZ, why:'원진 — 이유 없이 얄미운 자리. 거리 조절이 지혜' }] };
}

// ---------- MBTI 통용 궁합 ----------
const MBTI_MATCH = {
  ISTJ:{ best:['ESFP','ESTP'], care:['ENFP','INFP'] }, ISFJ:{ best:['ESTP','ESFP'], care:['ENTP','INTP'] },
  INFJ:{ best:['ENFP','ENTP'], care:['ESTP','ESFP'] }, INTJ:{ best:['ENFP','ENTP'], care:['ESFP','ESFJ'] },
  ISTP:{ best:['ESFJ','ESTJ'], care:['ENFJ','INFJ'] }, ISFP:{ best:['ENFJ','ESFJ'], care:['ENTJ','ESTJ'] },
  INFP:{ best:['ENFJ','ENTJ'], care:['ESTJ','ISTJ'] }, INTP:{ best:['ENTJ','ESTJ'], care:['ESFJ','ISFJ'] },
  ESTP:{ best:['ISFJ','ISTJ'], care:['INFJ','INFP'] }, ESFP:{ best:['ISTJ','ISFJ'], care:['INTJ','INTP'] },
  ENFP:{ best:['INFJ','INTJ'], care:['ISTJ','ISFJ'] }, ENTP:{ best:['INFJ','INTJ'], care:['ISFJ','ISTJ'] },
  ESTJ:{ best:['ISTP','INTP'], care:['INFP','ISFP'] }, ESFJ:{ best:['ISFP','ISTP'], care:['INTP','INTJ'] },
  ENFJ:{ best:['INFP','ISFP'], care:['ISTP','INTP'] }, ENTJ:{ best:['INFP','INTP'], care:['ISFP','ESFP'] },
};

function loveRecommendation(saju, mbtiType, gender) {
  const rel = relationMap(saju);
  const mm = MBTI_MATCH[mbtiType];
  const spouseStar = gender === 'M' ? '재성' : '관성';
  return {
    summary: `사주로는 ${rel.good[0].who}·${rel.zodiacGood[0].who} 인연이 으뜸이고, 성향으로는 ${mm.best.join('·')} 유형과 결이 맞습니다.`,
    points: [
      `하늘의 짝: ${rel.good[0].who} — ${rel.good[0].why}`,
      `귀인의 짝: ${rel.good[1].who}`,
      `띠 인연: ${rel.zodiacGood.map(z => z.who).join(' · ')}`,
      `성향의 짝: ${mm.best.join(', ')} — 내가 못 보는 쪽을 보완해주는 유형`,
      `천천히 다가갈 상대: ${mm.care.join(', ')} 유형, 그리고 ${rel.zodiacBad[0].who} — 나쁜 인연이 아니라 "노력이 필요한" 인연입니다`,
    ],
    advice: gender === 'M'
      ? `남명(男命)에서 아내의 별은 ${spouseStar}입니다. 재성은 "내가 아끼고 가꾸는 것" — 곁의 사람을 소유가 아니라 정원처럼 돌볼 때 사랑이 깊어집니다.`
      : `여명(女命)에서 남편의 별은 ${spouseStar}입니다. 관성은 "나를 바로 세워주는 것" — 나를 함부로 흔들지 않고 지켜봐 주는 사람이 진짜 인연입니다.`,
  };
}

// ---------- 1년 운세 (세운 + 12개월) ----------
function yearlyFortune(saju, targetYear) {
  const ds = STEMS.indexOf(saju.dayMaster.stem);
  const yIdx = ((targetYear - 1864) % 60 + 60) % 60;
  const ys = yIdx % 10, yb = yIdx % 12;
  const seunGod = tenGod(ds, ys);
  const seun = SEUN_DESC[seunGod];

  // 12개월 월운 (인월=입춘부터, 오호둔)
  const months = [];
  for (let n = 0; n < 12; n++) {
    const mb = (2 + n) % 12;
    const ms = ((ys % 5) * 2 + 2 + n) % 10;
    const god = tenGod(ds, ms);
    const approxMonth = ((n + 1) % 12) + 1;    // 인월≈양력 2월
    months.push({ label:`${approxMonth}월경(${BRANCH[mb]}월)`, ganji: STEMS[ms] + BRANCH[mb],
                  god, line: MONTH_LINE[god] });
  }
  // 세운 지지와 내 년지 관계
  const myYb = BRANCH.indexOf(saju.pillars[0].branchName);
  let zodiacNote = null;
  if (CHUNG[myYb] === yb) zodiacNote = `올해는 내 띠와 충(沖)이 되는 해 — 이동·변동수가 큽니다. 이사·이직이라면 오히려 순리이나, 큰 계약은 두 번 확인하십시오.`;
  else if (SAMHAP.find(g => g.includes(myYb))?.includes(yb)) zodiacNote = `올해는 내 띠와 삼합(三合)을 이루는 해 — 귀인과 협력의 운이 크게 열립니다.`;
  else if (YUKHAP[myYb] === yb) zodiacNote = `올해는 내 띠와 육합(六合)의 해 — 인연과 화합의 운이 순합니다.`;

  return { year: targetYear, ganji: STEMS[ys] + BRANCH[yb], ganjiHanja: STEMS_H[ys] + BRANCH_H[yb],
           god: seunGod, theme: seun.theme, text: seun.text, zodiacNote, months };
}

// ---------- 궁위 전체 풀이 (부모·형제·조상·자녀 한번에) ----------
function gungwiReading(saju) {
  const out = [];
  for (const p of saju.pillars) {
    const key = p.name === '일주' ? '일지' : p.name;
    const d = GUNGWI_DESC[key];
    if (!d) continue;
    out.push({ gung: key, ganji: p.ganji, ganjiHanja: p.ganjiHanja,
               god: p.branchGod, intro: d.intro, text: d[GROUP_OF[p.branchGod]] });
  }
  return out;
}

// ---------- 궁합: 두 사주를 맞대다 ----------
function compatAnalysis(my, other, myGender) {
  const ms = STEMS.indexOf(my.dayMaster.stem), os = STEMS.indexOf(other.dayMaster.stem);
  const myYb = BRANCH.indexOf(my.pillars[0].branchName);
  const otYb = BRANCH.indexOf(other.pillars[0].branchName);
  const myIlji = BRANCH.indexOf(my.pillars.find(p=>p.name==='일주').branchName);
  const otIlji = BRANCH.indexOf(other.pillars.find(p=>p.name==='일주').branchName);

  let score = 50;
  const points = [];

  // 1) 일간 천간합 — 최고의 합
  if (CHEONGAN_HAP[ms] === os) {
    score += 25;
    points.push({ mark:'💛', title:'일간 천간합', good:true,
      text:`두 분의 일간(${my.dayMaster.stem}·${other.dayMaster.stem})이 천간합을 이룹니다. ${HAP_MEANING[Math.min(ms,os)%5]}. 명리에서 가장 귀하게 보는 짝의 구조입니다.` });
  } else {
    // 일간 십성 관계
    const god = tenGod(ms, os);
    const partnerStar = myGender === 'M' ? ['정재','편재'] : ['정관','편관'];
    if (partnerStar.includes(god)) {
      score += 12;
      points.push({ mark:'💛', title:`일간 관계 — ${god}`, good:true,
        text:`상대의 일간이 나에게 ${god} — ${myGender==='M'?'아내':'남편'}의 별에 해당하는 인연입니다. 자연스럽게 배필로 끌리는 구조입니다.` });
    } else if (['정인','편인'].includes(god)) {
      score += 8;
      points.push({ mark:'💛', title:`일간 관계 — ${god}`, good:true,
        text:'상대가 나를 낳아주는 기운입니다. 곁에 있으면 기대게 되고 배우게 되는, 어른 같고 스승 같은 인연입니다.' });
    } else if (['식신','상관'].includes(god)) {
      score += 6;
      points.push({ mark:'💛', title:`일간 관계 — ${god}`, good:true,
        text:'내가 살려주는 기운의 상대입니다. 아끼고 챙겨주고 싶어지는, 내가 주는 기쁨이 큰 인연입니다.' });
    } else if (['비견','겁재'].includes(god)) {
      points.push({ mark:'🤝', title:`일간 관계 — ${god}`, good:true,
        text:'같은 기운끼리의 만남 — 친구 같은 관계입니다. 서로를 잘 이해하지만, 양보 없이는 기 싸움이 되기 쉽습니다.' });
    } else {
      score -= 5;
      points.push({ mark:'⚡', title:`일간 관계 — ${god}`, good:false,
        text:'상대가 나를 다스리는 기운입니다. 긴장감이 매력이 되기도 하지만, 한쪽이 일방적으로 억누르지 않도록 균형이 필요합니다.' });
    }
  }

  // 2) 띠 관계
  if (SAMHAP.find(g => g.includes(myYb))?.includes(otYb)) {
    score += 18;
    points.push({ mark:'💛', title:'띠 삼합', good:true,
      text:`${ZODIAC[myYb]}띠와 ${ZODIAC[otYb]}띠는 삼합 — 뜻이 모이면 큰일을 함께 이루는 조합입니다.` });
  } else if (YUKHAP[myYb] === otYb) {
    score += 15;
    points.push({ mark:'💛', title:'띠 육합', good:true,
      text:`${ZODIAC[myYb]}띠와 ${ZODIAC[otYb]}띠는 육합 — 곁에 있으면 편안해지는 궁합입니다.` });
  } else if (CHUNG[myYb] === otYb) {
    score -= 15;
    points.push({ mark:'⚡', title:'띠 충', good:false,
      text:`${ZODIAC[myYb]}띠와 ${ZODIAC[otYb]}띠는 충 — 서로 정면으로 부딪치는 자리입니다. 애증이 교차하나, 부딪치며 크는 관계이기도 합니다.` });
  } else if (WONJIN[myYb] === otYb) {
    score -= 10;
    points.push({ mark:'⚡', title:'띠 원진', good:false,
      text:`${ZODIAC[myYb]}띠와 ${ZODIAC[otYb]}띠는 원진 — 이유 없이 서운해지기 쉬운 자리입니다. 표현을 아끼지 않는 것이 처방입니다.` });
  }

  // 3) 일지(배우자궁)끼리의 합
  if (YUKHAP[myIlji] === otIlji) {
    score += 15;
    points.push({ mark:'💛', title:'배우자궁 육합', good:true,
      text:'두 분의 배우자궁(일지)이 서로 합을 이룹니다 — 살을 맞대고 사는 자리가 맞는, 부부 인연에서 특히 귀한 구조입니다.' });
  } else if (SAMHAP.find(g => g.includes(myIlji))?.includes(otIlji)) {
    score += 10;
    points.push({ mark:'💛', title:'배우자궁 삼합', good:true,
      text:'배우자궁끼리 삼합 — 생활의 리듬과 지향점이 자연스럽게 맞아 들어갑니다.' });
  } else if (CHUNG[myIlji] === otIlji) {
    score -= 12;
    points.push({ mark:'⚡', title:'배우자궁 충', good:false,
      text:'배우자궁끼리 충 — 생활 습관의 차이가 부딪치기 쉽습니다. 각자의 공간과 시간을 존중하는 것이 오래가는 비결입니다.' });
  }

  // 4) 오행 상보 — 내 최약 오행을 상대가 채워주는가 (상호)
  const myWeak = [...my.elements].sort((a,b)=>a.pct-b.pct)[0];
  const otWeak = [...other.elements].sort((a,b)=>a.pct-b.pct)[0];
  const otHasMyWeak = other.elements.find(e=>e.name===myWeak.name).pct;
  const myHasOtWeak = my.elements.find(e=>e.name===otWeak.name).pct;
  if (otHasMyWeak >= 25) {
    score += 10;
    points.push({ mark:'💛', title:'오행 보완', good:true,
      text:`나에게 부족한 ${myWeak.name}(${myWeak.hanja}) 기운(${myWeak.pct}%)을 상대가 ${otHasMyWeak}%로 넉넉히 지녔습니다. 곁에 있는 것만으로 내가 채워지는 관계입니다.` });
  }
  if (myHasOtWeak >= 25) {
    score += 5;
    points.push({ mark:'💛', title:'오행 보완(상대 방향)', good:true,
      text:`상대에게 부족한 ${otWeak.name} 기운을 내가 채워줍니다. 서로가 서로의 약을 쥐고 있는 셈입니다.` });
  }

  // 5) 서양 별자리 궁합 (zodiac_west.js 로드 시)
  if (typeof getWesternZodiac === 'function' && my.input && other.input) {
    const wa = getWesternZodiac(my.input.solarMonth, my.input.solarDay);
    const wb = getWesternZodiac(other.input.solarMonth, other.input.solarDay);
    const wc = compatWestern(wa, wb);
    score += wc.score;
    points.push({ mark: wc.score >= 5 ? '💛' : wc.score < 0 ? '⚡' : '🤝',
      title: `별자리 — ${wa.sym}${wa.name} × ${wb.sym}${wb.name} · ${wc.level}`,
      good: wc.score >= 0, text: wc.text });
  }

  score = Math.max(5, Math.min(99, score));
  const grade = score >= 85 ? { name:'천생연분', desc:'명리의 여러 잣대가 한 방향을 가리키는, 드물게 귀한 궁합입니다.' }
              : score >= 70 ? { name:'좋은 인연', desc:'큰 흐름이 순조로운 궁합입니다. 다듬을 곳만 다듬으면 오래갑니다.' }
              : score >= 50 ? { name:'무난한 인연', desc:'특별한 합도 충도 크지 않은, 두 사람이 만들어가기 나름인 궁합입니다.' }
              : { name:'노력의 인연', desc:'부딪치는 자리가 있는 궁합입니다. 그러나 명리의 충은 "끝"이 아니라 "과제" — 서로를 알고 시작하면 어떤 합보다 단단해질 수 있습니다.' };

  return { score, grade, points,
           myIlgan: my.dayMaster.stem + '(' + my.dayMaster.hanja + ')',
           otIlgan: other.dayMaster.stem + '(' + other.dayMaster.hanja + ')',
           myZodiac: ZODIAC[myYb] + '띠', otZodiac: ZODIAC[otYb] + '띠' };
}

if (typeof module !== 'undefined')
  module.exports = { marriageFortune, childrenFortune, parentsFortune, relationMap,
                     loveRecommendation, yearlyFortune, gungwiReading, compatAnalysis,
                     SEUN_DESC, GUNGWI_DESC, MBTI_MATCH, CHEONGAN_HAP, SAMHAP, YUKHAP, CHUNG, WONJIN };
