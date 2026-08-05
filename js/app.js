/* ============================================================
   나를 찾는 여정 — 화면 흐름 (입력 위저드 → 1차 요약)
   엔진: manseryeok / naming / assessment / personal_color
   ============================================================ */

// ---------- 전역 상태 ----------
const S = {
  sur: '', giv: '', gender: '', blood: '',
  cal: 'solar', date: '', leap: false, time: '12:00', noHour: false,
  useHanja: false, hanja: {},          // {글자: 선택한 한자}
  shape: null,
  colorAnswers: [], mbtiAnswers: [],
  result: {},
};

const SHAPE_INFO = {
  square:  { emoji:'◻︎', name:'사각형',   arche:'안정형 · 체계의 사람', color:'#7fc4e0',
    desc:'무의식이 질서와 정확성을 향합니다. 흐트러진 것을 정돈할 때 안정감을 느끼는, 신뢰의 기반을 지닌 분입니다.' },
  triangle:{ emoji:'△', name:'삼각형',   arche:'주도형 · 추진의 사람', color:'#e88aa6',
    desc:'무의식이 목표와 성취를 향합니다. 방향이 정해지면 앞장서는, 리더십과 결단의 에너지를 지닌 분입니다.' },
  circle:  { emoji:'○', name:'원형',     arche:'관계형 · 따뜻함의 사람', color:'#e7c46b',
    desc:'무의식이 조화와 공감을 향합니다. 사람 사이의 온도를 살피는, 균형과 소통의 중심에 서는 분입니다.' },
  zigzag:  { emoji:'⚡', name:'지그재그', arche:'탐구형 · 혁신의 사람', color:'#b59cf0',
    desc:'무의식이 변화와 창조를 향합니다. 익숙함을 벗어나 새 아이디어를 찾는, 자유로운 탐구자입니다.' },
  rect:    { emoji:'▭', name:'직사각형', arche:'성장형 · 전환의 사람', color:'#8fd6a6',
    desc:'무의식이 성장과 전환을 향합니다. 지금은 껍질을 깨는 과도기 — 새로운 나를 향해 움직이는 분입니다.' },
};

// ---------- 화면 전환 ----------
const STEPS = ['basic', 'shape', 'color', 'mbti', 'face', 'summary'];
const STEP_LABELS = { basic:'1/6 기본 정보', shape:'2/6 도형 선택', color:'3/6 나의 색',
                      mbti:'4/6 성향 검사', face:'5/6 관상 사진', summary:'6/6 결과' };

function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  document.getElementById('scr-' + id).classList.add('on');
  const idx = STEPS.indexOf(id);
  const bar = document.getElementById('stepbar'), lab = document.getElementById('steplabel');
  if (idx >= 0) {
    bar.classList.add('on'); lab.classList.add('on');
    lab.textContent = STEP_LABELS[id];
    [...bar.children].forEach((seg, i) => seg.classList.toggle('done', i <= idx));
  } else { bar.classList.remove('on'); lab.classList.remove('on'); }
  window.scrollTo(0, 0);
  if (id === 'color') renderColorQ();
  if (id === 'mbti') renderMbtiQ();
  if (id === 'face') initFace();
}

// ---------- 날짜·시간 선택 버튼 ----------
function openPicker(id) {
  const el = document.getElementById(id);
  try { el.showPicker(); } catch (e) { el.focus(); }
}

// 시각 확인: 선택판 닫고 "확인됨" 표시
function confirmTime(id) {
  const el = document.getElementById(id);
  el.blur();
  const btn = document.getElementById(id + '-ok');
  if (!btn) return;
  const t = el.value || '12:00';
  btn.textContent = '✓ ' + t;
  btn.classList.add('done');
  el.style.borderColor = 'var(--gold)';
  setTimeout(() => { btn.textContent = '확인'; btn.classList.remove('done'); }, 1800);
}

// ---------- 칩 선택 공통 ----------
function bindChips(boxId, onPick) {
  const box = document.getElementById(boxId);
  box.querySelectorAll('.chip').forEach(c => {
    c.onclick = () => {
      box.querySelectorAll('.chip').forEach(x => x.classList.remove('on'));
      c.classList.add('on'); onPick(c.dataset.v);
    };
  });
}
bindChips('in-gender', v => S.gender = v);
bindChips('in-blood', v => S.blood = v);

// ---------- 음력 윤달 표시 ----------
document.getElementById('in-cal').onchange = e => {
  S.cal = e.target.value;
  document.getElementById('leap-wrap').style.display = S.cal === 'lunar' ? 'flex' : 'none';
};

// ---------- 한자 선택 UI ----------
document.getElementById('in-usehanja').onchange = e => {
  S.useHanja = e.target.checked;
  renderHanjaPickers();
  if (S.useHanja) {
    // 한자 칸으로 바로 이동 (별님 피드백: 체크했는데 어디 있는지 안 보였음)
    document.getElementById('hanja-pickers').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};
['in-sur', 'in-giv'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => { if (S.useHanja) renderHanjaPickers(); });
});

function renderHanjaPickers() {
  const box = document.getElementById('hanja-pickers');
  box.innerHTML = '';
  if (!S.useHanja) return;
  const chars = [...(document.getElementById('in-sur').value + document.getElementById('in-giv').value)];
  if (!chars.length) {
    // 이름 미입력 상태 안내 (이름을 쓰면 자동으로 후보가 나타남)
    box.innerHTML = `<p class="hint" style="margin-top:8px; color:var(--gold)">
      ⬆ 위의 <b>성과 이름을 먼저 입력</b>하시면, 글자마다 한자 후보가 여기에 나타납니다.</p>`;
    return;
  }
  for (const ch of chars) {
    const cands = searchHanjaByReading(ch);
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `<label>'${ch}'의 한자 ${cands.length ? '' : '— 후보 없음(건너뜀)'}</label>`;
    if (cands.length) {
      const grid = document.createElement('div');
      grid.className = 'hanja-grid';
      cands.slice(0, 40).forEach(c => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'hanja-btn';
        b.innerHTML = `${c.char}<small>${c.strokes}획</small>`;
        if (S.hanja[ch] === c.char) b.classList.add('on');
        b.onclick = () => {
          if (S.hanja[ch] === c.char) delete S.hanja[ch];
          else S.hanja[ch] = c.char;
          renderHanjaPickers();
        };
        grid.appendChild(b);
      });
      wrap.appendChild(grid);
    }
    box.appendChild(wrap);
  }
}

