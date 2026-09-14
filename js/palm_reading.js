/* ============================================================
   나를 찾는 여정 — 손금(수상) 엔진  palm_reading.js
   ------------------------------------------------------------
   · 검출: MediaPipe Hand Landmarker (21점, Apache-2.0, 로컬/오프라인)
   · 원칙: 사진은 브라우저 안에서만 처리 — 전송/저장하지 않음
   · 구조: [측정] 손 모양·손가락 비율 = 객관·재현 가능(21점 기하)
           [해석] 전통 수상학 — 4원소 손 + 3대선(생명·감정·지능)
           손금선은 조명·각도에 민감 → 자동 검출은 '추정'으로 정직 표기,
           사진 위에 찾은 선(에지)을 덧그려 눈으로 확인시킴
   · 전역: window.PalmReader(검출) / window.PalmRead(계측·해석·렌더)
   ============================================================ */
(function (global) {
'use strict';

// ── 자기 위치로부터 절대 URL 계산(about:blank 기준 문제 회피) ──
const _self = (document.currentScript && document.currentScript.src) || '';
let _jsDir, _root;
if (_self) {
  _jsDir = _self.replace(/[?#].*$/, '').replace(/\/[^/]*$/, '/');
  _root  = _jsDir.replace(/[^/]+\/$/, '');
} else { _jsDir = new URL('js/', document.baseURI).href; _root = new URL('./', document.baseURI).href; }
const BUNDLE = _jsDir + 'vendor/vision_bundle.mjs';
const WASM   = _root + 'models/wasm';
const MODEL  = _root + 'models/hand_landmarker.task';

// ── 손 랜드마크 인덱스(21점) ──
// 0 손목 / 1-4 엄지 / 5-8 검지 / 9-12 중지 / 13-16 약지 / 17-20 소지
const WRIST=0, THUMB_CMC=1, THUMB_MCP=2, THUMB_IP=3, THUMB_TIP=4,
      IDX_MCP=5, IDX_PIP=6, IDX_TIP=8, MID_MCP=9, MID_TIP=12,
      RING_MCP=13, RING_TIP=16, PINKY_MCP=17, PINKY_TIP=20;

const px = (lm, W, H, i) => ({ x: lm[i].x * W, y: lm[i].y * H });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = v => Math.round(v * 100) / 100;

/* ══════════════ 1. 검출기 ══════════════ */
const PalmReader = {
  _lm: null, _loading: null,
  ready() { return !!this._lm; },
  async load(onStep) {
    if (this._lm) return this._lm;
    if (this._loading) return this._loading;
    this._loading = (async () => {
      onStep && onStep('손 인식 엔진을 여는 중…');
      const vision = await import(BUNDLE);
      const { FilesetResolver, HandLandmarker } = vision;
      onStep && onStep('검출 런타임을 준비하는 중…');
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      onStep && onStep('손금 모델을 불러오는 중… (최초 1회)');
      this._lm = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL },
        runningMode: 'IMAGE', numHands: 1,
        minHandDetectionConfidence: 0.3, minHandPresenceConfidence: 0.3,
      });
      return this._lm;
    })();
    return this._loading;
  },
  detect(imgEl) {
    if (!this._lm) throw new Error('엔진이 아직 준비되지 않았습니다.');
    const res = this._lm.detect(imgEl);
    if (!res.landmarks || !res.landmarks.length) return null;
    const hand = (res.handednesses && res.handednesses[0] && res.handednesses[0][0])
      ? res.handednesses[0][0].categoryName : null;   // 'Left' | 'Right'
    return { lm: res.landmarks[0], handed: hand };
  },

  // 손바닥 영역에서 3대선(에지)을 찾아 좌표 배열로 반환(정규화 0~1)
  detectLines(imgEl, lm) {
    const MAXW = 560;
    const scale = Math.min(1, MAXW / imgEl.naturalWidth);
    const w = Math.max(1, Math.round(imgEl.naturalWidth * scale));
    const h = Math.max(1, Math.round(imgEl.naturalHeight * scale));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(imgEl, 0, 0, w, h);
    const src = g.getImageData(0, 0, w, h).data;
    // 그레이스케일
    const gray = new Float32Array(w * h);
    for (let i = 0, p = 0; i < src.length; i += 4, p++)
      gray[p] = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
    // Sobel 에지 크기
    const mag = new Float32Array(w * h);
    let maxm = 1;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const o = y * w + x;
      const gx = -gray[o-w-1]-2*gray[o-1]-gray[o+w-1]+gray[o-w+1]+2*gray[o+1]+gray[o+w+1];
      const gy = -gray[o-w-1]-2*gray[o-w]-gray[o-w+1]+gray[o+w-1]+2*gray[o+w]+gray[o+w+1];
      const m = Math.hypot(gx, gy); mag[o] = m; if (m > maxm) maxm = m;
    }
    // 손바닥 사각형 마스크 (손목·엄지뿌리·검지MCP·소지MCP)
    const P = i => ({ x: lm[i].x * w, y: lm[i].y * h });
    const quad = [P(WRIST), P(THUMB_CMC), P(IDX_MCP), P(PINKY_MCP)];
    const inQuad = (x, y) => {
      // 볼록사각형 내부: 네 변에 대해 같은 부호
      let sign = 0;
      for (let k = 0; k < 4; k++) {
        const a = quad[k], b = quad[(k + 1) % 4];
        const cr = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
        if (cr !== 0) { const s = cr > 0 ? 1 : -1; if (sign === 0) sign = s; else if (s !== sign) return false; }
      }
      return true;
    };
    // 손바닥 축(손목→중지MCP)과 강에지 수집
    const thr = maxm * 0.28;
    const pts = [];
    let palmSum = 0, palmN = 0;
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      if (!inQuad(x, y)) continue;
      const m = mag[y * w + x]; palmSum += m; palmN++;
      if (m > thr) pts.push({ x: x / w, y: y / h, m: m / maxm });
    }
    const palmAvg = palmN ? palmSum / palmN : 0;
    // 3대선 영역별 에지밀도(축 t: 0=손목,1=중지MCP)
    const wr = P(WRIST), mm = P(MID_MCP);
    const ax = mm.x - wr.x, ay = mm.y - wr.y, aL2 = ax * ax + ay * ay || 1;
    const proj = (x, y) => ((x - wr.x) * ax + (y - wr.y) * ay) / aL2;
    const band = (t0, t1) => {
      let sum = 0, n = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!inQuad(x, y)) continue;
        const t = proj(x, y); if (t < t0 || t > t1) continue;
        sum += mag[y * w + x]; n++;
      }
      return n ? sum / n : 0;
    };
    const heart = band(0.72, 0.98), head = band(0.45, 0.68), life = band(0.18, 0.62);
    // 운명선(중앙 세로): 축에 가까운(수직거리 작은) 세로 영역의 에지밀도
    const aLen = Math.hypot(ax, ay) || 1;
    const halfW = dist(P(IDX_MCP), P(PINKY_MCP)) / 2 || 1;
    const fateBand = () => {
      let sum = 0, n = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!inQuad(x, y)) continue;
        const t = proj(x, y); if (t < 0.4 || t > 0.95) continue;
        const perp = Math.abs((x - wr.x) * ay - (y - wr.y) * ax) / aLen;
        if (perp > halfW * 0.33) continue;   // 중앙 세로 띠만
        sum += mag[y * w + x]; n++;
      }
      return n ? sum / n : 0;
    };
    const fate = fateBand();
    const norm = v => palmAvg ? clamp(v / palmAvg, 0.3, 2.2) : 1;
    return {
      points: pts.slice(0, 4000),
      clarity: { heart: norm(heart), head: norm(head), life: norm(life), fate: norm(fate) },
    };
  },

  drawOverlay(canvas, imgEl, lm, lines) {
    const W = imgEl.naturalWidth, H = imgEl.naturalHeight;
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d');
    g.drawImage(imgEl, 0, 0, W, H);
    if (!lm) return;
    // 손금선(에지) 덧그리기 — 금빛 점
    if (lines && lines.points) {
      g.fillStyle = 'rgba(231,196,107,0.55)';
      const rr = Math.max(1, Math.round(Math.min(W, H) / 500));
      for (const p of lines.points) { g.beginPath(); g.arc(p.x * W, p.y * H, rr, 0, 7); g.fill(); }
    }
    // 관절 21점
    g.fillStyle = 'rgba(127,196,224,0.95)';
    const rDot = Math.max(2, Math.round(Math.min(W, H) / 150));
    for (const p of lm) { g.beginPath(); g.arc(p.x * W, p.y * H, rDot, 0, 7); g.fill(); }
    // 손가락 뼈대
    g.strokeStyle = 'rgba(127,196,224,0.8)'; g.lineWidth = Math.max(1, rDot / 2);
    const bones = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
                   [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
    const P = i => px(lm, W, H, i);
    for (const [a, b] of bones) { const pa = P(a), pb = P(b); g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y); g.stroke(); }
  },
};

