/* Быстрый оценщик стратегий с резервом в node по выгруженным рядам (agent_export.js).
   Повторяет edgeOf из simple.js (комиссия 0,1%, решение по вчерашнему дню, худший из двух сдвигов исполнения),
   плюс метрики под цель: близость покупок резерва к дну и продаж к вершине.
   Использование: const S = require('./agent_sim.js'); const G = S.groups(); S.evalAll(G, strategy) ... */
const fs = require('fs');
const DD = process.env.AGENT_DATA || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent_data';
const FEE = 0.001, UNIT = 10;
const PAGES = { sel: ['strategy-builder-sol', 'valid'], ex: ['exam', 'memes6'], rnd: ['rnd0', 'rnd1', 'rnd2', 'rnd3', 'rnd4'], n100: ['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9'], met: ['metals'] };

function loadPage(nm) {
  const j = JSON.parse(fs.readFileSync(`${DD}/${nm}.json`, 'utf8')), buf = fs.readFileSync(`${DD}/${nm}.bin`);
  const all = new Float64Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  const A = j.meta.map((m) => {
    const X = { name: m.name, page: nm, n: m.n, N: m.N, ind: {} };
    m.cols.forEach((c, q) => { X.ind[c] = all.subarray(m.off + q * m.n, m.off + (q + 1) * m.n); });
    X.c = X.ind.c; X.t = X.ind.t; X.l = X.ind.l; X.h = X.ind.h;
    derive(X);
    return X;
  });
  A.ref = j.ref;
  return A;
}
const cache = {};
function groups(list = ['sel', 'ex', 'rnd']) { const G = {}; for (const g of list) G[g] = PAGES[g].flatMap((p) => (cache[p] = cache[p] || loadPage(p))); return G; }

// производные индикаторы (всё считается по прошлым данным, можно повторить вживую)
function derive(X) {
  const n = X.n, c = X.c, add = (k, f) => { const a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = f(i); X.ind[k] = a; };
  const ba = X.ind.btcath;
  // глубина просадки биткоина/монеты, сколько дней подряд держится паника/страх
  const runOf = (cond) => { const a = new Float64Array(n); let r = 0; for (let i = 0; i < n; i++) { r = cond(i) ? r + 1 : 0; a[i] = r; } return a; };
  const I = X.ind;
  X.ind.panicd = runOf((i) => I.usdt[i] > 1.07 && I.othd[i] < 25);
  X.ind.feard = runOf((i) => I.fng[i] < 52 && I.usdtd[i] < 7.6);
  X.ind.fng10d = runOf((i) => I.fng[i] < 10);
  X.ind.qtrun = runOf((i) => I.qt[i] > 0.5);
  X.ind.hotd = runOf((i) => I.fund30[i] > 2);
  // монета: просадка от максимума за 365 дней, %, и рост от минимума за 90 дней, %
  add('dd365', (i) => { let m = 0; for (let j = Math.max(0, i - 364); j <= i; j++) if (c[j] > m) m = c[j]; return (1 - c[i] / m) * 100; });
  add('up90', (i) => { let m = Infinity; for (let j = Math.max(0, i - 89); j <= i; j++) if (c[j] < m) m = c[j]; return (c[i] / m - 1) * 100; });
  // рост монеты к средней 200 уже есть (sma200); дни с последнего страха-продажи
  { let s = NaN; const a = new Float64Array(n); for (let i = 0; i < n; i++) { if (I.fng[i] < 52 && I.usdtd[i] < 7.6) s = 0; else s = s + 1; a[i] = s; } X.ind.fearoff = a; }
}