// ---------- STEP 1 제출 ----------
function submitBasic() {
  const err = document.getElementById('basic-err');
  S.sur = document.getElementById('in-sur').value.trim();
  S.giv = document.getElementById('in-giv').value.trim();
  S.date = document.getElementById('in-date').value;
  S.leap = document.getElementById('in-leap').checked;
  S.time = document.getElementById('in-time').value || '12:00';
  S.noHour = document.getElementById('in-nohour').checked;

  if (!S.sur || !S.giv) { err.textContent = '성과 이름을 입력해 주세요.'; return; }
  if (!/^[가-힣]+$/.test(S.sur + S.giv)) { err.textContent = '성과 이름은 한글로 입력해 주세요.'; return; }
  if (!S.gender) { err.textContent = '성별을 선택해 주세요.'; return; }
  if (!S.date) { err.textContent = '생년월일을 입력해 주세요.'; return; }
  const y = +S.date.slice(0, 4);
  if (y < 1901 || y > 2049) { err.textContent = '1901~2049년생만 지원합니다.'; return; }
  err.textContent = '';
  go('shape');
}

// ---------- STEP 2 도형 ----------
document.querySelectorAll('#shapes .shape').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#shapes .shape').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    S.shape = b.dataset.k;
    document.getElementById('btn-shape').disabled = false;
  };
});

// ---------- STEP 3 퍼스널 컬러 (1문항 진행) ----------
let cqIdx = 0;
function renderColorQ() {
  const q = COLOR_QUESTIONS[cqIdx];
  document.getElementById('cq-no').textContent = `${cqIdx + 1} / ${COLOR_QUESTIONS.length}`;
  document.getElementById('cq-bar').style.width = (cqIdx / COLOR_QUESTIONS.length * 100) + '%';

  // 문항 + (있으면) 견본 팔레트
  const qt = document.getElementById('cq-text');
  qt.innerHTML = '';
  qt.append(q.t);
  if (q.demo) {
    const d = document.createElement('div');
    d.className = 'demo-sw';
    d.innerHTML = q.demo.map(h => `<span style="background:${h}"></span>`).join('');
    qt.appendChild(d);
  }

  document.getElementById('cq-back').style.visibility = cqIdx === 0 ? 'hidden' : 'visible';
  const box = document.getElementById('cq-opts');
  box.innerHTML = '';
  box.classList.toggle('color-grid', !!q.grid);
  q.opts.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = 'opt' + (o.sw ? ' has-sw' : '') + (S.colorAnswers[cqIdx] === i ? ' sel' : '');
    if (o.sw) {
      // 실제 색 견본으로 선택
      b.innerHTML = `<span class="osw">${o.sw.map(h => `<i style="background:${h}"></i>`).join('')}</span>
                     <span class="olabel">${o.label}</span>`;
    } else {
      b.textContent = o.label;
    }
    b.onclick = () => {
      S.colorAnswers[cqIdx] = i;
      b.classList.add('sel');
      setTimeout(() => {
        if (cqIdx + 1 < COLOR_QUESTIONS.length) { cqIdx++; renderColorQ(); }
        else go('mbti');
      }, 160);
    };
    box.appendChild(b);
  });
}
function colorBack() { if (cqIdx > 0) { cqIdx--; renderColorQ(); } }

// ---------- STEP 4 92문항 (1문항 진행) ----------
let mqIdx = 0;
const AXIS_LABEL = { EI:'에너지의 방향', SN:'정보를 받아들이는 방식', TF:'판단의 기준', JP:'삶을 대하는 태도' };
function renderMbtiQ() {
  const q = QUESTIONS[mqIdx];
  document.getElementById('mq-no').textContent = `${mqIdx + 1} / ${QUESTIONS.length}`;
  document.getElementById('mq-axis').textContent = AXIS_LABEL[q.a];
  document.getElementById('mq-bar').style.width = (mqIdx / QUESTIONS.length * 100) + '%';
  document.getElementById('mq-text').textContent = q.t;
  document.getElementById('mq-back').style.visibility = mqIdx === 0 ? 'hidden' : 'visible';
  const box = document.getElementById('mq-opts');
  box.innerHTML = '';
  SCALE_LABELS.forEach((lab, i) => {
    const b = document.createElement('button');
    b.className = 'opt' + (S.mbtiAnswers[mqIdx] === i + 1 ? ' sel' : '');
    b.textContent = lab;
    b.onclick = () => {
      S.mbtiAnswers[mqIdx] = i + 1;
      b.classList.add('sel');
      setTimeout(() => {
        if (mqIdx + 1 < QUESTIONS.length) { mqIdx++; renderMbtiQ(); }
        else go('face');
      }, 130);
    };
    box.appendChild(b);
  });
}
function mbtiBack() { if (mqIdx > 0) { mqIdx--; renderMbtiQ(); } }

// ═══════════════ 관상(면상) — 사진 검출 & 계측 ═══════════════
// 사진/검출 결과는 이 세션 메모리에만 존재(저장·전송 안 함). 프로필에도 사진은 담지 않음.
const FACE = { front: null, left: null, right: null };
let facePickView = null, faceEngineReady = false;

function initFace() {
  refreshFaceBtn();
  const el = document.getElementById('face-engine');
  if (faceEngineReady) { el.textContent = '✓ 얼굴 인식 엔진 준비됨 — 사진을 올려 주세요.'; return; }
  el.textContent = '얼굴 인식 엔진을 준비하는 중… (최초 1회, 잠시 걸립니다)';
  FaceReader.load(msg => { el.textContent = msg; })
    .then(() => { faceEngineReady = true; el.textContent = '✓ 얼굴 인식 엔진 준비 완료 — 사진을 올려 주세요.'; })
    .catch(err => { el.innerHTML = `<span style="color:#e88aa6">엔진 로딩 실패: ${err.message}. 브라우저를 새로고침하거나, '사진 없이 진행'을 눌러 주세요.</span>`; });
}