/* ══════════════ 2. 손 계측 ══════════════ */
function measureHand(lm, W, H) {
  const P = i => px(lm, W, H, i);
  const palmLen = dist(P(WRIST), P(MID_MCP));
  const palmWid = dist(P(IDX_MCP), P(PINKY_MCP));
  const midFinger = dist(P(MID_MCP), P(MID_TIP));
  const idxLen = dist(P(IDX_MCP), P(IDX_TIP));
  const ringLen = dist(P(RING_MCP), P(RING_TIP));
  const pinkyLen = dist(P(PINKY_MCP), P(PINKY_TIP));
  const thumbLen = dist(P(THUMB_MCP), P(THUMB_TIP));
  // 엄지 벌어짐 각도(엄지 방향 vs 검지 방향)
  const va = { x: P(THUMB_TIP).x - P(THUMB_CMC).x, y: P(THUMB_TIP).y - P(THUMB_CMC).y };
  const vb = { x: P(IDX_TIP).x - P(IDX_MCP).x, y: P(IDX_TIP).y - P(IDX_MCP).y };
  const dot = va.x*vb.x + va.y*vb.y, na = Math.hypot(va.x,va.y)||1, nb = Math.hypot(vb.x,vb.y)||1;
  const thumbAngle = Math.acos(clamp(dot/(na*nb), -1, 1)) * 180 / Math.PI;
  return {
    W, H,
    palmLen, palmWid,
    palmRatio: palmLen / (palmWid || 1),          // 손바닥 세로/가로
    fingerVsPalm: midFinger / (palmLen || 1),      // 손가락/손바닥 (긴손가락 여부)
    d2d4: idxLen / (ringLen || 1),                 // 검지:약지
    idxVsRing: idxLen / (ringLen || 1),
    pinkyVsRing: pinkyLen / (ringLen || 1),
    thumbVsPalm: thumbLen / (palmLen || 1),
    thumbAngle,
  };
}

