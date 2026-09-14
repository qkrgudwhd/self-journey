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
  // 목형은 '길고 고른' 상 — 역삼각(이마≫턱)이나 각진 하관이면 목형이 아니다
  s.목 -= clamp((f.foreJaw - 1.15) * 5, 0, 2.2);    // 역삼각 → 화형
  s.목 -= clamp((f.jawTaper - 0.86) * 4, 0, 1.2);   // 각진 하관 → 금형
  s.토 += clamp((1.28 - R) * 6, 0, 2.4);
  s.수 += clamp((1.30 - R) * 4, 0, 1.8);
  s.화 += clamp((f.foreJaw - 1.06) * 8, 0, 3.4);    // 이마>턱 (역삼각·상광하첨)
  s.금 += clamp((f.jawTaper - 0.80) * 9, 0, 2.8);   // 하관이 광대만큼 넓다(각짐)
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
    G.push({ name: '兄弟宮 · 형제궁', rel: true, at: '눈썹', theme: '형제·동료·대인관계',
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
    G.push({ name: '夫妻宮 · 부부궁', rel: true, at: '눈꼬리(어미·간문)', theme: '배우자·애정 인연',
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
    G.push({ name: '子女宮 · 자녀궁', rel: true, at: '눈 밑(와잠·누당)', theme: '자녀·후덕·정서',
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
  // 遷移宮(천이궁) — 이마 옆(역마·산림)
  {
    const g = f.foreheadW / f.faceWid;
    const gi = g > 0.72 ? 2 : (g < 0.62 ? 0 : 1);
    G.push({ name: '遷移宮 · 천이궁', at: '이마 양옆(역마驛馬·산림)', theme: '이동·여행·해외·활동 범위',
      tag: ['좁음', '보통', '넓음'][gi],
      text: [
        '천이궁이 좁은 편이라 한곳에 뿌리내려 안정을 이룰 때 힘이 납니다. 잦은 이동보다 정착이 이롭습니다.',
        '천이궁이 무던해 이동과 정착의 균형이 좋습니다. 필요할 때 움직이고 자리 잡는 데 무리가 없습니다.',
        '천이궁(이마 옆)이 넓고 훤해 역마의 기운이 있습니다. 이동·출장·해외·타지에서 기회가 열리는 활동형입니다.',
      ][gi] });
  }
  // 福德宮(복덕궁) — 이마 위 눈썹 끝 상부(천창)
  {
    const gi = f.sam.up > 0.35 ? 2 : (f.sam.up < 0.30 ? 0 : 1);
    G.push({ name: '福德宮 · 복덕궁', at: '이마 위쪽 양편(천창天倉)', theme: '타고난 복·정신적 여유·조상 음덕',
      tag: ['담백', '보통', '넉넉'][gi],
      text: [
        '복덕궁이 담백한 편이라 복을 스스로 짓는 자수성가형입니다. 베풂과 여유의 습관이 곧 복을 부릅니다.',
        '복덕궁이 무던해 정신적 여유와 복이 안정적으로 흐릅니다.',
        '복덕궁(이마 위)이 넉넉해 타고난 복과 조상의 음덕이 있습니다. 마음의 여유가 있어 큰 근심 없이 흐르는 상입니다.',
      ][gi] });
  }
  // 父母宮(부모궁) — 이마 상부 좌우(일각·월각)
  {
    const sym = f.symmetry;
    const gi = sym >= 90 ? 2 : (sym < 82 ? 0 : 1);
    G.push({ name: '父母宮 · 부모궁', rel: true, at: '이마 상부 좌우(일각日角·월각月角)', theme: '부모 덕·윗대와의 인연',
      tag: ['개성', '보통', '반듯'][gi],
      text: [
        '일각·월각의 좌우 차이가 있는 편입니다. 전통적으로 부모 중 한쪽과 인연·영향이 더 깊거나, 초년에 스스로 서는 힘을 기른 상으로 봅니다.',
        '일각·월각이 무던해 부모·윗대와의 인연이 안정적입니다.',
        '일각·월각이 반듯하고 균형 잡혀 부모 덕과 윗대의 음덕이 있는 상입니다. 초년의 보살핌이 두터웠음을 뜻합니다.',
      ][gi] });
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

// ── 4-5b. 오관(五官) — 다섯 관리로 보는 총평 (마의상법) ──
function readFiveOfficials(f) {
  const O = [];
  // 眉 = 保壽官(보수관) — 눈썹
  {
    const g = grade(f.brow.vsEye, 1.0, 1.25);
    O.push({ name: '눈썹 — 보수관(保壽官)', judge: ['다소 짧음', '단정', '수려'][g],
      text: ['눈썹이 눈보다 짧은 편이라, 정을 소수에게 깊게 쏟는 형입니다. 눈썹결을 단정히 다듬으면 대인운이 열립니다.',
             '눈썹이 눈과 어울려 단정합니다. 보수관이 반듯하면 성정이 안정되고 수명·건강의 기틀이 좋다고 봅니다.',
             '눈썹이 길고 수려해 형제·귀인의 덕이 있고 성정이 너그럽습니다. 보수관이 빼어난 귀상(貴相)의 요소입니다.'][g] });
  }
  // 目 = 監察官(감찰관) — 눈 (오관의 으뜸)
  {
    const g = grade(f.eye.w / f.faceWid, 0.20, 0.235);
    O.push({ name: '눈 — 감찰관(監察官)', judge: ['깊음', '맑음', '빼어남'][g],
      text: ['눈이 아담하고 깊어 통찰과 인내가 있습니다. 눈빛이 안정되면 감찰관이 제 역할을 해 판단이 흐트러지지 않습니다.',
             '눈이 맑고 균형 잡혀 감찰관이 바릅니다. 관상에서 눈은 마음의 창이자 오관의 으뜸 — 눈빛이 맑으면 그 하나로 귀격을 이룹니다.',
             '눈이 크고 빛나 감수성과 총기가 뛰어납니다. 감찰관이 빼어나면 사람과 기회를 알아보는 눈이 밝습니다.'][g] });
  }
  // 鼻 = 審辨官(심변관) — 코
  {
    const g = grade(f.nose.lenVsFace, 0.30, 0.36);
    O.push({ name: '코 — 심변관(審辨官)', judge: ['순발', '단정', '우뚝'][g],
      text: ['코가 짧은 편이라 순발력과 융통성이 좋습니다. 준두를 밝게 가꾸면 재백(財帛)의 심변관이 힘을 냅니다.',
             '코가 단정해 자기 중심과 재물 관리가 안정적입니다. 심변관은 나 자신과 중년의 기둥입니다.',
             '코가 우뚝하고 길어 자존심과 주관이 뚜렷하고 심지가 굳습니다. 심변관이 곧고 실하면 중년의 성취가 큽니다.'][g] });
  }
  // 口 = 出納官(출납관) — 입
  {
    const g = grade(f.mouth.vsNose, 1.25, 1.55);
    O.push({ name: '입 — 출납관(出納官)', judge: ['단정', '균형', '두터움'][g],
      text: ['입이 단정해 말이 신중하고 신용이 있습니다. 출납관이 다물어져 야무지면 새는 복이 적습니다.',
             '입이 균형 잡혀 언변과 절제의 조화가 좋습니다. 출납관은 먹을 복·말 복·자손 복을 함께 봅니다.',
             '입이 크고 도톰해 생활력과 표현력·복록이 넉넉합니다. 출납관이 두터우면 의식(衣食)이 풍족한 상입니다.'][g] });
  }
  // 耳 = 採聽官(채청관) — 귀 (정면 사진으론 판단 제한)
  O.push({ name: '귀 — 채청관(採聽官)', judge: '사진 제한',
    text: '귀(채청관)는 초년운·수명·신장(腎)의 기운을 보는 자리이나, 정면 사진에서는 옆선이 가려 정밀 판단이 어렵습니다. 전통적으로 귀가 크고 두터우며 윤곽이 뚜렷하면 초년 복과 건강이 좋다고 봅니다. 측면 사진이 있으면 함께 참고하세요.' });
  return O;
}

// ── 4-5c. 관계운(緣) — 얼굴로 보는 부부·자녀·부모·형제 ──
//   나를 알아야 상대(배우자·자식·부모·형제)를 먼저 안다 — 별님의 뜻
function readRelations(f, gender) {
  const male = gender === 'M';
  const R = [];

  // ① 부부·배우자 (부부궁 어미·간문 + 인당 + 코/관골)
  {
    const clean = f.symmetry >= 86;
    const tiltG = f.eye.tilt > 3 ? 'up' : (f.eye.tilt < -3 ? 'down' : 'flat');
    const spouseSeat = male
      ? '남성은 <b>코(재백·처궁)</b>와 <b>어미(눈꼬리)</b>로 배우자 자리를 봅니다.'
      : '여성은 <b>관골(광대)</b>과 <b>어미(눈꼬리)</b>로 배우자(남편) 자리를 봅니다.';
    const noseGood = f.nose.vsInter >= 0.9 && f.nose.lenVsFace >= 0.30;
    let t = `${spouseSeat} 눈꼬리(어미·간문)는 부부의 정과 애정의 자리입니다. `;
    t += tiltG === 'down'
      ? '눈꼬리가 부드럽게 내려가 정이 많고 배우자를 품는 애정형입니다. 헌신하는 만큼 배우자 복이 따릅니다. '
      : tiltG === 'up'
      ? '눈꼬리가 올라가 주관이 뚜렷하고 매력이 강합니다. 서로 존중하는 짝을 만나면 관계에 활기가 넘칩니다. '
      : '눈꼬리가 수평으로 반듯해 애정이 균형 잡히고 관계가 안정적입니다. ';
    t += male
      ? (noseGood ? '코가 곧고 준두가 실해 처복(妻福)이 좋은 상 — 가정을 지키는 힘이 있습니다.'
                  : '코를 밝고 곧게 가꾸면 처궁이 살아납니다. 자기 고집을 누그러뜨리면 부부 화합이 커집니다.')
      : (f.brow.interVsEye >= 1.0 ? '관골이 무던하고 인당이 트여 남편과의 소통이 순한 상입니다.'
                  : '인당(미간)을 밝게 펴면 부부 소통이 좋아집니다. 예민함을 다스리면 관계가 편안해집니다.');
    t += clean ? ' 어미가 깨끗해(좌우 균형) 부부 사이 잡음이 적은 상입니다.'
               : ' 어미에 주름·기색이 얽히기 쉬우니(좌우 차이), 감정을 쌓아두지 말고 자주 표현하면 좋습니다.';
    R.push({ who: '부부 · 배우자운', seat: '어미(눈꼬리)·인당·코/관골', text: t });
  }

  // ② 자녀 (자녀궁 와잠·누당 + 인중)
  {
    const wanjam = grade(f.eye.open, 0.28, 0.40);
    const philLong = f.philtrum >= 0.16;
    let t = '자녀운은 <b>눈밑(와잠·누당)</b>과 <b>인중(人中)</b>으로 봅니다. ';
    t += ['눈밑이 담백한 편이라 자녀에게 마음은 깊되 표현이 담담합니다. 애정을 자주 드러내면 자녀와의 정이 두터워집니다. ',
          '눈밑(와잠)이 무던해 자녀와의 정서적 교류가 안정적입니다. ',
          '눈밑(와잠)이 도톰해 자녀·아랫사람을 아끼는 정이 깊고, 전통적으로 자식 복이 있는 상으로 봅니다. '][wanjam];
    t += philLong
      ? '인중이 길고 뚜렷해, 예로부터 자손이 번성하고 건강하며 아랫대와의 인연이 깊다고 봅니다.'
      : '인중이 짧은 편이라 자녀에게 세심히 마음 쓰는 노력이 정을 키웁니다. 인중을 밝게 가꾸는 마음가짐이 자손운을 돕습니다.';
    R.push({ who: '자녀운', seat: '와잠(눈밑)·인중', text: t });
  }

  // ③ 부모 (부모궁 일각·월각 + 상정 + 대칭)
  {
    const good = f.symmetry >= 88 && f.sam.up >= 0.31;
    let t = '부모·윗대의 인연은 <b>이마 상부 좌우(일각日角·월각月角)</b>와 이마 전체(상정)로 봅니다. ';
    t += male
      ? '일각(왼편)은 아버지, 월각(오른편)은 어머니 자리로 전통적으로 봅니다. '
      : '여성은 일각·월각을 부모 양쪽의 자리로 함께 봅니다. ';
    t += good
      ? '이마가 반듯하고 좌우가 고르게 발달해 부모 덕과 초년의 보살핌이 두터웠던 상입니다. 윗사람·상사의 음덕도 따릅니다.'
      : '일각·월각의 좌우 차이가 있는 편이라, 부모 중 한쪽과 인연·영향이 더 깊거나 초년에 스스로 서는 힘을 일찍 기른 상입니다. 자수성가의 기틀이기도 합니다.';
    R.push({ who: '부모운', seat: '일각·월각(이마 상부 좌우)', text: t });
  }

  // ④ 형제 (형제궁 눈썹)
  {
    const g = grade(f.brow.vsEye, 1.0, 1.25);
    let t = '형제·동기(同氣)와 가까운 벗의 인연은 <b>눈썹(형제궁)</b>으로 봅니다. ';
    t += ['눈썹이 눈보다 짧은 편이라 형제·벗의 수가 많기보다 소수와 깊게 지내는 형입니다. 먼저 다가가면 우애가 두터워집니다.',
          '눈썹이 눈과 어울려 형제·동료 간 정이 두텁고 우애가 원만합니다.',
          '눈썹이 길고 가지런해 형제·벗의 덕이 있고 서로 돕는 인연이 깊습니다. 눈썹결이 고를수록 형제 화목의 상입니다.'][g];
    R.push({ who: '형제 · 동기운', seat: '눈썹(형제궁)', text: t });
  }
  return R;
}

// ── 4-6. 전체 해석 조립 ──
function interpret(front, left, right, gender) {
  if (!front || !front.ok) return { ok: false };
  const oheng = classifyOheng(front);
  const sam = readSamjeong(front);
  const palaces = readTwelvePalaces(front);
  const officials = readFiveOfficials(front);
  const relations = readRelations(front, gender);
  const features = readFeatures(front);
  const profiles = readProfiles([left, right]);
  const symText = front.symmetry >= 92
    ? '좌우 균형이 매우 잘 잡혀 있습니다. 균형 잡힌 얼굴은 안정된 성정과 조화로운 대인운을 상징합니다.'
    : front.symmetry >= 82
    ? '좌우가 대체로 균형 잡혀 있습니다. 사람의 얼굴은 누구나 약간 비대칭이며, 이는 자연스러운 개성입니다.'
    : '좌우 차이가 다소 있는 개성 있는 상입니다. 관상에서 약간의 비대칭은 표정이 풍부하고 감정 표현이 살아있음을 뜻하기도 합니다. (촬영 각도의 영향일 수 있으니 정면 사진을 참고하세요.)';
  // 한 문장 총평
  const decl = `${oheng.info.shape}의 ${oheng.info.key} 바탕에, ${sam.balanced ? '삼정이 고르게 균형 잡힌' : sam.rows.slice().sort((a,b)=>parseFloat(b.pct)-parseFloat(a.pct))[0].key + '이 발달한'} 상입니다.`;
  return { ok: true, front, oheng, sam, palaces, officials, relations, features, profiles, symmetry: front.symmetry, symText, decl };
}

/* ══════════════════════════════════════════════════════════
   5. 렌더 — 리포트 章 HTML & 요약 스니펫
   (app.js의 sec()/chapter() 스타일과 맞춤; 여기선 자체 마크업)
   ══════════════════════════════════════════════════════════ */
function tag(t) { return `<span class="tag">${t}</span>`; }
const r2 = v => Math.round(v * 100) / 100;

// 정밀 측정 데이터 패널 — 전문가가 수치를 검증할 수 있게 '측정값 · 표준 · 판정'
function measurementTable(f) {
  const V = (v, lo, hi) => v < lo ? '작음/좁음' : (v > hi ? '큼/넓음' : '표준');
  const rows = [
    ['얼굴 세로:가로 비', r2(f.ratioLW), '목1.45↑·화금1.15~1.45·토수1.15↓',
      f.ratioLW >= 1.45 ? '긴 얼굴(목형)' : (f.ratioLW <= 1.18 ? '둥근·넓은(토·수)' : '중간형(화·금)')],
    ['이마폭 : 턱폭', r2(f.foreJaw), '1.0 근처=균형',
      f.foreJaw >= 1.18 ? '이마 넓음(역삼각·화)' : (f.foreJaw <= 0.9 ? '턱 넓음(금·토)' : '균형')],
    ['삼정 上:中:下', `${pct1(f.sam.up)} : ${pct1(f.sam.mid)} : ${pct1(f.sam.low)}%`, '33 : 33 : 33',
      (Math.max(f.sam.up,f.sam.mid,f.sam.low)-Math.min(f.sam.up,f.sam.mid,f.sam.low))<0.06 ? '균형(귀격 바탕)' : '기울어짐 있음'],
    ['미간(印堂)/눈너비', r2(f.brow.interVsEye), '1.0 (눈 하나)', V(f.brow.interVsEye,0.9,1.25)],
    ['눈 가로폭/얼굴폭', pct1(f.eye.w/f.faceWid)+'%', '20% 내외', V(f.eye.w/f.faceWid,0.20,0.235)],
    ['눈 벌어짐(세로/가로)', r2(f.eye.open), '0.28~0.38', V(f.eye.open,0.28,0.40)],
    ['두 눈 사이/눈너비', r2(f.eye.interVsEye), '1.0 (눈 하나)', V(f.eye.interVsEye,0.9,1.1)],
    ['눈꼬리 기울기', r1(f.eye.tilt)+'°', '0°(수평)', f.eye.tilt>3?'올라감(상승)':(f.eye.tilt<-3?'내려감':'수평')],
    ['눈썹 길이/눈', r2(f.brow.vsEye), '1.0~1.25 (눈보다 김)', V(f.brow.vsEye,1.0,1.25)],
    ['코 길이/얼굴 길이', pct1(f.nose.lenVsFace)+'%', '33% 내외', V(f.nose.lenVsFace,0.30,0.36)],
    ['콧방울폭/두눈사이', r2(f.nose.vsInter), '1.0', V(f.nose.vsInter,0.9,1.15)],
    ['입폭/코폭', r2(f.mouth.vsNose), '1.3~1.5', V(f.mouth.vsNose,1.25,1.55)],
    ['입술 두께(높이/입폭)', pct1(f.mouth.lipThick)+'%', '30~42%', V(f.mouth.lipThick,0.30,0.42)],
    ['인중 길이/얼굴', pct1(f.philtrum)+'%', '15% 내외', V(f.philtrum,0.13,0.18)],
    ['좌우 대칭도', r1(f.symmetry)+'점', '100점', f.symmetry>=92?'매우 우수':(f.symmetry>=82?'양호':'개성 있음')],
  ];
  return `<div class="mtab-wrap"><table class="mtab"><thead><tr><th>항목</th><th>측정값</th><th>표준·이상</th><th>판정</th></tr></thead><tbody>${
    rows.map(r=>`<tr><td>${r[0]}</td><td class="v">${r[1]}</td><td class="j">${r[2]}</td><td>${r[3]}</td></tr>`).join('')
  }</tbody></table></div>`;
}

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

  // 정밀 측정 데이터 패널(전문가용)
  h += `<div class="rpt-sec"><h4>정밀 측정값 — 표준 대비 판정표</h4>
    ${measurementTable(f)}
    <p class="sub">모든 값은 검출된 468 특징점에서 픽셀 단위로 계산한 객관 수치입니다. '표준·이상'은 전통 관상학과 얼굴 계측학에서 통용되는 균형값이며, 실제 상담 시 이 수치를 근거로 설명하실 수 있습니다.</p></div>`;

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

  // 십이궁 — 나의 자리(재물·건강·직업·이동·복). 부부·자녀·부모·형제 4궁은 아래 '관계운'에서 자세히 봄
  h += `<div class="rpt-sec"><h4>십이궁(十二宮) — 나의 자리(재물·건강·직업·복)</h4>
    ${res.palaces.filter(p => !p.rel).map(p => `<div class="palace"><div class="p-name"><b>${p.name}</b> <span class="tag">${p.tag}</span></div>
      <div class="sub">${p.at} · ${p.theme}</div><p>${p.text}</p></div>`).join('')}
    <p class="sub">십이궁은 얼굴의 열두 자리에 삶의 영역을 배정해 읽습니다. 여기서는 나 자신의 운(명·재물·직업·건강·이동·복)을 담았고, 인연의 네 자리(부부·자녀·부모·형제)는 아래 '관계운'에서 따로 봅니다.</p></div>`;

  // 오관(五官)
  if (res.officials) {
    h += `<div class="rpt-sec"><h4>오관(五官) — 다섯 관리로 보는 총평</h4>
      ${res.officials.map(o => `<p>· <b>${o.name}</b> ${tag(o.judge)}<br/>${o.text}</p>`).join('')}
      <p class="sub">마의상법(麻衣相法)은 눈썹·눈·코·입·귀를 다섯 '관리(官)'로 보아, 하나라도 빼어나면 십 년의 귀함이 있다 했습니다. 그중 눈(감찰관)이 으뜸입니다.</p></div>`;
  }

  // 관계운(緣) — 부부·자녀·부모·형제
  if (res.relations) {
    h += `<div class="rpt-sec rel-sec"><h4>관계운(緣) — 얼굴이 말하는 배우자·자녀·부모·형제</h4>
      <p class="sub">사주가 인연의 '기운'을 본다면, 관상은 얼굴에 드러난 인연의 '자리'를 봅니다. 눈꼬리·눈밑·이마·눈썹이 배우자·자녀·부모·형제의 인연을 말해 줍니다.</p>
      ${res.relations.map(r => `<div class="palace"><div class="p-name"><b>${r.who}</b> <span class="tag">${r.seat}</span></div><p>${r.text}</p></div>`).join('')}
      <p class="sub">인연의 자리는 '정해진 운명'이 아니라, 내가 그 관계에서 어떻게 마음 쓰고 표현하느냐의 지도입니다. 부족한 자리는 정성으로 채워집니다.</p></div>`;
  }

  // (이목구비 상세는 오관·정밀 측정표와 겹쳐 제거 — 중복 방지)

  // 좌우 대칭
  h += `<div class="rpt-sec"><h4>좌우 대칭 — ${r1(res.symmetry)}점</h4>
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
      &nbsp;·&nbsp; 좌우대칭 ${r1(res.symmetry)}점<br/>
      가장 발달한 곳 — <b>${topSam.key}</b> (${topSam.life.split('·')[0]})
    </div>`;
}

// ── 전역 노출 ─────────────────────────────────────────────
global.FaceReader = FaceReader;                 // 검출기
global.FaceRead = {                             // 계측·해석·렌더
  measureFront, measureProfile, interpret, reportHtml, summaryHtml, IX, OHENG_FACE,
};

})(window);