const compile = (X, rules) => rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])).map((r) => ({ act: r.act, cs: r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v]), r }));
function decide(R, j) {
  for (let q = 0; q < R.length; q++) { const cs = R[q].cs; let ok = true; for (let k = 0; k < cs.length; k++) { const v = cs[k][0][j]; if (!(cs[k][1] ? v < cs[k][2] : v > cs[k][2])) { ok = false; break; } } if (ok) return q; }
  return -1;
}
// один актив: итог к DCA, %, и сделки (при rec): покупки резерва (сверх взноса) и продажи
function edge(X, S, lag, part = 'full', rec = false, hs = 1) {
  let a0 = 0, b = X.n; if (part === 'h1') b = Math.floor(X.n / 2); if (part === 'h2') a0 = Math.floor(X.n / 2);
  const c = X.c, R = compile(X, S.rules), M = S.mods ? compile(X, S.mods.map((m) => ({ act: m.mult, conds: m.conds }))) : [];
  // шорт (S.short): {entry: [[условия]...] — открыть, если выполнен любой набор; exit: [[условия]...]; size — доля капитала; rate — проценты в день; maxd — не дольше N дней}
  const SH = S.short, EN = SH ? compile(X, SH.entry.map((cs) => ({ act: 1, conds: cs }))) : [], EXR = SH ? compile(X, SH.exit.map((cs) => ({ act: 1, conds: cs }))) : [];
  let cash = 0, units = 0, du = 0, su = 0, shc = 0, sd = 0, liq = 0, shp = 0; const tr = rec ? [] : null;
  for (let i = a0; i < b; i++) {
    const p = c[i], j = i - 1 - lag; du += (UNIT * (1 - FEE)) / p;
    const q = j >= 0 ? decide(R, j) : -2, before = cash;
    let a = q >= 0 ? R[q].act : q === -2 ? 1 : S.base, m = 1;
    if (q === -1 && M.length) { const mq = decide(M, j); if (mq >= 0) m = M[mq].act; }
    cash += UNIT;
    if (a < 0) { const amt = -a * units * p; if (amt > 0) { units -= amt / p; cash += amt * (1 - FEE); if (rec) tr.push({ i, s: -1, amt, p, q }); } }
    else if (a > 0) { const amt = Math.min(cash, m !== 1 ? UNIT * m : UNIT + (a - 1) * before); units += (amt * (1 - FEE)) / p; cash -= amt; if (rec && amt > UNIT + 1e-9) tr.push({ i, s: 1, amt: amt - UNIT, p, q }); }
    if (SH && j >= 0) {
      if (su > 0) { const fee = su * p * SH.rate; cash -= fee; shp -= fee; sd++; }
      if (su > 0 && (decide(EXR, j) >= 0 || sd >= (SH.maxd || 1e9))) { const cost = su * p * (1 + FEE); cash += shc - cost; shp += shc - cost; su = 0; shc = 0; sd = 0; if (rec) tr.push({ i, s: 2, p }); }
      else if (su === 0 && decide(EN, j) >= 0 && decide(EXR, j) < 0) { const eq = cash + units * p; if (eq > 0) { su = (SH.size * eq) / p; shc = su * p * (1 - FEE); shp -= su * p * FEE; sd = 0; if (rec) tr.push({ i, s: -2, p }); } }
      if (su > 0) { const hi = Math.min(Math.max(X.h[i] || p, p), 2 * Math.max(p, c[i - 1] || p)) * hs, lo = Math.max(Math.min(X.l[i] || p, p), 0.5 * Math.min(p, c[i - 1] || p)) * (2 - hs); /* сбои архива: тени дальше чем вдвое от закрытия обрезаем */ if ((cash + shc + units * lo) / (su * hi) <= 1.1) { liq++; cash = 0; units = 0; su = 0; shc = 0; sd = 0; } }
    }
  }
  const dca = du * c[b - 1], fin = units * c[b - 1] + cash + shc - su * c[b - 1];
  return { e: (fin / dca - 1) * 100, tr, fin, dca, units, cash, liq, shp };
}
const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const stat = (full, halves) => ({ n: full.length, pos: full.filter((x) => x > 0).length, worst: Math.min(...full), med: med(full), hpos: halves.filter((x) => x > 0).length, hn: halves.length, hworst: Math.min(...halves) });
const E = (X, S, part) => Math.min(edge(X, S, 0, part).e, edge(X, S, 1, part).e);
function evalGroup(A, S) {
  const full = A.map((X) => E(X, S, 'full')), halves = A.flatMap((X) => [E(X, S, 'h1'), E(X, S, 'h2')]);
  return { ...stat(full, halves), e: full };
}