/* ══════════════ 3. 전통 수상학 해석 ══════════════ */

// 4원소 손 유형(전통 수상학) + 오행 대응
const HAND_TYPES = {
  earth: { key: '흙의 손(土)', oheng: '토(土)', shape: '네모난 손바닥 + 짧은 손가락',
    text: '손바닥이 각지고 손가락이 짧은 흙의 손입니다. 땅처럼 실용적이고 성실하며, 손으로 하는 일·현장·꾸준함에 강합니다. 신뢰가 두텁고 뒷심이 좋은 반면, 변화를 낯설어할 수 있으니 새로움에 마음을 여는 연습이 도움이 됩니다.' },
  air: { key: '바람의 손(金)', oheng: '금(金)', shape: '네모난 손바닥 + 긴 손가락',
    text: '손바닥은 각지되 손가락이 긴 바람의 손입니다. 논리적이고 소통에 능하며, 아이디어·언어·분석의 자리에서 빛납니다. 머리가 빠른 만큼 생각이 많아질 수 있으니, 실행으로 옮기는 힘을 함께 기르면 좋습니다.' },
  fire: { key: '불의 손(火)', oheng: '화(火)', shape: '긴 손바닥 + 짧은 손가락',
    text: '손바닥이 길고 손가락이 짧은 불의 손입니다. 열정적이고 추진력이 강하며 결단이 빠릅니다. 리더십과 활력이 무기지만, 불길처럼 급할 수 있으니 인내와 마무리를 더하면 재능이 오래 갑니다.' },
  water: { key: '물의 손(水)', oheng: '수(水)', shape: '긴 손바닥 + 긴 손가락',
    text: '손바닥과 손가락이 모두 긴 물의 손입니다. 감수성이 풍부하고 직관·예술·공감에 뛰어납니다. 섬세한 만큼 주변에 영향을 잘 받으니, 자기 중심을 지키면 그 감성이 큰 재능이 됩니다.' },
};
function classifyHand(m) {
  const longPalm = m.palmRatio >= 1.15;      // 손바닥이 길다(세로>가로)
  const longFingers = m.fingerVsPalm >= 0.75; // 손가락이 길다
  let key;
  if (!longPalm && !longFingers) key = 'earth';
  else if (!longPalm && longFingers) key = 'air';
  else if (longPalm && !longFingers) key = 'fire';
  else key = 'water';
  return { key, info: HAND_TYPES[key],
    metrics: { palmRatio: r2(m.palmRatio), fingerVsPalm: r2(m.fingerVsPalm) } };
}

