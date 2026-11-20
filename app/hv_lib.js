/* hv: combo5 на монетах с большими движениями (молодые, волатильные, мемы — как PUMP). Общие помощники.
   Основа — combo5 (found/combo5-best.json, 58 правил) + отложенная паника Boost(2, { k: 0, A: 0 }) + ловушка для фитилей (−25/−40/−60% → 15/25/35%, раз в 3 дня).
   Сегмент «большие движения» (БД) — задан заранее (research/hv_journal.md):
     признак дня hvv = vol180 монеты (годовая волатильность за 180 дн, %), пока его нет — vol90; правила включаются по hvv > T на день решения (T = 115);
     монета входит в сегмент для отчёта, если медиана её hvv за историю ≥ T (на 81 монете это верхняя треть: медианы 92 / 113).
   Монеты пользователя, которых нет в группах (ENA, ZEC, USELESS), — страница 'mine' (как wk_lib.js; в оценку не входит).
   Использование: const H = require('./hv_lib.js'); H.ev('имя', S, pol, { n100: true }) */
const AS = require('./agent_sim.js');
AS.PAGES.mine = ['mine'];
require('./combo2_sim.js').load(['sel', 'ex', 'rnd', 'n100', 'mine']);
require('./h2_lib.js'); // индикатор h2fd15 для правила 11
const L = require('./r4_lib.js'), { P, Z, G, c } = L;
const ld = (f) => ({ ...L.clone(), rules: require('./found/' + f).rules.map((r) => JSON.parse(JSON.stringify(r))) });
const S5 = ld('combo5-best.json');
const WICK = { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place' };
const polW = { ...L.pol0, wick: WICK };
const T_HV = 115;
// признак волатильности дня: vol180, пока его нет — vol90
L.addInd('hvv', (X) => Float64Array.from(X.ind.vol180, (v, i) => (isFinite(v) ? v : X.ind.vol90[i])));
const med = (a) => { const s = a.filter(isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
function markSeg(T = T_HV) { for (const g in G) for (const X of G[g]) { X.hvm = med(Array.from(X.ind.hvv)); X.hv = X.hvm >= T; } }
markSeg();
const BY = {}; for (const g of ['sel', 'ex', 'rnd', 'n100', 'mine']) for (const X of G[g]) BY[X.name] = BY[X.name] || X;
const G3 = ['sel', 'ex', 'rnd'];
const L1 = Z.L1;
let BR = null, BS = null, BN = null;
function bases() { if (!BR) { P.setBaseline(S5, polW); BR = P.evc(S5, polW); BS = Z.sum(BR); BN = P.evc(S5, polW, ['n100']); } return { BR, BS, BN }; }
// средний лог по монетам, где pick(X) → true; лучше/хуже (порог 0,5 п.п. итога, как Z.mlog)
function mpick(R, B, gs, pick) { let t = 0, n = 0, u = 0, d = 0; for (const g of gs) R[g].forEach((x, i) => { const X = G[g][i]; if (!pick(X)) return; const y = B[g][i]; t += L1(x.f) - L1(y.f); n++; if (x.f > y.f + 0.5) u++; else if (x.f < y.f - 0.5) d++; }); return { m: n ? t / n : 0, u, d, n }; }
// доход сегмента по медианам: Σ по группам L1(медиана итога монет сегмента) к основе
function incPick(R, B, pick, h = 'f') { let t = 0; for (const g of G3) { const a = R[g].filter((x, i) => pick(G[g][i])).map((x) => x[h]), b = B[g].filter((x, i) => pick(G[g][i])).map((x) => x[h]); if (a.length) t += L1(med(a)) - L1(med(b)); } return t; }
const sg = (x, d = 3) => (x >= 0 ? '+' : '') + x.toFixed(d);
const isHV = (X) => X.hv, isBig = (X) => X.seg === 'big';
const rows = [];
/* оценка: медианы групп; доход к combo5 (всё / к / а / м); строгая; сегмент БД: доход по медианам, средний лог 81 (лучше/хуже), 100 новых;
   все 81: средний лог; 100 новых: средний лог (лучше/хуже); половины (Σ лог-медиан h1/h2 к основе); крупные: худшее изменение по монете (лог) */
function ev(nm, S, pol = polW, { n100 = true, quiet = false, w = 50 } = {}) {
  bases();
  const R = P.evc(S, pol), RS = Z.sum(R);
  const d = (s) => Z.inc(RS, s) - Z.inc(BS, s);
  const why = Z.SEGS.map((s) => { const x = Z.strict(RS, BS, s); return x.length ? `${s}: ${x.join(',')}` : ''; }).filter(Boolean).join(' | ');
  const o = { nm, S, pol, R, RS, sel: RS.sel.all.med, ex: RS.ex.all.med, rnd: RS.rnd.all.med, all: d('all'), big: d('big'), alt: d('alt'), meme: d('meme'), ok: !why, why,
    bigOk: !Z.strict(RS, BS, 'big').length };
  o.hvInc = incPick(R, BR, isHV); o.hv81 = mpick(R, BR, G3, isHV); o.m81 = mpick(R, BR, G3, () => true); o.nhv81 = mpick(R, BR, G3, (X) => !X.hv);
  o.h1 = incPick(R, BR, () => true, 'h1'); o.h2 = incPick(R, BR, () => true, 'h2');
  o.hvh1 = mpickH(R, BR, isHV, 'h1'); o.hvh2 = mpickH(R, BR, isHV, 'h2');
  { let wb = 0, wn = ''; for (const g of G3) R[g].forEach((x, i) => { if (G[g][i].seg !== 'big') return; const dd = L1(x.f) - L1(BR[g][i].f); if (dd < wb) { wb = dd; wn = x.name; } }); o.bigWorst = wb; o.bigWorstN = wn; }
  if (n100) { const N = P.evc(S, pol, ['n100']); o.N = N; o.n = mpick(N, BN, ['n100'], () => true); o.nhv = mpick(N, BN, ['n100'], isHV); o.nnhv = mpick(N, BN, ['n100'], (X) => !X.hv); }
  o.txt = `${nm.padEnd(w)} ${Math.round(o.sel)}/${Math.round(o.ex)}/${Math.round(o.rnd)} | ${sg(o.all)} к${sg(o.big)} а${sg(o.alt)} м${sg(o.meme)} ${o.ok ? '✔' : '✗'} | БД: ${sg(o.hvInc)} 81 ${sg(o.hv81.m, 4)} ${o.hv81.u}/${o.hv81.d}` +
    (n100 ? ` 100н ${sg(o.nhv.m, 4)} ${o.nhv.u}/${o.nhv.d}` : '') + ` пол ${sg(o.hvh1, 3)}/${sg(o.hvh2, 3)} | 81 ${sg(o.m81.m, 4)} ${o.m81.u}/${o.m81.d} (не БД ${sg(o.nhv81.m, 4)})` +
    (n100 ? ` | 100н ${sg(o.n.m, 4)} ${o.n.u}/${o.n.d}` : '') + ` | пол ${sg(o.h1, 2)}/${sg(o.h2, 2)} | крупн. худш ${sg(o.bigWorst, 4)} ${o.bigWorstN}` + (why ? ` | ${why.slice(0, 150)}` : '');
  if (!quiet) console.log(o.txt);
  rows.push(o);
  return o;
}
// средний лог по половине истории у монет сегмента (81 монета)
function mpickH(R, B, pick, h) { let t = 0, n = 0; for (const g of G3) R[g].forEach((x, i) => { if (!pick(G[g][i])) return; t += L1(x[h]) - L1(B[g][i][h]); n++; }); return n ? t / n : 0; }
const head = () => console.log(`${'вариант'.padEnd(50)} отбор/экз/50сл | доход к combo5: всё к а м строгая | БД: доход, ср. лог 81 лучше/хуже, 100н, половины (ср. лог h1/h2) | все 81: ср. лог (не БД) | 100 новых | половины (доход h1/h2) | крупные: худшая монета`);
// стратегия: вставить правила перед индексом k (0-based в списке 58)
function ins(S, k, rules) { const T = L.clone(S); T.rules.splice(k, 0, ...rules.map((r) => JSON.parse(JSON.stringify(r)))); return T; }
// перед каждым правилом, где pick(r, k) → true, вставить копию с доп. условиями conds и act = f(r.act)
function pre(S, pick, conds, f) { const T = L.clone(S); T.rules = S.rules.flatMap((r, k) => (pick(r, k) ? [{ act: typeof f === 'function' ? f(r.act, r) : f, conds: [...r.conds.map((x) => ({ ...x })), ...conds.map((x) => ({ ...x }))] }, JSON.parse(JSON.stringify(r))] : [JSON.parse(JSON.stringify(r))])); return T; }
const HV = (T = T_HV) => [c('hvv', '>', T)];
// перед каждым правилом, где pick(r, k) → true, вставить копию mod(копия правила) (mod меняет пороги / долю / добавляет условия; null — не вставлять)
function preMod(S, pick, mod) { const T = L.clone(S); T.rules = S.rules.flatMap((r, k) => { const r0 = JSON.parse(JSON.stringify(r)); if (!pick(r, k)) return [r0]; const m = mod(JSON.parse(JSON.stringify(r)), k); return m ? [m, r0] : [r0]; }); return T; }
// доля продажи × m (не больше 100%)
const mul = (m) => (a) => Math.max(-1, a * m);
// монеты пользователя: итог к DCA (худший из сдвигов 0/1), вся история; с 2024-01-01 и с 2026-01-01 — тот же счёт на отрезке (с нуля)
const MINE = ['PUMP', 'FARTCOIN', 'USELESS', 'PENGU', 'HYPE', 'PEPE', 'DOGE', 'ENA', 'ZEC', 'XMR', 'BTC', 'ETH', 'SOL'];
const E = (X, S, pol) => Math.min(P.edge(X, S, 0, 'full', false, pol).e, P.edge(X, S, 1, 'full', false, pol).e);
function mine(S, pol, S0 = S5, pol0 = polW, names = MINE) {
  const o = []; for (const nm of names) { const X = BY[nm]; if (!X) { o.push({ nm, miss: 1 }); continue; } o.push({ nm, hvm: X.hvm, b: E(X, S0, pol0), x: E(X, S, pol) }); } return o;
}
function mineTxt(rows) { return rows.map((r) => (r.miss ? `${r.nm}: нет в данных` : `${r.nm.padEnd(9)} hvv ${Math.round(r.hvm)} ${Math.round(r.b)} → ${Math.round(r.x)} (${sg(L1(r.x) - L1(r.b), 3)})`)).join('\n'); }
// изменения по монетам (лог итога к combo5): k лучших и худших; 81 монета и (если считали) 100 новых
function diff(o, k = 8) {
  const a = []; for (const g of G3) o.R[g].forEach((x, i) => a.push([x.name + (G[g][i].hv ? '*' : ''), L1(x.f) - L1(BR[g][i].f), Math.round(BR[g][i].f), Math.round(x.f)]));
  if (o.N) o.N.n100.forEach((x, i) => a.push([x.name + (G.n100[i].hv ? '*' : '') + '·н', L1(x.f) - L1(BN.n100[i].f), Math.round(BN.n100[i].f), Math.round(x.f)]));
  a.sort((x, y) => y[1] - x[1]); const f = (r) => `${r[0]} ${sg(r[1], 3)} (${r[2]}→${r[3]})`;
  return `лучше: ${a.slice(0, k).filter((r) => r[1] > 0.001).map(f).join(', ')}\n   хуже: ${a.slice(-k).reverse().filter((r) => r[1] < -0.001).map(f).join(', ')}`;
}
module.exports = { L, P, Z, G, c, S5, WICK, polW, T_HV, markSeg, BY, bases, ev, head, ins, pre, preMod, mul, HV, mine, mineTxt, MINE, E, sg, med, mpick, incPick, rows, diff, day: L.day, T: L.T, L1 };
