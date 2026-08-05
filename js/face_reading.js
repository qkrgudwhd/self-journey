/* ============================================================
   나를 찾는 여정 — 관상(면상) 엔진  face_reading.js
   ------------------------------------------------------------
   · 검출: MediaPipe Face Landmarker (468점, Apache-2.0, 로컬/오프라인)
   · 원칙: 사진은 브라우저 안에서만 처리 — 어디에도 전송/저장하지 않음
   · 구조: [측정] 얼굴 기하(삼정·오행형·대칭·이목구비) = 객관·재현 가능
           [해석] 전통 관상학(십이궁·오악·삼정)의 상징적 풀이 = 문화적 참고
   · 전역 노출: window.FaceReader (검출), window.FaceRead (해석/렌더)
   ============================================================ */
(function (global) {
'use strict';

// ── MediaPipe 파일 위치(자가포함) ─────────────────────────
// ⚠ classic 스크립트의 동적 import()는 비동기 콜백 안에서 호출되면
//    "현재 스크립트"를 잃어 기준 URL이 about:blank가 된다(상대경로 실패).
//    → 스크립트 로드 시점(동기)에 자기 위치로부터 '절대 URL'을 계산해 둔다.
const _self = (document.currentScript && document.currentScript.src) || '';
let _jsDir, _root;
if (_self) {
  _jsDir = _self.replace(/[?#].*$/, '').replace(/\/[^/]*$/, '/');  // …/js/
  _root  = _jsDir.replace(/[^/]+\/$/, '');                         // …/(사이트 루트/하위경로)
} else {                                                           // 폴백
  _jsDir = new URL('js/', document.baseURI).href;
  _root  = new URL('./', document.baseURI).href;
}
const BUNDLE = _jsDir + 'vendor/vision_bundle.mjs';   // 절대 URL
const WASM   = _root + 'models/wasm';                 // 절대 URL
const MODEL  = _root + 'models/face_landmarker.task'; // 절대 URL

// ── 랜드마크 인덱스(468 캐노니컬 페이스메시) ──────────────
const IX = {
  top: 10, chin: 152,               // 얼굴 상단(발제 근사)·턱끝
  cheekR: 234, cheekL: 454,         // 광대 최외곽(가장 넓은 폭)
  jawR: 172, jawL: 397,             // 아래턱(하관) 폭
  templeR: 21, templeL: 251,        // 관자놀이(이마 폭)
  browInR: 107, browInL: 336,       // 눈썹 안쪽 끝(印堂 경계)
  browPkR: 105, browPkL: 334,       // 눈썹 산(눈썹선 기준)
  browOutR: 46, browOutL: 276,      // 눈썹 바깥 끝
  eyeOutR: 33, eyeInR: 133,         // 오른눈 바깥/안쪽
  eyeInL: 362, eyeOutL: 263,        // 왼눈 안쪽/바깥
  eyeTopR: 159, eyeBotR: 145,       // 오른눈 위/아래(눈높이)
  eyeTopL: 386, eyeBotL: 374,       // 왼눈 위/아래
  noseBridge: 168, noseTip: 4, noseBase: 2,   // 산근·준두·코밑
  alaR: 129, alaL: 358,             // 콧방울(코 폭)
  mouthR: 61, mouthL: 291,          // 입꼬리
  lipTop: 0, lipInTop: 13, lipInBot: 14, lipBot: 17,  // 입술
  philtrumTop: 2, philtrumBot: 0,   // 인중(코밑→윗입술)
};

// ── 벡터 도우미 ───────────────────────────────────────────
const px = (lm, W, H, i) => ({ x: lm[i].x * W, y: lm[i].y * H });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
// 점 P에서 직선 AB까지의 수직거리(부호: 왼쪽+/오른쪽-)
function sideDist(P, A, B) {
  const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
  return ((P.x - A.x) * dy - (P.y - A.y) * dx) / L;  // 부호 있는 거리
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;
const pct1 = v => Math.round(v * 1000) / 10;

/* ══════════════════════════════════════════════════════════
   1. 검출기 — MediaPipe 로더 & 프레임 검출
   ══════════════════════════════════════════════════════════ */
const FaceReader = {
  _landmarker: null,
  _loading: null,
  ready() { return !!this._landmarker; },

  // 지연 로딩(관상 화면 진입 시 1회). 진행 콜백(onStep) 지원.
  async load(onStep) {
    if (this._landmarker) return this._landmarker;
    if (this._loading) return this._loading;
    this._loading = (async () => {
      onStep && onStep('얼굴 인식 엔진을 여는 중…');
      const vision = await import(BUNDLE);   // 절대 URL — about:blank 기준 문제 회피
      const { FilesetResolver, FaceLandmarker } = vision;
      onStep && onStep('검출 런타임을 준비하는 중…');
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      onStep && onStep('관상 모델을 불러오는 중… (최초 1회)');
      this._landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL },
        runningMode: 'IMAGE',
        numFaces: 1,
        minFaceDetectionConfidence: 0.3,
        minFacePresenceConfidence: 0.3,
        outputFaceBlendshapes: false,
      });
      return this._landmarker;
    })();
    return this._loading;
  },

  // imgEl(HTMLImageElement, 로드 완료 상태) → 검출. 성공 시 landmarks 반환.
  detect(imgEl) {
    if (!this._landmarker) throw new Error('엔진이 아직 준비되지 않았습니다.');
    const res = this._landmarker.detect(imgEl);
    if (!res.faceLandmarks || !res.faceLandmarks.length) return null;
    return res.faceLandmarks[0];   // [{x,y,z}, ...] (정규화 0~1)
  },

  // 검출 점을 캔버스에 그려 "정말 내 얼굴을 찾았는지" 눈으로 검증
  drawOverlay(canvas, imgEl, lm, opts) {
    opts = opts || {};
    const W = imgEl.naturalWidth, H = imgEl.naturalHeight;
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d');
    g.drawImage(imgEl, 0, 0, W, H);
    if (!lm) return;
    // 반투명 특징점
    g.fillStyle = opts.dot || 'rgba(231,196,107,0.85)';
    const rDot = Math.max(1, Math.round(Math.min(W, H) / 260));
    for (const p of lm) { g.beginPath(); g.arc(p.x * W, p.y * H, rDot, 0, 7); g.fill(); }
    // 주요 계측선(삼정·중심축)
    if (opts.guides !== false) {
      const P = i => px(lm, W, H, i);
      g.strokeStyle = 'rgba(127,196,224,0.9)'; g.lineWidth = Math.max(1, rDot);
      const line = (a, b) => { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); };
      const browY = (P(IX.browPkR).y + P(IX.browPkL).y) / 2;
      const L = P(IX.cheekR).x, R = P(IX.cheekL).x;
      g.setLineDash([rDot * 2, rDot * 2]);
      line({ x: L, y: P(IX.top).y }, { x: R, y: P(IX.top).y });     // 발제선
      line({ x: L, y: browY }, { x: R, y: browY });                 // 눈썹선
      line({ x: L, y: P(IX.noseBase).y }, { x: R, y: P(IX.noseBase).y }); // 코밑선
      line({ x: L, y: P(IX.chin).y }, { x: R, y: P(IX.chin).y });   // 턱끝선
      g.setLineDash([]);
      g.strokeStyle = 'rgba(231,138,166,0.9)';
      line(P(IX.noseBridge), P(IX.chin));                            // 중심축
    }
  },
};

/* ══════════════════════════════════════════════════════════
   2. 정면 계측 — 픽셀 기하로 객관 수치 산출
   ══════════════════════════════════════════════════════════ */
function measureFront(lm, W, H) {
  const P = i => px(lm, W, H, i);
  const top = P(IX.top), chin = P(IX.chin);
  const cheekR = P(IX.cheekR), cheekL = P(IX.cheekL);
  const browY = (P(IX.browPkR).y + P(IX.browPkL).y) / 2;
  const noseBaseY = P(IX.noseBase).y;

  const faceLen = chin.y - top.y;
  const faceWid = Math.abs(cheekL.x - cheekR.x);
  const foreheadW = Math.abs(P(IX.templeL).x - P(IX.templeR).x);
  const jawW = Math.abs(P(IX.jawL).x - P(IX.jawR).x);

  // ── 삼정(상·중·하) 세로 비율 ──
  const up = browY - top.y, midc = noseBaseY - browY, low = chin.y - noseBaseY;
  const t3 = up + midc + low || 1;
  const sam = { up: up / t3, mid: midc / t3, low: low / t3 };

  // ── 눈 계측 ──
  const eyeWR = dist(P(IX.eyeOutR), P(IX.eyeInR));
  const eyeWL = dist(P(IX.eyeOutL), P(IX.eyeInL));
  const eyeW = (eyeWR + eyeWL) / 2;
  const eyeHR = dist(P(IX.eyeTopR), P(IX.eyeBotR));
  const eyeHL = dist(P(IX.eyeTopL), P(IX.eyeBotL));
  const eyeOpen = ((eyeHR + eyeHL) / 2) / (eyeW || 1);       // 눈높이/눈너비
  const interEye = dist(P(IX.eyeInR), P(IX.eyeInL));          // 두 눈 사이(안격)
  const eyeTilt = Math.atan2(P(IX.eyeOutL).y - P(IX.eyeOutR).y,
                             P(IX.eyeOutL).x - P(IX.eyeOutR).x) * 180 / Math.PI;

  // ── 눈썹 ──
  const browW = (dist(P(IX.browInR), P(IX.browOutR)) + dist(P(IX.browInL), P(IX.browOutL))) / 2;
  const browEyeRatio = browW / (eyeW || 1);                   // 눈썹길이/눈길이
  const interBrow = dist(P(IX.browInR), P(IX.browInL));       // 미간(印堂)

  // ── 코 ──
  const noseLen = dist(P(IX.noseBridge), P(IX.noseBase));
  const noseW = dist(P(IX.alaR), P(IX.alaL));                 // 콧방울 폭
  const noseWFace = noseW / (faceWid || 1);
  const noseVsInter = noseW / (interEye || 1);                // 콧방울/안격

  // ── 입 ──
  const mouthW = dist(P(IX.mouthR), P(IX.mouthL));
  const lipH = dist(P(IX.lipTop), P(IX.lipBot));
  const lipThick = lipH / (mouthW || 1);
  const mouthVsNose = mouthW / (noseW || 1);                  // 입폭/코폭
  const mouthTilt = Math.atan2(P(IX.mouthL).y - P(IX.mouthR).y,
                               P(IX.mouthL).x - P(IX.mouthR).x) * 180 / Math.PI;

  // ── 인중·턱 ──
  const philtrum = dist(P(IX.philtrumTop), P(IX.philtrumBot));
  const philtrumFace = philtrum / (faceLen || 1);
  const jawTaper = jawW / (faceWid || 1);                     // 하관/광대

  // ── 좌우 대칭 ── (중심축 = 산근→턱끝)
  const A = P(IX.noseBridge), B = P(IX.chin);
  const pairs = [
    [IX.eyeOutR, IX.eyeOutL], [IX.eyeInR, IX.eyeInL], [IX.cheekR, IX.cheekL],
    [IX.jawR, IX.jawL], [IX.mouthR, IX.mouthL], [IX.alaR, IX.alaL],
    [IX.browPkR, IX.browPkL], [IX.templeR, IX.templeL],
  ];
  let asym = 0;
  for (const [ri, li] of pairs) {
    const dR = Math.abs(sideDist(P(ri), A, B));
    const dL = Math.abs(sideDist(P(li), A, B));
    asym += Math.abs(dL - dR);
  }
  asym = asym / pairs.length / (faceWid || 1);               // 평균 편차/얼굴폭
  const symmetry = clamp(100 - asym * 320, 40, 99.5);        // 대칭 점수(%)

  return {
    ok: true, W, H,
    faceLen, faceWid, foreheadW, jawW,
    ratioLW: faceLen / (faceWid || 1),
    foreJaw: foreheadW / (jawW || 1),
    jawTaper,
    sam,
    eye: { w: eyeW, open: eyeOpen, inter: interEye, interVsEye: interEye / (eyeW || 1), tilt: eyeTilt },
    brow: { w: browW, vsEye: browEyeRatio, inter: interBrow, interVsEye: interBrow / (eyeW || 1) },
    nose: { len: noseLen, w: noseW, vsFace: noseWFace, vsInter: noseVsInter, lenVsFace: noseLen / (faceLen || 1) },
    mouth: { w: mouthW, lipThick, vsNose: mouthVsNose, tilt: mouthTilt },
    philtrum: philtrumFace,
    symmetry,
  };
}

/* ══════════════════════════════════════════════════════════
   3. 측면 계측 — 옆얼굴(있을 때) 보조 프로파일
   정면 대비 검출이 어려워, 잡히면 코 돌출·이마 경사·턱 위치를 보조로 제공
   ══════════════════════════════════════════════════════════ */
function measureProfile(lm, W, H, view) {
  const P = i => px(lm, W, H, i);
  const top = P(IX.top), chin = P(IX.chin), bridge = P(IX.noseBridge);
  const tip = P(IX.noseTip), base = P(IX.noseBase), mouthTop = P(IX.lipTop);
  const faceLen = Math.abs(chin.y - top.y) || 1;
  // 얼굴 정면축(코뿌리→턱끝)에서 코끝이 앞으로 튀어나온 정도
  const noseProj = Math.abs(sideDist(tip, bridge, chin)) / faceLen;      // 코 돌출
  const mouthProj = Math.abs(sideDist(mouthTop, bridge, chin)) / faceLen; // 입 돌출
  // 이마 경사: (발제→코뿌리) 선이 수직에서 기운 각도
  const foreheadSlope = Math.atan2(Math.abs(bridge.x - top.x), Math.abs(bridge.y - top.y)) * 180 / Math.PI;
  // 턱 돌출/후퇴: 턱끝이 코밑 수직선 대비 앞/뒤
  const chinRel = sideDist(chin, base, { x: base.x, y: base.y + faceLen }) / faceLen;
  return { ok: true, view, noseProj, mouthProj, foreheadSlope, chinRel: Math.abs(chinRel) };
}

/* ══════════════════════════════════════════════════════════
   4. 해석 — 전통 관상학(삼정·오행형·오악·십이궁)
   측정 수치를 등급화하고, 등급마다 고전 해석 문장을 조립
   ══════════════════════════════════════════════════════════ */

// 값 v를 세 구간으로 나눠 [저/중/고] 중 하나 반환
function grade(v, lo, hi) { return v < lo ? 0 : (v > hi ? 2 : 1); }

// ── 4-1. 오행 얼굴형 ──
const OHENG_FACE = {
  목: { hanja: '木', key: '목형(木形)', shape: '갸름하고 긴 얼굴',
    text: '위아래로 길고 갸름한 목(木)의 상입니다. 나무가 곧게 자라듯 성정이 반듯하고 생각이 깊으며, 인자하고 학문·기획에 어울립니다. 자존심이 서고 원칙을 지키는 힘이 강점이나, 지나치면 고집과 융통성 부족으로 흐르니 유연함을 곁들이면 크게 됩니다.' },
  화: { hanja: '火', key: '화형(火形)', shape: '이마가 넓고 턱이 좁은 역삼각',
    text: '위는 넓고 아래로 뾰족해지는 화(火)의 상입니다. 머리 회전이 빠르고 감각이 예민하며 열정과 표현력이 뛰어나, 예술·발표·순발력의 자리에서 빛납니다. 불길처럼 타오르는 만큼 기복이 있으니, 뒷심과 인내를 기르면 재능이 오래 갑니다.' },
  토: { hanja: '土', key: '토형(土形)', shape: '두텁고 넓적한 얼굴',
    text: '가로로 넉넉하고 살집이 두터운 토(土)의 상입니다. 땅처럼 믿음직하고 포용력이 크며, 신의가 두터워 사람이 따릅니다. 재물을 담는 그릇이 크고 뒷심이 강한 반면, 무겁고 느릴 수 있으니 결단의 속도를 더하면 좋습니다.' },
  금: { hanja: '金', key: '금형(金形)', shape: '이마·턱이 각진 네모꼴',
    text: '윤곽이 각지고 상하 폭이 고른 금(金)의 상입니다. 의지가 굳고 결단력·추진력이 강하며 원칙과 의리를 지킵니다. 쇠처럼 단단해 큰일을 밀어붙이는 힘이 있으나, 지나치면 강직함이 날카로움이 되니 부드러운 표현을 더하면 존경을 얻습니다.' },
  수: { hanja: '水', key: '수형(水形)', shape: '둥글고 통통한 얼굴',
    text: '전체가 둥글고 부드러운 수(水)의 상입니다. 물처럼 지혜롭고 융통성이 뛰어나며, 사교적이고 임기응변에 능해 사람과 재물이 두루 모입니다. 다만 물이 흩어지듯 마음이 여러 곳으로 갈 수 있으니, 중심을 지키면 복이 깊어집니다.' },
};
function classifyOheng(f) {
  const s = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const R = f.ratioLW;           // 세로/가로 (클수록 길다)
  s.목 += clamp((R - 1.30) * 6, 0, 3);
  s.토 += clamp((1.28 - R) * 6, 0, 2.4);
  s.수 += clamp((1.30 - R) * 4, 0, 1.8);
  s.화 += clamp((f.foreJaw - 1.06) * 8, 0, 3);      // 이마>턱
  s.금 += clamp((f.jawTaper - 0.80) * 9, 0, 2.6);   // 하관이 광대만큼 넓다(각짐)
  s.토 += clamp((f.jawTaper - 0.82) * 5, 0, 1.4);
  s.수 += clamp((0.80 - f.jawTaper) * 4, 0, 1.4);   // 하관이 좁다(둥근·갸름)
  // 정규화 순위
  const rank = Object.entries(s).sort((a, b) => b[1] - a[1]);
  const primary = rank[0][0], secondary = rank[1][0];
  return { scores: s, primary, secondary, info: OHENG_FACE[primary], secInfo: OHENG_FACE[secondary] };
}

// ── 4-2. 삼정 해석 ──
function readSamjeong(f) {
  const s = f.sam, P = v => pct1(v);
  const parts = [
    { k: '상정(上停)', v: s.up, org: '이마 — 발제에서 눈썹까지', life: '초년운(15~30세)·지혜와 부모·윗사람 복',
      hi: '이마가 넓고 반듯해 총명하고 일찍 두각을 나타내며 윗사람의 덕이 있습니다.',
      mid: '이마가 균형 잡혀 초년의 배움과 성장이 무던하게 흐릅니다.',
      lo: '이마가 좁은 편이라 초년에 스스로 길을 여는 고생이 있으나, 그만큼 자수성가의 힘이 큽니다.' },
    { k: '중정(中停)', v: s.mid, org: '눈썹에서 코끝까지', life: '중년운(31~50세)·의지와 실행·사회적 성취',
      hi: '중정이 길고 코가 실해 중년의 활동력과 자기 주장이 강하고 사회적 성취가 큽니다.',
      mid: '중정이 알맞아 중년의 실행과 재물 흐름이 안정적입니다.',
      lo: '중정이 짧은 편이라 추진력을 의식적으로 기르면 중년의 결실이 커집니다.' },
    { k: '하정(下停)', v: s.low, org: '코끝에서 턱끝까지', life: '말년운(51세~)·정·애정·아랫사람과 재물의 갈무리',
      hi: '하정이 두터워 말년이 넉넉하고 정이 깊으며 아랫사람과 자손의 덕을 봅니다.',
      mid: '하정이 균형 잡혀 말년의 안정과 인복이 무던합니다.',
      lo: '하정이 얇은 편이라 말년의 여유를 미리 준비하면 좋으며, 담백하고 이지적인 인상을 줍니다.' },
  ];
  // 가장 발달/미약
  const sorted = [...parts].sort((a, b) => b.v - a.v);
  const strongest = sorted[0], weakest = sorted[2];
  const rows = parts.map(p => {
    const g = p.v > 0.36 ? 'hi' : (p.v < 0.30 ? 'lo' : 'mid');
    return { key: p.k, org: p.org, life: p.life, pct: P(p.v), tag: g === 'hi' ? '발달' : (g === 'lo' ? '섬약' : '균형'), text: p[g] };
  });
  const balanced = (Math.max(s.up, s.mid, s.low) - Math.min(s.up, s.mid, s.low)) < 0.06;
  const summary = balanced
    ? '세 정(停)이 고르게 균형을 이룹니다. 초년·중년·말년의 기복이 적어, 한평생 흐름이 안정된 귀격(貴格)의 바탕입니다.'
    : `${strongest.k.slice(0, 2)}이 가장 발달하고 ${weakest.k.slice(0, 2)}이 상대적으로 여립니다. 삶의 무게중심이 ${strongest.life.split('·')[0]}에 실립니다.`;
  return { rows, summary, balanced };
}

// ── 4-3. 십이궁(측정 가능한 궁 중심) ──
function readTwelvePalaces(f) {
  const G = [];
  // 命宮(명궁) — 미간(印堂)
  {
    const g = grade(f.brow.interVsEye, 0.9, 1.25);
    G.push({ name: '命宮 · 명궁', at: '미간(양 눈썹 사이 印堂)', theme: '한 사람의 기운이 모이는 중심 · 마음 그릇',
      tag: ['좁음', '알맞음', '넓음'][g],
      text: [
        '미간이 다소 좁아 감수성이 예민하고 집중력이 강합니다. 생각이 많은 만큼, 사소한 근심을 흘려보내는 여유를 기르면 운이 트입니다.',
        '미간이 손가락 하나 반 정도로 알맞아, 마음이 트여 있고 판단이 균형 잡혀 있습니다. 대인관계의 기본기가 좋습니다.',
        '미간이 넓어 성격이 대범하고 낙천적이며 포용력이 큽니다. 시야가 넓어 큰 그림을 그리는 자리에 어울립니다.',
      ][g] });
  }
  // 官祿宮(관록궁) — 이마(상정)
  {
    const g = f.sam.up > 0.36 ? 2 : (f.sam.up < 0.30 ? 0 : 1);
    G.push({ name: '官祿宮 · 관록궁', at: '이마 중앙', theme: '직업·명예·사회적 지위',
      tag: ['좁음', '보통', '넓음'][g],
      text: [
        '이마가 좁은 편이라 초년의 관운은 스스로 개척하는 형입니다. 실력을 꾸준히 쌓으면 중년 이후 자리를 잡습니다.',
        '이마가 반듯해 직업운이 무던하게 흐릅니다. 맡은 자리에서 신뢰를 얻는 형입니다.',
        '이마가 넓고 훤해 명예운과 관운이 좋습니다. 조직·공직·전문직에서 이름을 세우기 좋은 상입니다.',
      ][g] });
  }
  // 財帛宮(재백궁) — 코(준두·콧방울)
  {
    const g = grade(f.nose.vsInter, 0.9, 1.15);
    G.push({ name: '財帛宮 · 재백궁', at: '코(준두와 콧방울)', theme: '재물의 그릇 · 중년의 재복',
      tag: ['아담', '실함', '큼'][g],
      text: [
        '코와 콧방울이 아담해 재물을 크게 벌이기보다 알뜰히 지키는 형입니다. 안정적 관리가 재복의 열쇠입니다.',
        '준두가 둥글고 콧방울이 실해 재물을 담는 그릇이 좋습니다. 벌고 지키는 균형이 잡혀 중년 재복이 안정적입니다.',
        '코가 크고 콧방울이 넉넉해 재물운이 강합니다. 큰 재물을 다루는 사업·투자의 자리에 어울립니다.',
      ][g] });
  }
  // 兄弟宮(형제궁) — 눈썹
  {
    const g = grade(f.brow.vsEye, 1.0, 1.25);
    G.push({ name: '兄弟宮 · 형제궁', at: '눈썹', theme: '형제·동료·대인관계',
      tag: ['짧음', '알맞음', '긺'][g],
      text: [
        '눈썹이 눈보다 짧은 편이라 폭넓은 무리보다 소수의 깊은 인연을 소중히 하는 형입니다.',
        '눈썹 길이가 눈과 잘 어울려 형제·동료 간 정이 두텁고 대인관계가 원만합니다.',
        '눈썹이 눈보다 길고 시원해 형제·친구의 덕이 있고 대인관계의 폭이 넓습니다.',
      ][g] });
  }
  // 田宅宮(전택궁) — 눈두덩(눈-눈썹 사이)
  {
    // 눈두덩 넓이는 눈썹선-눈 거리로 근사(여기선 눈 열림 대비 미간 넓이로 간접 추정)
    const g = grade(f.brow.interVsEye, 0.95, 1.2);
    G.push({ name: '田宅宮 · 전택궁', at: '눈두덩(눈과 눈썹 사이)', theme: '가정·부동산·정착',
      tag: ['좁음', '알맞음', '넓음'][g],
      text: [
        '눈두덩이 좁은 편이라 이동과 변화가 잦을 수 있습니다. 한곳에 뿌리내리려는 노력이 안정을 부릅니다.',
        '눈두덩이 알맞아 가정운이 무던하고, 살 자리를 스스로 마련하는 힘이 있습니다.',
        '눈두덩이 넓어 마음에 여유가 있고 가정·부동산의 복이 있습니다. 정착과 축적에 강한 상입니다.',
      ][g] });
  }
  // 妻妾宮/夫妻宮 — 눈꼬리(어미)
  {
    const g = f.eye.tilt > 3 ? 2 : (f.eye.tilt < -3 ? 0 : 1);
    G.push({ name: '夫妻宮 · 부부궁', at: '눈꼬리(어미·간문)', theme: '배우자·애정 인연',
      tag: ['내려감', '수평', '올라감'][g],
      text: [
        '눈꼬리가 부드럽게 내려간 상이라 정이 많고 상대를 품는 애정형입니다. 헌신하는 만큼 배우자 복이 따릅니다.',
        '눈꼬리가 수평으로 반듯해 애정 관계가 균형 잡혀 있습니다. 감정에 휘둘리지 않는 안정된 인연을 만듭니다.',
        '눈꼬리가 올라간 상이라 자기 주관이 뚜렷하고 매력이 강합니다. 서로 존중하는 짝을 만나면 관계가 활기찹니다.',
      ][g] });
  }
  // 疾厄宮(질액궁) — 산근(콧대 시작, 눈 사이)
  {
    const g = grade(f.nose.lenVsFace, 0.30, 0.36);
    G.push({ name: '疾厄宮 · 질액궁', at: '산근(두 눈 사이 콧대 시작점)', theme: '건강·활력·질병운',
      tag: ['낮음', '보통', '높음'][g],
      text: [
        '산근이 낮은 편이라 무리하면 기력이 쉬 떨어질 수 있습니다. 규칙적인 생활이 곧 건강의 재산입니다.',
        '산근이 무던해 기본 체력과 회복력이 안정적입니다. 큰 굴곡 없는 건강운입니다.',
        '산근이 높고 곧아 활력과 회복력이 좋습니다. 큰 병 없이 꾸준한 기운을 유지하는 상입니다.',
      ][g] });
  }
  // 子女宮(자녀궁) — 눈밑(와잠)
  {
    const g = grade(f.eye.open, 0.28, 0.40);
    G.push({ name: '子女宮 · 자녀궁', at: '눈 밑(와잠·누당)', theme: '자녀·후덕·정서',
      tag: ['담백', '보통', '도톰'][g],
      text: [
        '눈 밑이 담백해 감정을 안으로 갈무리하는 형입니다. 표현을 조금 더하면 자녀·아랫사람과의 정이 깊어집니다.',
        '눈 밑이 무던해 정서가 안정되어 있고 자녀운이 평온합니다.',
        '눈 밑(와잠)이 도톰해 정이 많고 자녀·후배를 아끼는 덕이 있습니다. 따뜻함이 복으로 돌아옵니다.',
      ][g] });
  }
  // 奴僕宮(노복궁) — 턱(지각)
  {
    const g = f.sam.low > 0.35 ? 2 : (f.sam.low < 0.30 ? 0 : 1);
    G.push({ name: '奴僕宮 · 노복궁', at: '턱(지각地閣)', theme: '아랫사람·말년의 터전·의지처',
      tag: ['갸름', '보통', '두터움'][g],
      text: [
        '턱이 갸름해 이지적이고 깔끔한 인상입니다. 사람을 가려 깊게 사귀며, 말년엔 정신적 가치를 좇습니다.',
        '턱이 무던해 말년의 터전과 아랫사람 복이 안정적입니다.',
        '턱이 두터워 아랫사람과 후배의 덕이 있고 말년의 터전이 넉넉합니다. 리더로서 사람을 품는 힘이 있습니다.',
      ][g] });
  }
  return G;
}

// ── 4-4. 이목구비 개별 해설 ──
function readFeatures(f) {
  const out = [];
  // 눈
  {
    const big = f.eye.w / f.faceWid;
    const g = grade(big, 0.20, 0.235);
    out.push({ part: '눈', tag: ['또렷·아담', '균형', '크고 시원'][g], metric: `눈 너비 ≈ 얼굴폭의 ${pct1(big)}%`,
      text: [
        '눈이 아담하고 또렷해 집중력이 강하고 속이 깊습니다. 관찰력과 신중함이 무기입니다.',
        '눈 크기가 균형 잡혀 감정과 이성의 조화가 좋습니다. 사람을 대하는 태도가 안정적입니다.',
        '눈이 크고 시원해 감수성과 표현력이 풍부하고 매력이 돋보입니다. 마음이 얼굴에 잘 드러납니다.',
      ][g] });
  }
  // 눈 사이(안격)
  {
    const g = grade(f.eye.interVsEye, 0.9, 1.1);
    out.push({ part: '눈 사이(안격)', tag: ['가까움', '표준', '넓음'][g], metric: `두 눈 사이 ≈ 눈 너비의 ${r1(f.eye.interVsEye)}배`,
      text: [
        '두 눈이 가까운 편이라 집중력이 뛰어나고 한 가지에 몰입하는 힘이 강합니다. 세심함이 강점입니다.',
        '두 눈 사이가 눈 하나 너비로 표준이라, 균형 감각과 판단력이 안정적입니다.',
        '두 눈 사이가 넓어 시야가 넓고 느긋하며 포용적입니다. 큰 틀을 보는 데 능합니다.',
      ][g] });
  }
  // 코 길이
  {
    const g = grade(f.nose.lenVsFace, 0.30, 0.36);
    out.push({ part: '코', tag: ['짧은 편', '균형', '긴 편'][g], metric: `코 길이 ≈ 얼굴 길이의 ${pct1(f.nose.lenVsFace)}%`,
      text: [
        '코가 짧은 편이라 순발력이 좋고 낙천적입니다. 상황에 빠르게 적응합니다.',
        '코 길이가 균형 잡혀 자기 관리와 실행력이 안정적입니다.',
        '코가 긴 편이라 자존심과 원칙이 뚜렷하고 성실합니다. 한 분야를 깊게 파는 힘이 있습니다.',
      ][g] });
  }
  // 입
  {
    const g = grade(f.mouth.vsNose, 1.25, 1.55);
    out.push({ part: '입', tag: ['단정', '균형', '큼'][g], metric: `입 폭 ≈ 코 폭의 ${r1(f.mouth.vsNose)}배 · 입술 두께 ${pct1(f.mouth.lipThick)}%`,
      text: [
        '입이 단정한 편이라 말이 신중하고 절제가 있습니다. 신뢰를 주는 입매입니다.',
        '입 크기가 균형 잡혀 표현과 절제의 조화가 좋습니다. 대인관계의 언어 감각이 안정적입니다.',
        '입이 큰 편이라 표현력과 생활력·추진력이 강합니다. 리더의 화술과 배포를 지닌 입매입니다.',
      ][g] + (f.mouth.lipThick > 0.42 ? ' 입술이 도톰해 정이 많고 애정 표현이 따뜻합니다.' :
              f.mouth.lipThick < 0.30 ? ' 입술이 얇은 편이라 이지적이고 말에 군더더기가 없습니다.' : '') });
  }
  // 눈썹 방향(위 십이궁과 중복 피해 길이·기울기 요약)
  {
    const g = f.eye.tilt > 3 ? 2 : (f.eye.tilt < -3 ? 0 : 1);
    out.push({ part: '눈·눈썹의 기울기', tag: ['부드러움', '수평', '상승'][g], metric: `눈 기울기 ${r1(f.eye.tilt)}°`,
      text: [
        '눈매가 부드럽게 내려가 온화하고 정이 많은 인상을 줍니다.',
        '눈매가 수평으로 반듯해 침착하고 균형 잡힌 인상을 줍니다.',
        '눈매가 살짝 올라가 총기 있고 진취적인 인상을 줍니다.',
      ][g] });
  }
  return out;
}

// ── 4-5. 측면 종합(있을 때) ──
function readProfiles(sides) {
  const rows = [];
  for (const s of sides) {
    if (!s || !s.ok) continue;
    const nose = s.noseProj > 0.16 ? '오똑한 편 — 자존심과 주관이 뚜렷' : (s.noseProj < 0.10 ? '완만한 편 — 부드럽고 순응적' : '균형 잡힘');
    const fore = s.foreheadSlope > 20 ? '뒤로 기운 편 — 순발력·감각형' : (s.foreheadSlope < 8 ? '반듯한 편 — 논리·기획형' : '무던함');
    const mouth = s.mouthProj > 0.12 ? '약간 도톰·표현형' : '단정한 편';
    rows.push({ view: s.view === 'left' ? '좌측면' : '우측면',
      metric: `코 돌출 ${pct1(s.noseProj)}% · 이마 경사 ${r1(s.foreheadSlope)}°`,
      text: `코 옆선은 ${nose}, 이마 옆선은 ${fore}, 입 옆선은 ${mouth}입니다.` });
  }
  return rows;
}

// ── 4-6. 전체 해석 조립 ──
function interpret(front, left, right) {
  if (!front || !front.ok) return { ok: false };
  const oheng = classifyOheng(front);
  const sam = readSamjeong(front);
  const palaces = readTwelvePalaces(front);
  const features = readFeatures(front);
  const profiles = readProfiles([left, right]);
  const symText = front.symmetry >= 92
    ? '좌우 균형이 매우 잘 잡혀 있습니다. 균형 잡힌 얼굴은 안정된 성정과 조화로운 대인운을 상징합니다.'
    : front.symmetry >= 82
    ? '좌우가 대체로 균형 잡혀 있습니다. 사람의 얼굴은 누구나 약간 비대칭이며, 이는 자연스러운 개성입니다.'
    : '좌우 차이가 다소 있는 개성 있는 상입니다. 관상에서 약간의 비대칭은 표정이 풍부하고 감정 표현이 살아있음을 뜻하기도 합니다. (촬영 각도의 영향일 수 있으니 정면 사진을 참고하세요.)';
  // 한 문장 총평
  const decl = `${oheng.info.shape}의 ${oheng.info.key} 바탕에, ${sam.balanced ? '삼정이 고르게 균형 잡힌' : sam.rows.slice().sort((a,b)=>parseFloat(b.pct)-parseFloat(a.pct))[0].key + '이 발달한'} 상입니다.`;
  return { ok: true, front, oheng, sam, palaces, features, profiles, symmetry: front.symmetry, symText, decl };
}

/* ══════════════════════════════════════════════════════════
   5. 렌더 — 리포트 章 HTML & 요약 스니펫
   (app.js의 sec()/chapter() 스타일과 맞춤; 여기선 자체 마크업)
   ══════════════════════════════════════════════════════════ */
function tag(t) { return `<span class="tag">${t}</span>`; }

function reportHtml(res, thumbs) {
  if (!res || !res.ok) return '';
  const oh = res.oheng, f = res.front;
  let h = '';

  // 검출 썸네일(랜드마크 오버레이) — 검증용
  if (thumbs && thumbs.length) {
    h += `<div class="rpt-sec"><h4>검출 결과 — 실제 내 얼굴에서 잰 점들</h4>
      <div class="face-thumbs">${thumbs.map(t => `<figure><img src="${t.url}"/><figcaption>${t.label}</figcaption></figure>`).join('')}</div>
      <p class="sub">위 사진의 점과 선은 AI가 실제로 검출한 468개 특징점과 삼정(발제·눈썹·코밑·턱)·중심축입니다. 아래 수치는 모두 이 점들로부터 픽셀 단위로 잰 것이라, 누가 다시 재도 같은 값이 나옵니다.</p></div>`;
  }

  // 오행 얼굴형
  h += `<div class="rpt-sec"><h4>오행 얼굴형 — ${oh.info.key}</h4>
    <p>${tag(oh.info.hanja + '形')}${tag(oh.info.shape)}${tag('세로/가로 ' + r1(f.ratioLW))}${tag('이마/턱 ' + r1(f.foreJaw))}</p>
    <p>${oh.info.text}</p>
    <p class="sub">보조 기운으로 <b>${OHENG_FACE[oh.secondary].key}</b>의 성질(${OHENG_FACE[oh.secondary].shape})이 함께 비칩니다. 순수한 한 형보다 두세 형이 섞인 얼굴이 대부분이며, 그 배합이 곧 개성입니다.</p></div>`;

  // 삼정
  h += `<div class="rpt-sec"><h4>삼정(三停) — 얼굴을 셋으로 나눈 일생의 지도</h4>
    <div class="samjeong">${res.sam.rows.map(r => `
      <div class="sj-row"><div class="sj-head"><b>${r.key}</b> <span class="tag">${r.tag}</span> <span class="sj-pct">${r.pct}%</span></div>
        <div class="sj-bar"><i style="width:${Math.min(100, r.pct * 2)}%"></i></div>
        <div class="sj-org sub">${r.org} · ${r.life}</div>
        <p>${r.text}</p></div>`).join('')}</div>
    <p><b>${res.sam.summary}</b></p>
    <p class="sub">이상적인 삼정은 세 부분이 1:1:1로 고른 것입니다. 어느 한 정(停)이 발달하면 그 시기의 기운이 강함을 뜻합니다.</p></div>`;

  // 십이궁
  h += `<div class="rpt-sec"><h4>십이궁(十二宮) — 부위마다 담긴 삶의 영역</h4>
    ${res.palaces.map(p => `<div class="palace"><div class="p-name"><b>${p.name}</b> <span class="tag">${p.tag}</span></div>
      <div class="sub">${p.at} · ${p.theme}</div><p>${p.text}</p></div>`).join('')}
    <p class="sub">십이궁은 얼굴의 열두 자리에 명·재물·형제·부부·자녀·건강·직업 등 삶의 영역을 배정해 읽는 전통 관상의 지도입니다. 측정 가능한 주요 궁을 담았습니다.</p></div>`;

  // 이목구비
  h += `<div class="rpt-sec"><h4>이목구비 — 하나하나 뜯어보기</h4>
    ${res.features.map(ft => `<p>· <b>${ft.part}</b> ${tag(ft.tag)} <span class="sub">${ft.metric}</span><br/>${ft.text}</p>`).join('')}</div>`;

  // 좌우 대칭
  h += `<div class="rpt-sec"><h4>좌우 대칭 — ${pct1(res.symmetry / 100 * 100)}점</h4>
    <div class="sj-bar big"><i style="width:${res.symmetry}%"></i></div>
    <p>${res.symText}</p></div>`;

  // 측면
  if (res.profiles.length) {
    h += `<div class="rpt-sec"><h4>측면 프로파일 — 옆에서 본 나 (보조)</h4>
      ${res.profiles.map(p => `<p>· <b>${p.view}</b> <span class="sub">${p.metric}</span><br/>${p.text}</p>`).join('')}
      <p class="sub">옆얼굴은 정면보다 검출이 까다로워 보조 참고로 담았습니다. 코의 높이·이마 경사·입의 돌출을 봅니다.</p></div>`;
  }

  // 총평 + 면책
  h += `<div class="rpt-sec"><h4>관상 총평</h4><p><b>${res.decl}</b></p>
    <p class="sub">관상은 '정해진 운명'이 아니라 얼굴에 드러난 기질과 경향의 언어입니다. 표정과 마음가짐에 따라 상(相)은 바뀐다 하여, 예로부터 "심상(心相)이 관상보다 위에 있다"고 했습니다. 이 풀이를 자신을 더 깊이 이해하는 거울로 삼으시길 바랍니다.</p></div>`;

  return h;
}

function summaryHtml(res) {
  if (!res || !res.ok) return '';
  const oh = res.oheng, f = res.front;
  const topSam = res.sam.rows.slice().sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct))[0];
  return `<b>${oh.info.key}</b> · ${oh.info.shape}<br/>
    <span style="font-size:15px">${res.decl}</span>
    <div style="margin-top:10px; font-size:15px">
      삼정: 상 ${res.sam.rows[0].pct}% · 중 ${res.sam.rows[1].pct}% · 하 ${res.sam.rows[2].pct}%
      &nbsp;·&nbsp; 좌우대칭 ${pct1(res.symmetry)}점<br/>
      가장 발달한 곳 — <b>${topSam.key}</b> (${topSam.life.split('·')[0]})
    </div>`;
}

// ── 전역 노출 ─────────────────────────────────────────────
global.FaceReader = FaceReader;                 // 검출기
global.FaceRead = {                             // 계측·해석·렌더
  measureFront, measureProfile, interpret, reportHtml, summaryHtml, IX, OHENG_FACE,
};

})(window);