function readFingers(m) {
  const out = [];
  // 손가락 전체 길이
  {
    const g = m.fingerVsPalm >= 0.80 ? 2 : (m.fingerVsPalm <= 0.68 ? 0 : 1);
    out.push({ part: '손가락 길이', tag: ['짧은 편', '균형', '긴 편'][g], metric: `손가락/손바닥 ${r2(m.fingerVsPalm)}`,
      text: ['손가락이 짧은 편이라 직관적이고 행동이 빠르며, 큰 그림을 먼저 봅니다. 실행형입니다.',
             '손가락 길이가 균형 잡혀, 직관과 분석의 조화가 좋습니다.',
             '손가락이 긴 편이라 섬세하고 사색적이며, 디테일과 계획에 강합니다.'][g] });
  }
  // 검지:약지 (2D:4D)
  {
    const g = m.d2d4 >= 1.0 ? 2 : (m.d2d4 <= 0.95 ? 0 : 1);
    out.push({ part: '검지 : 약지 비율', tag: ['약지가 긴 편', '비슷', '검지가 긴 편'][g], metric: `검지/약지 ${r2(m.d2d4)}`,
      text: ['약지가 검지보다 긴 편 — 전통적으로 과감함·경쟁심·직관적 결단과 연결됩니다.',
             '검지와 약지가 비슷 — 균형 잡힌 추진력과 신중함을 함께 지닙니다.',
             '검지가 약지보다 긴 편 — 자기 주장·리더십·신중한 판단과 연결됩니다.'][g] +
        ' (2D:4D 비율은 통용되는 참고 지표로, 절대적 해석은 아닙니다.)' });
  }
  // 엄지 벌어짐(개방성/의지)
  {
    const g = m.thumbAngle >= 55 ? 2 : (m.thumbAngle <= 35 ? 0 : 1);
    out.push({ part: '엄지 벌어짐', tag: ['좁음', '보통', '넓음'][g], metric: `엄지 각도 ${Math.round(m.thumbAngle)}°`,
      text: ['엄지를 몸쪽으로 붙이는 편 — 신중하고 자기 관리가 엄격하며, 에너지를 안으로 모읍니다.',
             '엄지 벌어짐이 보통 — 의지와 융통성의 균형이 좋습니다.',
             '엄지가 시원하게 벌어지는 편 — 개방적이고 관대하며, 의지가 강하고 새로운 것을 잘 받아들입니다.'][g] });
  }
  return out;
}

// 3대선 해석 (자동 검출 clarity = 뚜렷함 추정)
const LINE_DEFS = [
  { key: 'life', name: '생명선(生命線)', at: '엄지를 감싸며 손목으로 내려오는 곡선',
    theme: '체력·활력·삶의 기세',
    clear: '생명선이 뚜렷하고 깊게 잡힙니다. 전통적으로 활력과 체력이 튼튼하고 회복력이 좋음을 뜻합니다.',
    mid: '생명선이 무난하게 보입니다. 기본 체력과 생활의 안정성이 균형 잡혀 있습니다.',
    faint: '생명선이 흐리게 잡힙니다(조명·각도 영향일 수 있음). 전통적으로는 에너지를 아껴 쓰고 규칙적 생활로 힘을 채우라는 신호로 읽습니다.',
    how: '길이보다 <b>깊이와 선명함</b>을 봅니다. 엄지 쪽으로 넓게 감쌀수록 활동적, 좁게 붙을수록 신중한 기질로 봅니다.' },
  { key: 'head', name: '지능선(頭腦線)', at: '손바닥 한가운데를 가로지르는 선',
    theme: '사고방식·재능·집중',
    clear: '지능선이 뚜렷합니다. 사고가 명료하고 집중력·판단력이 좋음을 뜻합니다.',
    mid: '지능선이 무난합니다. 균형 잡힌 사고와 상식적 판단을 지닙니다.',
    faint: '지능선이 흐리게 잡힙니다. 논리보다 직관·감성으로 판단하는 기질일 수 있습니다.',
    how: '<b>곧게 뻗으면</b> 현실적·논리적, <b>아래로 완만히 휘면</b> 상상력·창의형으로 봅니다. 길면 사려 깊음, 짧으면 결단이 빠름.' },
  { key: 'heart', name: '감정선(感情線)', at: '손가락 바로 아래 가로선',
    theme: '애정·정서·대인관계',
    clear: '감정선이 뚜렷합니다. 정이 풍부하고 애정 표현이 분명하며 대인관계가 따뜻합니다.',
    mid: '감정선이 무난합니다. 감정과 이성의 균형이 좋습니다.',
    faint: '감정선이 흐리게 잡힙니다. 감정을 안으로 갈무리하는 담백한 기질일 수 있습니다.',
    how: '<b>검지 쪽까지 길게</b> 오르면 이상적·헌신적 사랑, <b>중지 근처에서 멈추면</b> 현실적 사랑으로 봅니다. 위로 갈래가 생기면 표현이 풍부.' },
  { key: 'fate', name: '운명선(運命線·사업선)', at: '손목에서 중지로 오르는 세로선',
    theme: '직업·사회적 성취·삶의 방향',
    clear: '운명선이 뚜렷하게 세로로 섭니다. 삶의 방향과 직업운이 또렷하고, 자기 길에 대한 확신과 추진력이 강합니다.',
    mid: '운명선이 무난합니다. 큰 굴곡 없이 자기 자리를 찾아가는 흐름입니다.',
    faint: '운명선이 흐리거나 옅게 잡힙니다(없는 사람도 많음). 정해진 한 길보다 여러 길을 자유롭게 넘나드는 유연한 삶일 수 있습니다.',
    how: '<b>손목에서 곧게 중지로</b> 오르면 자수성가·꾸준한 성취, <b>중간에 끊기거나 여러 갈래면</b> 직업·환경의 변화가 많은 삶으로 봅니다. 운명선이 옅다고 나쁜 것이 아니라, 스스로 방향을 만드는 자유형입니다.' },
];
function readLines(clarity) {
  return LINE_DEFS.map(d => {
    const c = clarity ? clarity[d.key] : 1;
    const g = c >= 1.15 ? 'clear' : (c <= 0.8 ? 'faint' : 'mid');
    return { name: d.name, at: d.at, theme: d.theme,
      tag: g === 'clear' ? '뚜렷(추정)' : (g === 'faint' ? '흐림(추정)' : '보통(추정)'),
      text: d[g], how: d.how };
  });
}

