/* ============================================================
   꿈해몽 검색 엔진  dream.js
   - 데이터: dream_data.js 의 DREAM_DB (전통 한국 꿈풀이 사전)
   - 키워드 유사 검색 → 관련 해몽 반환
   - 전역: window.searchDreams(query), window.dreamCategories()
   ============================================================ */
(function (global) {
'use strict';

function db() { return (typeof DREAM_DB !== 'undefined' && Array.isArray(DREAM_DB)) ? DREAM_DB : []; }

function searchDreams(query) {
  const q = (query || '').trim();
  if (!q) return [];
  const terms = q.split(/[\s,·]+/).filter(Boolean);
  const scored = [];
  for (const e of db()) {
    let score = 0;
    const kws = e.kw || [];
    for (const t of terms) {
      for (let ki = 0; ki < kws.length; ki++) {
        const k = kws[ki];
        if (k === t) score += (ki === 0 ? 20 : 12);          // 대표어 정확매치는 최우선
        else if (k.includes(t)) score += (t.length >= 2 ? 5 : 2); // 한 글자 부분매치는 약하게
        else if (t.includes(k)) score += 4;
      }
      if (e.short && e.short.includes(t)) score += 3;
      if (e.text && e.text.includes(t)) score += 1;
    }
    if (score > 0) scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 15).map(x => x.e);
}

function dreamCategories() {
  const seen = {}, out = [];
  for (const e of db()) if (e.cat && !seen[e.cat]) { seen[e.cat] = 1; out.push(e.cat); }
  return out;
}

// 대표 검색어(빠른 태그용)
function dreamPopular() {
  return ['돼지','뱀','용','호랑이','물고기','똥','이빨','물','불','돈','죽은사람','조상','아기','집','불',].filter((v,i,a)=>a.indexOf(v)===i);
}

global.searchDreams = searchDreams;
global.dreamCategories = dreamCategories;
global.dreamPopular = dreamPopular;

})(window);