function pickFace(view) {
  facePickView = view;
  document.getElementById('face-file').click();
}

function onFacePicked(input) {
  const file = input.files[0];
  input.value = '';
  if (!file || !facePickView) return;
  const view = facePickView;
  const stat = document.getElementById('fstat-' + view);
  const slot = document.getElementById('fslot-' + view);
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    slot.classList.add('filled');
    stat.className = 'fs-stat fs-busy'; stat.textContent = '얼굴을 찾는 중…';
    // 엔진 준비 보장
    FaceReader.load().then(() => {
      let lm = null;
      try { lm = FaceReader.detect(img); } catch (e) { lm = null; }
      const cv = document.getElementById('fcv-' + view);
      FaceReader.drawOverlay(cv, img, lm);
      URL.revokeObjectURL(url);
      if (!lm) {
        FACE[view] = null;
        stat.className = 'fs-stat fs-warn';
        stat.textContent = view === 'front'
          ? '얼굴을 찾지 못했어요. 정면·밝은 사진으로 다시 시도해 주세요.'
          : '옆얼굴 검출 실패(정상일 수 있음). 3/4 각도면 더 잘 잡힙니다.';
        refreshFaceBtn();
        return;
      }
      const metrics = (view === 'front')
        ? FaceRead.measureFront(lm, img.naturalWidth, img.naturalHeight)
        : FaceRead.measureProfile(lm, img.naturalWidth, img.naturalHeight, view);
      // 리포트용 축소 썸네일(오버레이 포함) — 가로 360px
      const scale = Math.min(1, 360 / cv.width);
      const tcv = document.createElement('canvas');
      tcv.width = Math.round(cv.width * scale); tcv.height = Math.round(cv.height * scale);
      tcv.getContext('2d').drawImage(cv, 0, 0, tcv.width, tcv.height);
      FACE[view] = { metrics, thumb: tcv.toDataURL('image/jpeg', 0.85) };
      stat.className = 'fs-stat fs-ok';
      stat.textContent = view === 'front' ? '✓ 정면 검출 완료 (468점)' : '✓ 측면 검출 완료';
      refreshFaceBtn();
    });
  };
  img.onerror = () => { stat.className = 'fs-stat fs-warn'; stat.textContent = '이미지를 읽을 수 없습니다.'; URL.revokeObjectURL(url); };
  img.src = url;
}

function refreshFaceBtn() {
  const btn = document.getElementById('btn-face');
  btn.textContent = FACE.front ? '관상까지 넣어 분석하기 ✦' : '정면 사진을 올리면 관상 분석이 켜집니다';
  btn.disabled = !FACE.front;
  btn.style.opacity = FACE.front ? '1' : '.55';
}

function buildFaceResult() {
  if (!FACE.front) { S.result.face = null; S.result.faceThumbs = null; return; }
  const res = FaceRead.interpret(FACE.front.metrics, FACE.left && FACE.left.metrics, FACE.right && FACE.right.metrics);
  const thumbs = [];
  if (FACE.front) thumbs.push({ url: FACE.front.thumb, label: '정면' });
  if (FACE.left) thumbs.push({ url: FACE.left.thumb, label: '좌측면' });
  if (FACE.right) thumbs.push({ url: FACE.right.thumb, label: '우측면' });
  S.result.face = res;
  S.result.faceThumbs = thumbs;
}

function finishFace() { buildFaceResult(); startAnalysis(); }
function skipFace() { S.result.face = null; S.result.faceThumbs = null; startAnalysis(); }

// ---------- 분석 ----------
const LOAD_MSGS = ['절기 시각을 대조하는 중', '이름의 오행을 읽는 중', '색의 결을 고르는 중',
                   '92개의 답을 저울에 다는 중', '네 개의 기둥을 세우는 중', '얼굴의 삼정을 재는 중'];
function startAnalysis() {
  go('loading');
  let i = 0;
  const t = setInterval(() => {
    document.getElementById('load-msg').textContent = LOAD_MSGS[++i % LOAD_MSGS.length];
  }, 700);

  setTimeout(() => {
    try { runEngines(); } finally { clearInterval(t); }
    renderSummary();
    go('summary');
  }, 2400);
}

function runEngines() {
  const [y, m, d] = S.date.split('-').map(Number);
  const [hh, mi] = S.time.split(':').map(Number);

  // ① 사주
  S.result.saju = computeSaju({
    year: y, month: m, day: d,
    hour: S.noHour ? null : hh, minute: S.noHour ? 0 : mi,
    calendar: S.cal, leapMonth: S.leap, gender: S.gender,
  });

  // ② 성명학 — 소리오행 (+ 한자 선택 시 수리)
  S.result.sori = analyzeSoriOhaeng(S.sur + S.giv);
  const surH = [...S.sur].map(c => S.hanja[c]).filter(Boolean);
  const givH = [...S.giv].map(c => S.hanja[c]).filter(Boolean);
  S.result.suri = (S.useHanja && surH.length === [...S.sur].length && givH.length === [...S.giv].length)
    ? analyzeSuri(surH, givH) : null;

  // ③ 도형 · ④ 컬러 · ⑤ 성향
  S.result.shape = SHAPE_INFO[S.shape];
  S.result.color = scorePersonalColor(S.colorAnswers);
  S.result.mbti = scoreAssessment(S.mbtiAnswers);

  // ⑥ 교차: 오행 보완색 + 서양 별자리 + 수비학·타로·탄생 상징
  if (!S.result.saju.error) {
    S.result.boost = ohaengBoostColor(S.result.saju.elements);
    const si = S.result.saju.input;
    S.result.west = getWesternZodiac(si.solarMonth, si.solarDay);
    S.result.num = computeNumerology(si.solarYear, si.solarMonth, si.solarDay);
    S.result.tarot = tarotBirthCard(si.solarYear, si.solarMonth, si.solarDay);
    S.result.symbols = birthSymbols(si.solarMonth);
  }
}