// 언덕(丘) — 손바닥 아홉 언덕(전통 수상학). 두툼함은 3D라 사진 측정이 제한되어
// 전통 의미 + '직접 보는 법'을 안내(별님: 정통 문헌 그대로)
const MOUNTS = [
  { name: '금성구(金星丘)', at: '엄지 뿌리, 생명선 안쪽의 두툼한 살', theme: '애정·건강·가족애·생활력',
    read: '두툼하고 탄력 있으면 정이 많고 사랑과 활력이 넘치며 가족애가 깊습니다. 밋밋하면 애정 표현이 담백하고 냉철한 편 — 표현을 더하면 관계가 따뜻해집니다.' },
  { name: '목성구(木星丘)', at: '검지 뿌리', theme: '자존심·야망·지도력',
    read: '발달하면 자기 확신과 리더십·명예욕이 강합니다. 약하면 겸손하되 자기 주장을 조금 세우면 좋습니다.' },
  { name: '토성구(土星丘)', at: '중지 뿌리', theme: '인내·사색·고독·신중',
    read: '발달하면 진중하고 책임감이 강하며 학문·연구에 어울립니다. 지나치면 고독을 즐기니 사람과의 온기를 잊지 마세요.' },
  { name: '태양구(太陽丘)', at: '약지 뿌리', theme: '재능·인기·예술·성공',
    read: '발달하면 예술적 감각과 인기·명성운이 있고 밝은 매력을 지닙니다. 태양선(약지 밑 세로선)이 함께 뚜렷하면 성공운을 돕습니다.' },
  { name: '수성구(水星丘)', at: '소지 뿌리', theme: '사교·언변·상업·재물',
    read: '발달하면 말솜씨와 사업 수완·순발력이 좋아 장사·소통의 재능이 있습니다.' },
  { name: '월구(月丘)', at: '손목 쪽 소지 아래', theme: '상상력·감수성·직관',
    read: '발달하면 상상력과 예술·직관이 풍부하고 여행·물과 인연이 있습니다. 감성이 앞설 수 있으니 현실 감각을 곁들이면 좋습니다.' },
];
function readMounts() { return MOUNTS; }

// 보조선 — 태양선·결혼선·자녀선·건강선 (전통 의미 + 직접 보는 법)
const SUBLINES = [
  { name: '태양선(太陽線·성공선)', at: '약지 아래로 오르는 세로선', theme: '인기·명예·성공·재능',
    how: '뚜렷하고 길수록 인기와 명성·성공운이 좋습니다. 없거나 옅어도 노력으로 만들어가는 사람이 많으니 낙심할 것 없습니다.' },
  { name: '결혼선(結婚線)', at: '소지 아래, 감정선 위의 짧은 가로선', theme: '배우자·결혼·애정 인연',
    how: '길고 곧게 뻗으면 배우자와 인연이 깊고 애정이 오래갑니다. 여러 줄이면 정이 많고 인연이 다양, 끝이 갈라지거나 아래로 처지면 관계에 더 정성을 들이라는 신호로 봅니다.' },
  { name: '자녀선(子女線)', at: '결혼선 위로 선 짧은 세로 잔선', theme: '자녀·아랫대의 인연',
    how: '결혼선 위의 뚜렷한 세로 잔선을 자녀의 인연으로 봅니다. 선명할수록 자녀와의 정이 깊다고 하나, 잔선이라 사진 판별이 어려우니 직접 확인하세요.' },
  { name: '건강선(健康線)', at: '새끼손가락 쪽에서 손목으로 내려오는 선', theme: '건강·체질',
    how: '이 선이 아예 없으면 오히려 건강하다고 봅니다. 끊기거나 구불거리면 소화·기력을 살피라는 신호로 읽습니다.' },
];
function readSubLines() { return SUBLINES; }

