/* pepefix: перепроверка combo4 на выгрузке memes6 с точными ценами Binance (SHIB, PEPE, BONK, FLOKI) против старой (Yahoo, округление 1e-6).
   Запуск: AGENT_DATA=<папка agent_data> node app/pepefix_check.js <метка>  → found/pepefix_<метка>.json
   combo4 = P.base (55 правил) + эйфория (usdt < 0,9, age > 540, не мем, beta180 > 0,9 → −5%), отложенная паника Boost(2, { k: 0, A: 0 }).
   Решения, которые опирались на PEPE:
     1) эйфория для мемов: EM1 — без условия «не мем» (бета > 0,9), EM2 — бета > 0,9 и corr180 > 0,5 с мемами; строгая к combo4 без эйфории и к combo4;
     2) отложенная паника для всех монет (A 0) против порога 540 дней;
     3) светофор по бете: beta180 (последнее значение, как в приложении) и бета/корреляция fit_coins по 1-й половине и всей истории. */
const fs = require('fs');
const P2 = require('./panicx_p2.js'), P = P2.P, Z = P.Z, G = P2.G;
const TAG = process.argv[2] || 'run';
const pol = (A) => P2.Boost(2, { k: 0, A });
const c = (ind, op, v) => ({ ind, op, v });
const withE = (conds) => { const S = P.clone(P.base); S.rules.push({ act: -0.05, conds }); return S; };
const C4 = withE([c('usdt', '<', 0.9), c('age', '>', 540), c('meme', '<', 0.5), c('beta180', '>', 0.9)]);
const EM1 = withE([c('usdt', '<', 0.9), c('age', '>', 540), c('beta180', '>', 0.9)]);
const EM2 = withE([c('usdt', '<', 0.9), c('age', '>', 540), c('beta180', '>', 0.9), c('corr180', '>', 0.5)]);
const LISTS = ['sel', 'ex', 'rnd', 'n100'];
const ev = (S, p) => P.evc(S, p, LISTS);
const out = { tag: TAG, runs: {}, cmp: {}, memes: {}, beta: {} };
const fmt = (s) => ({ med: Math.round(s.med), pos: s.pos, n: s.n, hpos: s.hpos, hn: s.hn, hworst: +s.hworst.toFixed(1) });
const R = {
  noE: ev(P.base, pol(0)), C4: ev(C4, pol(0)), EM1: ev(EM1, pol(0)), EM2: ev(EM2, pol(0)), C4_540: ev(C4, pol(540)),
};
const SUM = Object.fromEntries(Object.entries(R).map(([k, r]) => [k, Z.sum(r)]));
for (const k in R) out.runs[k] = Object.fromEntries(LISTS.map((g) => [g, fmt(SUM[k][g].all)]));
// сравнение a против b: доход (сумма лог-медиан, как Z.inc) по сегментам на sel/ex/rnd, строгая, средний лог и лучше/хуже на 100 новых
const three = (r) => ({ sel: r.sel, ex: r.ex, rnd: r.rnd });
function cmp(a, b) {
  const A = Z.sum(three(R[a])), B = Z.sum(three(R[b])), o = {};
  for (const s of Z.SEGS) o[s] = { d: +(Z.inc(A, s) - Z.inc(B, s)).toFixed(3), strict: Z.strict(A, B, s) };
  const m = Z.mlog(R[a], R[b], 'all', ['n100']); o.n100 = { mlog: +m.m.toFixed(4), up: m.u, down: m.d };
  return o;
}
for (const [a, b] of [['C4', 'noE'], ['EM1', 'noE'], ['EM2', 'noE'], ['EM1', 'C4'], ['EM2', 'C4'], ['C4', 'C4_540']]) out.cmp[`${a}_vs_${b}`] = cmp(a, b);
// мемы экзамена (страница memes6) по вариантам: f / h1 / h2 к DCA, %
const ex = G.ex.map((X, i) => ({ X, i })).filter(({ X }) => X.page === 'memes6');
for (const { X, i } of ex) out.memes[X.name] = Object.fromEntries(Object.keys(R).map((k) => [k, [R[k].ex[i].f, R[k].ex[i].h1, R[k].ex[i].h2].map((v) => +v.toFixed(1))]));
// бета / корреляция: beta180 последний день (светофор приложения), fit_coins по 1-й половине и всей истории
function feats(X, a, b) {
  const c = X.c, bt = X.ind.btcp, r = [], rb = [];
  for (let i = a + 1; i < b; i++) { const x = Math.log(c[i] / c[i - 1]); if (isFinite(x)) { r.push(x); const y = bt ? Math.log(bt[i] / bt[i - 1]) : NaN; rb.push(isFinite(y) ? y : 0); } }
  const n = r.length, m = r.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / n);
  const mb = rb.reduce((s, x) => s + x, 0) / n, sb = Math.sqrt(rb.reduce((s, x) => s + (x - mb) ** 2, 0) / n), cov = r.reduce((s, x, i) => s + (x - m) * (rb[i] - mb), 0) / n;
  return { corr: +(cov / (sd * sb)).toFixed(3), beta: +(cov / (sb * sb)).toFixed(3) };
}
const light = (b) => (b >= 0.9 ? 'зел' : b >= 0.5 ? 'жёл' : 'кр');
for (const { X } of ex) {
  const b = X.ind.beta180, cr = X.ind.corr180, n = X.n, h = n >> 1;
  let up = 0, cnt = 0; for (let i = 0; i < n; i++) if (b[i] === b[i]) { cnt++; if (b[i] > 0.9) up++; }
  out.beta[X.name] = { beta180: +b[n - 1].toFixed(3), corr180: +cr[n - 1].toFixed(3), light: light(b[n - 1]), daysBetaOver09: `${up}/${cnt}`, h1: feats(X, 0, h), all: feats(X, 0, n) };
}
fs.writeFileSync(`${__dirname}/found/pepefix_${TAG}.json`, JSON.stringify(out, null, 1));
// печать
const f = (s) => `${s.med}/${s.pos}/${s.hpos}/${s.hworst}`;
for (const k in out.runs) console.log(`${k.padEnd(7)} ${LISTS.map((g) => `${g} ${f(out.runs[k][g])}`).join(' | ')}`);
for (const k in out.cmp) { const o = out.cmp[k]; console.log(`${k.padEnd(14)} ${Z.SEGS.map((s) => `${s} ${o[s].d >= 0 ? '+' : ''}${o[s].d}${o[s].strict.length ? '✗(' + o[s].strict.join(',') + ')' : '✔'}`).join(' ')} | 100н лог ${o.n100.mlog} ${o.n100.up}/${o.n100.down}`); }
for (const nm in out.memes) console.log(`${nm.padEnd(9)} ${Object.entries(out.memes[nm]).map(([k, v]) => `${k} ${v.join('/')}`).join(' | ')}`);
for (const nm in out.beta) { const b = out.beta[nm]; console.log(`${nm.padEnd(9)} beta180 ${b.beta180} (${b.light}) corr180 ${b.corr180} дней бета>0,9 ${b.daysBetaOver09} | 1-я пол бета ${b.h1.beta} корр ${b.h1.corr} | вся бета ${b.all.beta} корр ${b.all.corr}`); }