// ---------- 1차 요약 렌더 ----------
const ELEM_HEX = { 목:'#2E7D32', 화:'#C62828', 토:'#F9A825', 금:'#B0BEC5', 수:'#455A64' };

// 성향 4축 고유 색 (막대·라벨에 사용)
const AXIS_COLORS = {
  EI: { g:'linear-gradient(90deg,#ff9d6b,#ffc46b)', c:'#ffab6b' },   // 에너지 — 코랄·주황
  SN: { g:'linear-gradient(90deg,#5fbf87,#8fd6a6)', c:'#7ccf99' },   // 정보 — 그린
  TF: { g:'linear-gradient(90deg,#5aa8d8,#7fc4e0)', c:'#6db6dc' },   // 판단 — 블루
  JP: { g:'linear-gradient(90deg,#9a7ce8,#b59cf0)', c:'#a88cec' },   // 태도 — 바이올렛
};

// 양방향 축 막대: 중앙(50%)에서 우세한 쪽으로 뻗는다
function axisBarHtml(a) {
  const col = AXIS_COLORS[a.axis];
  const leftWin = a.letter === a.first;
  const span = Math.max(2, (a.pct - 50) * 2);          // 채움 길이(반쪽의 %)
  const bar = leftWin
    ? `<i style="right:50%; width:${span / 2}%; background:${col.g}; border-radius:6px 0 0 6px"></i>`
    : `<i style="left:50%; width:${span / 2}%; background:${col.g}; border-radius:0 6px 6px 0"></i>`;
  const L = `<span class="${leftWin ? 'win' : 'lose'}" ${leftWin ? `style="color:${col.c}"` : ''}>${a.firstName}(${a.first}) ${a.firstPct}%</span>`;
  const R = `<span class="${leftWin ? 'lose' : 'win'}" ${leftWin ? '' : `style="color:${col.c}"`}>${a.secondPct}% ${a.secondName}(${a.second})</span>`;
  return `<div class="axr">
    <div class="axname"><b>${a.theme}</b> · ${a.strength}</div>
    <div class="axr-top">${L}${R}</div>
    <div class="axtr">${bar}</div></div>`;
}

// 한자 뱃지 → 한글 독음 병기 (별님 지시: 한자 옆에 항상 한글)
const HANJA_KO = { 命:'명', 名:'명', 緣:'연', 運:'운', 像:'상', 相:'상', 格:'격', 跡:'적' };
const hanjaKo = h => HANJA_KO[h] ? `${h}(${HANJA_KO[h]})` : h;

function card(badge, t1, t2, bodyHtml) {
  return `<div class="sum"><div class="top"><div class="badge">${hanjaKo(badge)}</div>
    <div><div class="t1">${t1}</div><div class="t2">${t2}</div></div></div>
    <div class="body">${bodyHtml}</div></div>`;
}

function renderSummary() {
  document.getElementById('sum-name').textContent = `${S.sur}${S.giv} 님의 분석 결과`;
  const R = S.result;
  let html = '', warn = '';

  // 사주 카드
  if (R.saju.error) {
    warn += `<div class="warn">사주 계산 실패: ${R.saju.error}</div>`;
  } else {
    const sj = R.saju;
    if (sj.meta.boundaryWarn) warn += `<div class="warn">⚠ ${sj.meta.boundaryWarn}</div>`;
    const gj = sj.pillars.map(p =>
      `<div class="gj"><div class="h">${p.ganjiHanja} ${p.ganji}</div><div class="k">${p.name}</div><div class="p">${p.stemGod}</div></div>`).join('');
    const eb = sj.elements.map(e =>
      `<div class="ebar"><span class="nm">${e.name}(${e.hanja})</span><span class="tr"><i style="width:${e.pct}%;background:${ELEM_HEX[e.name]}"></i></span><span class="pc">${e.pct}%</span></div>`).join('');
    const lun = sj.lunar ? `음력 ${sj.lunar.year}-${sj.lunar.month}-${sj.lunar.day}${sj.lunar.leap ? '(윤)' : ''} · ` : '';
    const dw = sj.daewoon ? `<div class="t2" style="margin-top:8px">대운(${sj.daewoon.forward ? '순행' : '역행'}): ${sj.daewoon.list.slice(0, 4).map(w => w.age + '세 ' + w.ganji).join(' → ')} …</div>` : '';
    const westTag = R.west ? ` · ${R.west.sym} ${R.west.name}` : '';
    html += card('命', `사주팔자 — ${sj.dayMaster.stem}(${sj.dayMaster.hanja}) ${sj.dayMaster.elem} 일간`,
      `${lun}${sj.zodiac}${westTag} · 진태양시 보정 ${sj.meta.solarCorrectionMin}분`,
      `<div class="ganji-row">${gj}</div><div style="margin-top:12px">${eb}</div>${dw}`);
  }

  // 성명학 카드
  const so = R.sori;
  let nameBody = '';
  if (!so.error) {
    nameBody += `소리오행: ${so.chars.map(c => `${c.char}(${c.cho}·${c.elemName})`).join(' ')}<br/><b>${so.verdict}</b>`;
  }
  if (R.suri) {
    nameBody += `<div style="margin-top:10px">${R.suri.gyeok.map(g =>
      `${g.key} ${g.num}수 <b>[${g.grade}]</b> ${g.name}`).join('<br/>')}</div>`;
  } else {
    nameBody += `<div class="t2" style="margin-top:8px">한자를 선택하시면 수리사격(원형이정) 분석이 더해집니다.</div>`;
  }
  html += card('名', '이름의 소리와 수리', `${S.sur}${S.giv}`, nameBody);

  // 도형 + 컬러 카드
  const sh = R.shape, co = R.color;
  const sws = co.best.slice(0, 8).map(h => `<span class="sw" style="background:${h}"></span>`).join('');
  let colorBody = `<b style="color:${sh.color}">${sh.emoji} ${sh.name} — ${sh.arche}</b><br/><span style="font-size:15px">${sh.desc}</span>
    <div style="margin-top:12px"><b>${co.emoji} ${co.type}</b> (${co.tone}톤 · ${co.axes.brightness.value} · ${co.axes.saturation.value})<br/>
    <span style="font-size:15px">${co.desc}</span></div><div class="swatches">${sws}</div>`;
  if (co.neutralNote) colorBody += `<div class="t2" style="margin-top:8px">${co.neutralNote}</div>`;
  if (R.boost) colorBody += `<div style="margin-top:10px; font-size:15px; border-top:1px solid var(--line); padding-top:10px">
    🎨 <b>오행 보완색</b> — ${R.boost.advice}</div>`;
  html += card('像', '도형과 색 — 무의식의 언어', `${sh.name} · ${co.type}`, colorBody);

  // 성향 카드
  const mb = R.mbti;
  const axBars = mb.axes.map(axisBarHtml).join('');
  html += card('格', `${mb.type} — ${mb.typeName}`, mb.brief, axBars);

  // 관상 카드 (사진을 넣은 경우에만)
  if (R.face && R.face.ok) {
    html += card('相', '관상 — 얼굴에 새겨진 나', R.face.oheng.info.key, FaceRead.summaryHtml(R.face));
  }

  document.getElementById('sum-warn').innerHTML = warn;
  document.getElementById('sum-cards').innerHTML = html;

  // 프로필 자동 저장 (브라우저 안에만)
  saveProfile();
}