// 관계운(緣) — 손금으로 보는 부부·자녀·부모형제·가족
function readPalmRelations(m, clarity, gender) {
  const male = gender === 'M';
  const heart = clarity ? clarity.heart : 1;
  const warm = heart >= 1.15 ? 2 : (heart <= 0.8 ? 0 : 1);
  const openThumb = m.thumbAngle >= 50;
  const R = [];
  // 부부·배우자
  R.push({ who: '부부 · 배우자운', seat: '결혼선 · 감정선 · 금성구',
    text: `배우자 인연은 <b>결혼선</b>(소지 아래 가로선)과 <b>감정선</b>, 애정을 담는 <b>금성구</b>(엄지 뿌리)로 봅니다. ` +
      ['감정선이 담백하게 잡혀, 애정을 안으로 간직하는 깊은 정의 소유자입니다. 배우자에게 마음을 자주 말로 표현하면 관계가 더 단단해집니다. ',
       '감정선이 무던해 애정과 이성의 균형이 좋습니다. 배우자와 안정적으로 정을 쌓아가는 상입니다. ',
       '감정선이 뚜렷해 정이 깊고 애정 표현이 따뜻합니다. 배우자에게 헌신하는 만큼 사랑받는 인연입니다. '][warm] +
      (openThumb ? '엄지가 시원하게 벌어져 금성구가 열린 편 — 애정이 넉넉하고 가정에 헌신적입니다.'
                 : '엄지를 몸쪽으로 모으는 편이라 애정이 은근하고 진국입니다. 표현을 더하면 배우자가 사랑을 더 느낍니다.') +
      ` ${male ? '남성은 결혼선이 곧고 길면 처복(妻福)이 좋다고 봅니다.' : '여성은 결혼선이 선명하고 흐트러지지 않으면 배우자 인연이 안정적이라 봅니다.'}` });
  // 자녀
  R.push({ who: '자녀운', seat: '자녀선 · 금성구',
    text: '자녀 인연은 <b>결혼선 위의 세로 잔선(자녀선)</b>과 <b>금성구</b>로 봅니다. ' +
      (openThumb ? '금성구가 넉넉해 자녀·가족에게 쏟는 정과 활력이 크고, 따뜻한 가정을 꾸리는 힘이 있습니다. '
                 : '금성구가 단단해 자녀에게 책임감 있게 헌신하는 형입니다. 애정을 자주 표현하면 정이 더 깊어집니다. ') +
      '자녀선은 아주 가는 선이라 사진 판별이 어렵습니다 — 밝은 곳에서 결혼선 위를 직접 살펴보세요.' });
  // 부모·형제·가족
  R.push({ who: '부모 · 형제 · 가족운', seat: '생명선 안쪽 · 금성구',
    text: '가족·부모·형제의 인연은 <b>생명선</b>과 그 안쪽 <b>금성구</b>, 생명선 안의 <b>영향선(세로 잔선)</b>으로 봅니다. ' +
      ['생명선이 옅은 편이라 가족과 담백하되, 스스로 일가를 이루는 독립심이 강합니다. ',
       '생명선이 무던해 가족과의 인연이 안정적이고 뿌리가 든든합니다. ',
       '생명선이 뚜렷하고 금성구가 실해, 가족애가 깊고 부모·형제의 정이 두터운 상입니다. '][clarity ? (clarity.life>=1.15?2:(clarity.life<=0.8?0:1)) : 1] +
      '생명선 안쪽으로 나란한 세로 잔선(영향선)이 보이면 가까이서 돕는 가족·귀인의 인연으로 봅니다.' });
  return R;
}