// ---------- метрики близости к дну и к вершине ----------
// окна по будущему используются ТОЛЬКО для оценки, не для решений
function prepM(X) {
  if (X.M) return X.M;
  const c = X.c, n = X.n, minF = new Float64Array(n), minW = new Float64Array(n), maxW = new Float64Array(n), bot = [], top = [];
  const slide = (w0, w1, f, init) => { const o = new Float64Array(n); for (let i = 0; i < n; i++) { let m = init; for (let j = Math.max(0, i - w0); j <= Math.min(n - 1, i + w1); j++) m = f(m, c[j]); o[i] = m; } return o; };
  const mf = slide(0, 90, Math.min, Infinity), mw = slide(180, 180, Math.min, Infinity), xw = slide(90, 90, Math.max, 0), xw180 = slide(180, 180, Math.max, 0), pmax = slide(365, -1, Math.max, 0), pmin = slide(365, -1, Math.min, Infinity);
  for (let i = 200; i < n - 30; i++) { if (c[i] === mw[i] && c[i] <= 0.5 * pmax[i]) bot.push(i); if (c[i] === xw180[i] && c[i] >= 2 * pmin[i]) top.push(i); }
  return (X.M = { minF: mf, minW: mw, maxW: xw, bot, top });
}
// окна по будущему используются ТОЛЬКО для оценки, не для решений
function metrics(A, S) {
  let bAbove = 0, zW = 0, totB = 0, sw = 0, sTop = 0, bott = 0, bottHit = 0, bottBuys = 0, bott3 = 0, tops = 0, topsMissed = 0, nb = 0, ns = 0;
  for (const X of A) {
    const c = X.c, M = prepM(X), { tr } = edge(X, S, 0, 'full', true);
    for (const t of tr) {
      if (t.s > 0) { nb++; totB += t.amt; bAbove += t.amt * (t.p / M.minF[t.i] - 1); if (t.p <= 1.15 * M.minW[t.i]) zW += t.amt; }
      else { ns++; sw += t.amt; sTop += t.amt * (t.p / M.maxW[t.i]); }
    }
    // крупные дна: минимум за ±180 дней и падение от максимума за прошлый год ≥ 50%; крупные вершины: максимум за ±180 дней и рост ≥ 2× от минимума за прошлый год
    for (const i of M.bot) { bott++; const days = new Set(tr.filter((t) => t.s > 0 && Math.abs(t.i - i) <= 120 && t.p <= 1.15 * c[i]).map((t) => t.i)); if (days.size) bottHit++; if (days.size >= 3) bott3++; bottBuys += days.size; }
    for (const i of M.top) { tops++; if (!tr.some((t) => t.s < 0 && Math.abs(t.i - i) <= 90 && t.p >= 0.7 * c[i])) topsMissed++; }
  }
  return { buyAbove90: (100 * bAbove) / totB, zone15: (100 * zW) / totB, bottHit: (100 * bottHit) / bott, bott3: (100 * bott3) / bott, buysPerBottom: bottBuys / bott, sellToTop: (100 * sTop) / sw, missedTops: (100 * topsMissed) / tops, nBott: bott, nTops: tops, nb, ns };
}
const fmtM = (m) => `покупки резерва: выше 90-дн. будущего минимума на ${m.buyAbove90.toFixed(0)}%, в зоне +15% от дна цикла ${m.zone15.toFixed(0)}% денег; крупных доньев с покупкой ${m.bottHit.toFixed(0)}% (≥3 дней ${m.bott3.toFixed(0)}%), дней покупок на дно ${m.buysPerBottom.toFixed(1)} | продажи: цена к макс. ±90 дн ${m.sellToTop.toFixed(0)}%, пропущено крупных вершин ${m.missedTops.toFixed(0)}% (доньев ${m.nBott}, вершин ${m.nTops})`;
const sh = (s) => `в плюсе ${s.pos}/${s.n}, худшая ${s.worst.toFixed(0)}%, медиана ${s.med.toFixed(0)}%, половины ${s.hpos}/${s.hn}, худшая половина ${s.hworst.toFixed(0)}%`;
function evalAll(G, S, withM = false) {
  const o = {}; for (const g in G) o[g] = evalGroup(G[g], S);
  if (withM) o.m = metrics([...(G.sel || []), ...(G.ex || []), ...(G.rnd || [])], S);
  return o;
}
const stable = (r, base, k) => r[k].pos >= base[k].pos && r[k].worst >= base[k].worst - 1e-9 && r[k].hworst >= base[k].hworst - 1e-9 && r[k].hpos >= base[k].hpos;
// доход: сумма лог-медиан отбора, экзамена и 50 случайных (как в прошлых проверках)
const inc = (r) => Math.log1p(r.sel.med / 100) + Math.log1p(r.ex.med / 100) + Math.log1p(r.rnd.med / 100);
const passes = (r, b) => stable(r, b, 'sel') && stable(r, b, 'ex') && r.rnd.pos >= b.rnd.pos && r.rnd.hpos >= b.rnd.hpos && r.rnd.hworst >= b.rnd.hworst - 1e-9;
const line = (r) => `${r.sel.med.toFixed(0).padStart(5)}/${r.sel.hworst.toFixed(0).padStart(4)}/${r.sel.pos}/${r.sel.hpos} | ${r.ex.med.toFixed(0).padStart(5)}/${r.ex.hworst.toFixed(0).padStart(4)}/${r.ex.pos}/${r.ex.hpos} | ${r.rnd.med.toFixed(0).padStart(5)}/${r.rnd.hworst.toFixed(0).padStart(4)}/${r.rnd.pos}/${r.rnd.hpos}`;
const HDR = 'отбор мед/худш.пол/плюс/пол+ | экзамен то же | 50 случ. то же';
const c = (ind, op, v) => ({ ind, op, v });
const B = JSON.parse(fs.readFileSync(__dirname + '/found/main-crypto.json', 'utf8'));
module.exports = { groups, loadPage, edge, evalGroup, evalAll, metrics, fmtM, sh, stat, med, stable, inc, passes, line, HDR, c, B, PAGES, E };