// ═══════════════ 프로필 저장소 (localStorage DB) ═══════════════
const PROFILE_KEY = 'selflog_profiles';

function getProfiles() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch (e) { return {}; }
}
function setProfiles(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) {}
}

function saveProfile() {
  const key = `${S.sur}${S.giv}|${S.date}`;
  const profiles = getProfiles();
  profiles[key] = {
    when: new Date().toISOString(),
    data: { sur:S.sur, giv:S.giv, gender:S.gender, blood:S.blood,
            cal:S.cal, date:S.date, leap:S.leap, time:S.time, noHour:S.noHour,
            useHanja:S.useHanja, hanja:S.hanja, shape:S.shape,
            colorAnswers:S.colorAnswers, mbtiAnswers:S.mbtiAnswers },
  };
  setProfiles(profiles);
}

function renderProfiles() {
  const card = document.getElementById('profile-card');
  const list = document.getElementById('profile-list');
  const profiles = getProfiles();
  const keys = Object.keys(profiles).sort((a,b) => profiles[b].when.localeCompare(profiles[a].when));
  if (!keys.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  list.innerHTML = '';
  for (const key of keys) {
    const p = profiles[key];
    const [name, birth] = key.split('|');
    const sh = SHAPE_INFO[p.data.shape];
    const row = document.createElement('div');
    row.className = 'prof';
    row.innerHTML = `<span class="pemoji">${sh ? sh.emoji : '✦'}</span>
      <span class="pinfo"><span class="pname">${name}</span><br/>
      <span class="pmeta">${birth} · ${new Date(p.when).toLocaleDateString('ko-KR')} 검사</span></span>
      <button class="pdel" title="삭제">✕</button>`;
    row.querySelector('.pdel').onclick = (e) => {
      e.stopPropagation();
      if (!confirm(`'${name}' 여정을 삭제할까요?`)) return;
      const ps = getProfiles(); delete ps[key]; setProfiles(ps); renderProfiles();
    };
    row.onclick = () => loadProfile(key);
    list.appendChild(row);
  }
}

function loadProfile(key) {
  const p = getProfiles()[key];
  if (!p) return;
  Object.assign(S, p.data);
  S.result.face = null; S.result.faceThumbs = null;   // 저장 프로필엔 사진이 없음(관상 제외)
  runEngines();
  renderSummary();
  go('summary');
}

function exportProfiles() {
  const blob = new Blob([JSON.stringify({ app:'나를 찾는 여정', version:1, profiles:getProfiles() }, null, 2)],
                        { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `나를 찾는 여정_저장본_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importProfiles(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      const incoming = obj.profiles || obj;      // 포맷 유연 수용
      const profiles = getProfiles();
      let n = 0;
      for (const [k, v] of Object.entries(incoming))
        if (v && v.data && v.data.mbtiAnswers) { profiles[k] = v; n++; }
      setProfiles(profiles);
      renderProfiles();
      alert(n ? `${n}개의 여정을 가져왔습니다.` : '가져올 수 있는 여정이 없습니다.');
    } catch (e) { alert('파일을 읽을 수 없습니다. 내보내기로 만든 JSON 파일인지 확인해 주세요.'); }
  };
  reader.readAsText(file);
  input.value = '';
}

// 첫 화면에서 저장된 프로필 표시
renderProfiles();

// ═══════════════ 통합 리포트 (命·像·格·跡) ═══════════════
function showReport() { renderReport(); go('report'); }

function chapter(hanja, tt, st, inner) {
  return `<div class="rpt-ch"><div class="head"><span class="hanja">${hanjaKo(hanja)}</span>
    <span class="tt">${tt}</span><span class="st">${st}</span></div>${inner}</div>`;
}
function sec(title, html) { return `<div class="rpt-sec"><h4>${title}</h4>${html}</div>`; }

function renderReport() {
  const R = S.result, fullName = S.sur + S.giv;
  document.getElementById('rpt-title').textContent = `${fullName} — 나를 찾는 여정`;
  document.getElementById('rpt-date').textContent =
    `${new Date().toLocaleDateString('ko-KR')} · 다섯 개의 거울, 네 개의 장`;
  document.getElementById('rpt-decl').textContent =
    generateDeclaration(fullName, R.saju, R.shape, R.color, R.mbti);

  let html = '';

  // ─── 제1장 命 ───
  let m = '';
  if (!R.saju.error) {
    const sj = R.saju, il = ILGAN_DESC[sj.dayMaster.stem];
    const gj = sj.pillars.map(p =>
      `<div class="gj"><div class="h">${p.ganjiHanja} ${p.ganji}</div><div class="k">${p.name}</div><div class="p">${p.stemGod}</div></div>`).join('');
    const eb = sj.elements.map(e =>
      `<div class="ebar"><span class="nm">${e.name}(${e.hanja})</span><span class="tr"><i style="width:${e.pct}%;background:${ELEM_HEX[e.name]}"></i></span><span class="pc">${e.pct}%</span></div>`).join('');
    const strong = [...sj.elements].sort((a,b)=>b.pct-a.pct)[0];
    const weak = [...sj.elements].sort((a,b)=>a.pct-b.pct)[0];

    m += sec(`일간 — ${sj.dayMaster.stem}(${sj.dayMaster.hanja}) ${sj.dayMaster.yinyang}의 ${sj.dayMaster.elem}`,
      `<p><b>${il.symbol}</b></p><p>${il.text}</p>`);
    m += sec('사주팔자 네 기둥',
      `<div class="ganji-row">${gj}</div>
       <p class="sub" style="margin-top:8px">${sj.lunar ? `음력 ${sj.lunar.year}-${sj.lunar.month}-${sj.lunar.day}${sj.lunar.leap?'(윤)':''} · ` : ''}${sj.zodiac} · ${sj.meta.note}</p>
       ${sj.meta.boundaryWarn ? `<p class="sub" style="color:#e3c877">⚠ ${sj.meta.boundaryWarn}</p>` : ''}`);
    m += sec('오행의 저울',
      `${eb}<p style="margin-top:10px"><b>${strong.name}(${strong.hanja})</b>이 ${strong.pct}%로 가장 강하고, <b>${weak.name}(${weak.hanja})</b>은 ${weak.pct}%로 가장 여립니다.
       ${R.boost ? '<span class="sub">보완하는 색은 제2장에서 이어집니다.</span>' : ''}</p>`);
    const ss = analyzeSibseong(sj.pillars);
    m += sec(`십성의 무게중심 — ${ss.top}(${ss.topInfo.theme})`,
      `<p>${Object.entries(ss.counts).map(([g,c])=>`<span class="tag${g===ss.top?' gold':''}">${g} ${c}</span>`).join('')}</p>
       <p>${ss.topInfo.text}</p>
       ${ss.missing.length ? `<p class="sub">비어 있는 십성(${ss.missing.join('·')})은 결핍이 아니라, 인생에서 따로 배워 채우는 과목입니다.</p>` : ''}`);
    if (sj.daewoon)
      m += sec(`대운의 흐름 — ${sj.daewoon.startAge}세부터 ${sj.daewoon.forward ? '순행' : '역행'}`,
        `<p>${sj.daewoon.list.map(w=>`<span class="tag">${w.age}세 ${w.ganjiHanja} ${w.ganji}</span>`).join('')}</p>
         <p class="sub">10년마다 바뀌는 큰 계절입니다. 간지의 오행이 내 일간을 돕는 시기가 순풍의 때입니다.</p>`);
  }
  // 성명학
  const so = R.sori;
  let nm = '';
  if (!so.error) {
    nm += `<p>${so.chars.map(c=>`<span class="tag">${c.char} ${c.cho}·${c.elemName}</span>`).join('')}</p>
      <p>${so.flows.map(f=>`${f.pair} <b>${f.rel}</b>`).join(' · ')} → <b>${so.verdict}</b></p>`;
  }
  if (R.suri) {
    nm += `<p style="margin-top:8px">${R.suri.chars.map(c=>`<span class="tag gold">${c.char} ${c.strokes}획</span>`).join('')}</p>`
        + R.suri.gyeok.map(g=>`<p><b>${g.key}</b> ${g.num}수 [${g.grade}] ${g.name} — ${g.desc} <span class="sub">(${g.period})</span></p>`).join('');
  } else nm += `<p class="sub">한자 이름을 선택하시면 수리사격(원형이정) 풀이가 더해집니다.</p>`;
  m += sec('이름 — 소리의 오행과 수리의 격', nm);
  if (S.blood && BLOOD_DESC[S.blood])
    m += sec(`혈액형 ${S.blood}형`, `<p>${BLOOD_DESC[S.blood]}</p><p class="sub">혈액형 기질론은 과학적 근거보다는 통용되는 참고 정보로 담았습니다.</p>`);
  if (R.west) {
    const w = R.west;
    const WELEM_COLOR = { 불:'#ff8a65', 물:'#64b5f6', 공기:'#80deea', 흙:'#d4a75c' };
    const wc = WELEM_COLOR[w.elem];
    const combo = comboReading(R.saju.zodiac, w);
    m += sec(`서쪽 하늘의 지도 — ${w.sym} ${w.name}`,
      `<p><span class="tag" style="border-color:${wc}; color:${wc}; text-shadow:0 0 12px ${wc}55">${w.elem}의 별</span><span class="tag">${w.quality}궁</span><span class="tag">지배성 ${w.planet}</span></p>
       <p>${w.desc}</p>
       <p>💗 <b>사랑의 방식</b> — ${w.love}</p>
       <p>💫 <b>환상의 짝</b>: ${w.best.join(' · ')} &nbsp;|&nbsp; 🔧 <b>조율의 짝</b>: ${w.care.join(' · ')}</p>
       ${combo ? `<p style="margin-top:10px; border-top:1px solid var(--line); padding-top:10px">🌏🌍 <b>동서양 하늘의 겹침</b> — ${combo}</p>` : ''}
       <p class="sub">동양의 사주가 태어난 "시각"의 하늘이라면, 별자리는 태어난 "계절"의 태양이 지나던 자리입니다.</p>`);
  }
  if (R.num) {
    const n = R.num;
    m += sec(`서쪽 수의 지도 — 생애 경로수 ${n.lifePath}`,
      `<p><span class="tag gold">경로수 ${n.lifePath} · ${n.lifePathInfo.key}</span><span class="tag">생일수 ${n.birthday}</span></p>
       <p>${n.lifePathInfo.text}</p>
       <p>🎂 태어난 날의 수 <b>${n.birthday}</b> — ${n.birthdayInfo}.</p>
       <p class="sub">동양의 성명학이 이름의 획수로 격(格)을 세운다면, 서양의 수비학은 생년월일의 수로 길을 읽습니다. ${n.lifePathParts.join('+')} → ${n.lifePath}.</p>`);
  }
  html += chapter('命', '제1장 · 부여받은 지도', '시간과 이름에 새겨진 나', m);

  // ─── 제2장 緣 (인연의 지도) ───
  if (!R.saju.error) {
    const sj = R.saju;
    let e2 = '';
    const rel = relationMap(sj);
    e2 += sec('나와 좋은 인연',
      rel.good.map(g => `<p>💛 <b>${g.who}</b><br/><span class="sub">${g.why}</span></p>`).join('') +
      `<p style="margin-top:8px">${rel.zodiacGood.map(z => `<span class="tag gold">${z.who}</span>`).join('')}</p>` +
      rel.zodiacGood.map(z => `<p class="sub">· ${z.who} — ${z.why}</p>`).join(''));
    e2 += sec('나와 상반되는 인연 — 피하라는 뜻이 아닙니다',
      rel.bad.map(g => `<p>⚡ <b>${g.who}</b><br/><span class="sub">${g.why}</span></p>`).join('') +
      rel.zodiacBad.map(z => `<p>⚡ <b>${z.who}</b><br/><span class="sub">${z.why}</span></p>`).join('') +
      `<p class="sub" style="margin-top:6px">상반은 "나쁜 사람"이 아니라 "노력이 필요한 자리"입니다. 오히려 나를 크게 성장시키는 인연이 이 안에 있습니다.</p>`);
    const love = loveRecommendation(sj, R.mbti.type, S.gender);
    if (R.west) love.points.push(`별자리의 짝: ${R.west.best.join(', ')} — ${R.west.sym} ${R.west.name}인 나의 불꽃을 키워주는 별`);
    e2 += sec('연애 상대 추천 — 사주·성향·별자리 삼중 렌즈',
      `<p><b>${love.summary}</b></p>` +
      love.points.map(p => `<p>· ${p}</p>`).join('') +
      `<p style="margin-top:8px">${love.advice}</p>`);
    const mar = marriageFortune(sj, S.gender);
    e2 += sec(`결혼·배우자운 — ${mar.starName} ${mar.count}개`,
      `<p>${mar.text}</p><p class="sub" style="margin-top:8px">${mar.iljiIntro}</p><p>${mar.iljiText}</p>`);
    const par = parentsFortune(sj);
    e2 += sec('부모운',
      `<p>${par.text}</p><p class="sub" style="margin-top:8px">${par.woljuIntro}</p><p>${par.woljuText}</p>`);
    const chd = childrenFortune(sj, S.gender);
    e2 += sec(`자녀운 — ${chd.starName} ${chd.count}개`,
      `<p>${chd.text}</p>` +
      (chd.sijuText ? `<p class="sub" style="margin-top:8px">${chd.sijuIntro}</p><p>${chd.sijuText}</p>`
                    : `<p class="sub">출생 시각이 없어 자녀궁(시주) 풀이는 생략되었습니다.</p>`));
    const gw = gungwiReading(sj).find(g => g.gung === '년주');
    if (gw) e2 += sec('뿌리 — 조상과 초년의 자리',
      `<p class="sub">${gw.intro}</p><p>${gw.text}</p>`);
    html += chapter('緣', '제2장 · 인연의 지도', '나를 둘러싼 사람들의 자리', e2);
  }

  // ─── 제3장 運 (다가오는 시간) ───
  if (!R.saju.error) {
    const sj = R.saju;
    const nowY = new Date().getFullYear();
    const yf = yearlyFortune(sj, nowY);
    let e3 = '';
    e3 += sec(`${yf.year}년 ${yf.ganjiHanja} ${yf.ganji}년 — [${yf.god}] ${yf.theme}`,
      `<p>${yf.text}</p>` + (yf.zodiacNote ? `<p style="margin-top:8px">🔎 ${yf.zodiacNote}</p>` : ''));
    e3 += sec('열두 달의 흐름 (절기 기준)',
      yf.months.map(mo =>
        `<p>· <b>${mo.label}</b> ${mo.ganji} [${mo.god}] — ${mo.line}</p>`).join('') +
      `<p class="sub" style="margin-top:6px">월은 절기(節氣)로 바뀌므로 양력 달과 1주일 안팎 차이가 있을 수 있습니다.</p>`);
    if (R.west) {
      const wy = yearlyZodiacFortune(nowY, R.west);
      e3 += sec(`${R.west.sym} ${R.west.name}의 ${nowY}년 — 「${wy.rel}」의 해`,
        `<p>${wy.text}</p><p>🧭 ${wy.advice}</p>
         <p class="sub">동양의 세운(歲運) 오행과 서양 별자리의 원소를 교차해 읽은, 이 프로그램만의 풀이입니다.</p>`);
    }
    html += chapter('運', '제3장 · 다가오는 시간', `${yf.year}년 한 해의 지도`, e3);
  }

  // ─── 제4장 像 ───
  const sh = R.shape, sd = SHAPE_DEEP[S.shape], co = R.color;
  let i2 = '';
  i2 += sec(`끌린 도형 — ${sh.emoji} ${sh.name}`,
    `<p><b style="color:${sh.color}">${sh.arche}</b></p><p>${sh.desc}</p>
     <p>💪 <b>강점</b> — ${sd.strength}</p><p>🌑 <b>그림자</b> — ${sd.shadow}</p><p>💡 ${sd.tip}</p>`);
  const bests = co.best.map(h=>`<span class="sw" style="background:${h}"></span>`).join('');
  const worsts = co.worst.map(h=>`<span class="sw" style="background:${h}; opacity:.55"></span>`).join('');
  i2 += sec(`나의 색 — ${co.emoji} ${co.type}`,
    `<p>${co.desc}</p>
     <p class="sub">${co.tone}톤 · ${co.axes.brightness.value} · ${co.axes.saturation.value}${co.neutralNote ? ' · ' + co.neutralNote : ''}</p>
     <p style="margin-top:8px"><b>어울리는 색</b></p><div class="swatches">${bests}</div>
     <p style="margin-top:10px"><b>피하면 좋은 색</b></p><div class="swatches">${worsts}</div>`);
  if (R.boost) {
    i2 += sec('命과 像의 교차 — 채워주는 색',
      `<p><span class="sw" style="display:inline-block; vertical-align:middle; background:${R.boost.color.hex}"></span>
       &nbsp;${R.boost.advice}</p>
       <p class="sub">어울리는 색(퍼스널 컬러)이 겉을 빛낸다면, 보완색(오방색)은 안을 채웁니다.</p>`);
  }
  if (R.symbols && R.tarot) {
    const sb = R.symbols, tc = R.tarot;
    i2 += sec('나를 상징하는 것들 — 보석 · 꽃 · 카드',
      `<p><span class="sw" style="display:inline-block; vertical-align:middle; background:${sb.hex}"></span>
       &nbsp;💎 <b>탄생석 ${sb.stone}</b> — ${sb.stoneMeaning}</p>
       <p>🌸 <b>탄생화 ${sb.flower}</b> — 꽃말은 "${sb.flowerMeaning}"</p>
       <p>🎴 <b>타로 탄생 카드 ${tc.n} · ${tc.name}(${tc.en})</b><br/>${tc.line}</p>
       <p class="sub">생년월일이 정해주는 서양의 세 상징입니다. 표지 색, 소지품, 선물의 힌트로 쓰세요.</p>`);
  }
  html += chapter('像', '제4장 · 선과 색의 언어', '도형과 색채로 보는 무의식', i2);

  // ─── 제5장 相 (관상) ───
  if (R.face && R.face.ok) {
    const faceInner = FaceRead.reportHtml(R.face, R.faceThumbs);
    html += chapter('相', '제5장 · 얼굴에 새겨진 나', '관상 — 삼정·오행형·십이궁', faceInner);
  }

  // ─── 제6장 格 ───
  const mb = R.mbti, td = TYPE_DEEP[mb.type];
  let i3 = '';
  i3 += sec(`${mb.type} — ${mb.typeName}`,
    `<p>${mb.brief}</p>${mb.axes.map(axisBarHtml).join('')}`);
  i3 += sec('삶의 세 장면',
    `<p>🏢 <b>일</b> — ${td.work}</p><p>🤝 <b>관계</b> — ${td.rel}</p><p>⚖️ <b>균형</b> — ${td.caution}</p>`);
  const cross = crossShapeMbti(S.shape, mb.type);
  i3 += sec(`무의식과 의식의 대조 — ${cross.verdict}`,
    `<p>${cross.text}</p><p class="sub">도형(무의식적 끌림)과 92문항(의식적 자기보고)을 겹쳐 본 결과입니다.</p>`);
  html += chapter('格', '제6장 · 성향과 강점의 조화', '데이터가 말하는 나의 페르소나', i3);

  // ─── 제4장 跡 ───
  let i4 = '';
  i4 += sec('네 겹을 겹쳐 보면',
    `<p>${generateDeclaration(fullName, R.saju, R.shape, R.color, R.mbti)}</p>
     <p>타고난 명(命)은 지도이고, 무의식의 상(像)은 나침반이며, 정립된 격(格)은 걸음걸이입니다.
     그러나 지도의 어느 길을 걸을지는 오직 걸어온 발자국(跡)만이 말해 줍니다.</p>`);
  i4 += sec('이제, 당신이 쓸 차례',
    `<p>이 리포트가 밝힌 것은 재료까지입니다. 그 재료로 어떤 이야기를 지어 왔는지 —
     인생의 변곡점, 그때의 선택, 남기고 싶은 것 — 은 세상 어떤 도구도 대신 쓸 수 없습니다.</p>
     <p><b>이 리포트를 첫 페이지 삼아, 당신의 자서전을 시작해 보세요.</b></p>`);
  html += chapter('跡', '제7장 · 나를 쓰다', '시간의 궤적과 남겨질 유산', i4);

  document.getElementById('rpt-body').innerHTML = html;
}

// ═══════════════ 궁합 ═══════════════
let ghGender = '';
bindChips('gh-gender', v => ghGender = v);

function runGunghap() {
  const err = document.getElementById('gh-err');
  const name = document.getElementById('gh-name').value.trim() || '그 사람';
  const cal = document.getElementById('gh-cal').value;
  const date = document.getElementById('gh-date').value;
  const time = document.getElementById('gh-time').value;

  if (!date) { err.textContent = '상대의 생년월일을 입력해 주세요.'; return; }
  if (!ghGender) { err.textContent = '상대의 성별을 선택해 주세요.'; return; }
  if (S.result.saju?.error || !S.result.saju) { err.textContent = '내 사주가 먼저 계산되어야 합니다.'; return; }
  err.textContent = '';

  const [y, m, d] = date.split('-').map(Number);
  const [hh, mi] = time ? time.split(':').map(Number) : [null, 0];
  const other = computeSaju({ year: y, month: m, day: d, hour: hh, minute: mi || 0,
                              calendar: cal, gender: ghGender });
  if (other.error) { err.textContent = other.error; return; }

  const c = compatAnalysis(S.result.saju, other, S.gender);
  const box = document.getElementById('gh-result');
  const pts = c.points.map(p =>
    `<div class="rpt-sec"><h4>${p.mark} ${p.title}</h4><p>${p.text}</p></div>`).join('');
  box.innerHTML = `
    <div class="rpt-cover" style="padding:28px 10px 6px">
      <div class="kicker">MATCH RESULT</div>
      <div class="big" style="font-size:26px">${S.sur}${S.giv} ♥ ${name}</div>
      <p class="hint">${c.myIlgan} 일간 · ${c.myZodiac} ↔ ${c.otIlgan} 일간 · ${c.otZodiac}</p>
      <div class="rpt-decl">
        <div style="font-size:38px; font-weight:800; color:var(--gold)">${c.score}점</div>
        <b>${c.grade.name}</b><br/><span style="font-size:15px">${c.grade.desc}</span>
      </div>
    </div>
    ${pts}
    <div class="rpt-sec"><h4>📌 읽는 법</h4>
      <p class="sub">궁합 점수는 일간의 합·십성, 띠의 삼합·육합·충·원진, 배우자궁(일지)의 합, 오행 상호 보완을 정통 명리 방식으로 합산한 것입니다. 시각을 입력하지 않으면 시주를 제외하고 계산합니다. 점수는 "정해진 운명"이 아니라 두 사람의 출발선입니다.</p></div>`;
  box.scrollIntoView({ behavior: 'smooth' });
}