function interpret(right, left, gender) {
  const main = right || left;
  if (!main || !main.ok) return { ok: false };
  const hand = classifyHand(main.metrics);
  const fingers = readFingers(main.metrics);
  const lines = readLines(main.lines);
  const mounts = readMounts();
  const subLines = readSubLines();
  const relations = readPalmRelations(main.metrics, main.lines, gender);
  const decl = `${hand.info.shape}의 ${hand.info.key}. ${main.metrics.fingerVsPalm >= 0.78 ? '섬세하고 사색적인' : main.metrics.fingerVsPalm <= 0.68 ? '직관적이고 행동적인' : '균형 잡힌'} 기질이 손에 담겨 있습니다.`;
  return { ok: true, hand, fingers, lines, mounts, subLines, relations, decl,
    metrics: main.metrics, clarity: main.lines,
    handedNote: right && left ? '두 손 모두 검출되어, 오른손(현재·노력)과 왼손(타고난 바탕)을 함께 참고했습니다.'
      : (main.handed ? `${main.handed === 'Right' ? '오른손' : '왼손'} 기준으로 읽었습니다.` : '') };
}

/* ══════════════ 4. 렌더 ══════════════ */
const tag = t => `<span class="tag">${t}</span>`;

// 정밀 측정 데이터 패널(전문가용)
function palmTable(m, c) {
  const CL = v => v == null ? '—' : (v >= 1.15 ? '뚜렷' : (v <= 0.8 ? '흐림' : '보통'));
  const rows = [
    ['손바닥 세로:가로', r2(m.palmRatio), '1.0~1.2(각손)·1.2↑(긴손)', m.palmRatio>=1.15?'긴 손바닥':'각진 손바닥'],
    ['손가락/손바닥 길이', r2(m.fingerVsPalm), '0.68~0.80', m.fingerVsPalm>=0.80?'긴 손가락(사색)':(m.fingerVsPalm<=0.68?'짧은 손가락(행동)':'균형')],
    ['검지:약지(2D:4D)', r2(m.d2d4), '~1.0', m.d2d4>=1.0?'검지 긺(신중·주장)':(m.d2d4<=0.95?'약지 긺(과감)':'비슷')],
    ['소지/약지 길이', r2(m.pinkyVsRing), '~0.75', m.pinkyVsRing>=0.78?'소지 긺(언변 좋음)':'표준'],
    ['엄지 길이/손바닥', r2(m.thumbVsPalm), '0.4~0.5', m.thumbVsPalm>=0.5?'긴 엄지(의지 강)':'표준'],
    ['엄지 벌어짐 각도', Math.round(m.thumbAngle)+'°', '35~55°', m.thumbAngle>=55?'넓음(개방)':(m.thumbAngle<=35?'좁음(신중)':'보통')],
    ['생명선 선명도', c?r2(c.life):'—', '뚜렷할수록 활력', CL(c&&c.life)+'(추정)'],
    ['지능선 선명도', c?r2(c.head):'—', '뚜렷할수록 명료', CL(c&&c.head)+'(추정)'],
    ['감정선 선명도', c?r2(c.heart):'—', '뚜렷할수록 정 깊음', CL(c&&c.heart)+'(추정)'],
    ['운명선 선명도', c?r2(c.fate):'—', '뚜렷할수록 방향 확고', CL(c&&c.fate)+'(추정)'],
  ];
  return `<div class="mtab-wrap"><table class="mtab"><thead><tr><th>항목</th><th>측정값</th><th>표준·이상</th><th>판정</th></tr></thead><tbody>${
    rows.map(r=>`<tr><td>${r[0]}</td><td class="v">${r[1]}</td><td class="j">${r[2]}</td><td>${r[3]}</td></tr>`).join('')
  }</tbody></table></div>`;
}

function reportHtml(res, thumbs) {
  if (!res || !res.ok) return '';
  const h = [];
  if (thumbs && thumbs.length) {
    h.push(`<div class="rpt-sec"><h4>검출 결과 — 내 손에서 잡은 점과 손금</h4>
      <div class="face-thumbs">${thumbs.map(t => `<figure><img src="${t.url}"/><figcaption>${t.label}</figcaption></figure>`).join('')}</div>
      <p class="sub">파란 점·뼈대는 손 관절 21개, 금빛 점은 손바닥에서 찾은 손금선(에지)입니다. 손 모양·손가락 비율은 이 점들로 정확히 잰 값이고, 손금선은 조명·각도의 영향을 받는 <b>추정</b>이라 사진 위에 표시해 직접 확인하시도록 했습니다.</p></div>`);
  }
  if (res.metrics) {
    h.push(`<div class="rpt-sec"><h4>정밀 측정값 — 표준 대비 판정표</h4>
      ${palmTable(res.metrics, res.clarity)}
      <p class="sub">손 모양·손가락은 21개 관절점에서 픽셀로 잰 객관 수치이고, 손금선 선명도는 에지 분석 기반 <b>추정</b>입니다. 상담 시 이 수치를 근거로 설명하실 수 있습니다.</p></div>`);
  }
  h.push(`<div class="rpt-sec"><h4>손의 유형 — ${res.hand.info.key}</h4>
    <p>${tag(res.hand.info.oheng)}${tag(res.hand.info.shape)}${tag('손바닥 세로/가로 ' + res.hand.metrics.palmRatio)}${tag('손가락/손바닥 ' + res.hand.metrics.fingerVsPalm)}</p>
    <p>${res.hand.info.text}</p></div>`);
  h.push(`<div class="rpt-sec"><h4>손가락과 엄지 — 하나하나 뜯어보기</h4>
    ${res.fingers.map(f => `<p>· <b>${f.part}</b> ${tag(f.tag)} <span class="sub">${f.metric}</span><br/>${f.text}</p>`).join('')}</div>`);
  h.push(`<div class="rpt-sec"><h4>손금 주요선 — 생명·지능·감정·운명</h4>
    ${res.lines.map(l => `<div class="palace"><div class="p-name"><b>${l.name}</b> ${tag(l.tag)}</div>
      <div class="sub">${l.at} · ${l.theme}</div><p>${l.text}</p><p class="sub">📖 읽는 법 — ${l.how}</p></div>`).join('')}
    <p class="sub">손금선 자동 검출은 사진 품질에 민감합니다. '뚜렷/흐림'은 에지 선명도 기반 <b>추정</b>이며, 위 '읽는 법'으로 직접 보시는 것을 함께 권합니다.</p></div>`);
  // 보조선
  if (res.subLines) {
    h.push(`<div class="rpt-sec"><h4>보조선 — 태양·결혼·자녀·건강선</h4>
      ${res.subLines.map(s => `<p>· <b>${s.name}</b> <span class="sub">${s.at} · ${s.theme}</span><br/>${s.how}</p>`).join('')}
      <p class="sub">이 잔선들은 아주 가늘어 사진 자동 판별이 어렵습니다. 밝은 곳에서 위치를 직접 보시며 참고하세요.</p></div>`);
  }
  // 언덕(丘)
  if (res.mounts) {
    h.push(`<div class="rpt-sec"><h4>손바닥 언덕(丘) — 여섯 언덕의 기운</h4>
      ${res.mounts.map(mo => `<p>· <b>${mo.name}</b> <span class="sub">${mo.at} · ${mo.theme}</span><br/>${mo.read}</p>`).join('')}
      <p class="sub">언덕의 '두툼함'은 입체라 사진 측정이 제한됩니다. 손바닥을 만져보며 어느 언덕이 도톰한지 직접 확인하면 더 정확합니다.</p></div>`);
  }
  // 관계운
  if (res.relations) {
    h.push(`<div class="rpt-sec rel-sec"><h4>관계운(緣) — 손이 말하는 애정과 가족</h4>
      <p class="sub">사주가 인연의 기운을, 관상이 인연의 자리를 본다면, 손금은 <b>애정의 결</b>을 봅니다. 감정선·금성구·결혼선이 배우자·자녀·가족과의 정을 말해 줍니다.</p>
      ${res.relations.map(r => `<div class="palace"><div class="p-name"><b>${r.who}</b> <span class="tag">${r.seat}</span></div><p>${r.text}</p></div>`).join('')}</div>`);
  }
  h.push(`<div class="rpt-sec"><h4>손금 총평</h4><p><b>${res.decl}</b></p>
    ${res.handedNote ? `<p class="sub">${res.handedNote}</p>` : ''}
    <p class="sub">수상학에서 손금은 고정된 운명이 아니라, 지금의 기질과 삶의 결을 비추는 지도입니다. 손금은 마음과 생활에 따라 조금씩 변한다고도 하니, 자신을 이해하는 참고로 삼으세요.</p></div>`);
  return h.join('');
}

function summaryHtml(res) {
  if (!res || !res.ok) return '';
  return `<b>${res.hand.info.key}</b> · ${res.hand.info.shape}<br/>
    <span style="font-size:15px">${res.decl}</span>
    <div style="margin-top:10px; font-size:15px">손금 3대선(추정): ${res.lines.map(l => l.name.slice(0,3) + ' ' + l.tag.replace('(추정)','')).join(' · ')}</div>`;
}

global.PalmReader = PalmReader;
global.PalmRead = { measureHand, classifyHand, interpret, reportHtml, summaryHtml,
  markMeasured(m){ return { ok:true, metrics:measureHand(m.lm, m.W, m.H) }; } };

})(window);
