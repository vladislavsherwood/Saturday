/* Диагностика «паники в стейблах» (combo3 без tune1): насколько рано покупает.
   Для каждой покупки из резерва: падение цены после покупки до минимума следующих 120 дней и через сколько дней было дно.
   Плюс эпизоды по датам (рыночный сигнал) с ценой BTC. Запуск: node panic_early.js */
const Z = require('./combo2_sim.js'), C3 = require('./combo3_sim.js');
const G = Z.load(['sel', 'ex', 'rnd']);
const S = C3.make({ simp: 1, t2: 1, t3: 1 });
const U = 10, FEE = 0.001, H = 120;
function lab(r) {
  const h = (k) => r.conds.some((c) => c.ind === k);
  if (r.act <= 1.0001) return null;
  if (h('dly20_100f')) return 'отложенная';
  if (h('oidd30') && !h('usdt')) return 'волна ликв.';
  if (h('fng') && !h('usdt') && r.conds.find((c) => c.ind === 'fng').v <= 10) return 'капитуляция';
  if (h('usdt')) return 'паника';
  if (h('ago_qt')) return 'возврат';
  if (h('btcr30')) return 'разворот BTC';
  return 'прочее';
}
const recs = [];
for (const g in G) for (const X of G[g]) {
  const R = S.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])).map((r) => ({ r, cs: r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v]) }));
  const dec = (j) => { for (let q = 0; q < R.length; q++) { let ok = true; for (const [a, lt, v] of R[q].cs) { const x = a[j]; if (!(lt ? x < v : x > v)) { ok = false; break; } } if (ok) return R[q].r; } return null; };
  let cash = 0, units = 0;
  for (let i = 0; i < X.n; i++) {
    const p = X.c[i], r = i ? dec(i - 1) : null, a = r ? r.act : 1, before = cash; cash += U;
    if (a < 0) { const amt = -a * units * p; units -= amt / p; cash += amt * (1 - FEE); }
    else {
      const amt = Math.min(cash, U + (a - 1) * before); units += amt * (1 - FEE) / p; cash -= amt;
      const L = r && lab(r);
      if (L && amt - U > 1 && i + H < X.n) {
        let m = p, md = 0; for (let j = i; j <= i + H; j++) if (X.c[j] < m) { m = X.c[j]; md = j - i; }
        recs.push({ g, coin: X.name, seg: X.seg, t: X.t[i], L, rule: JSON.stringify(r.conds.map((c) => c.ind + c.op + c.v)), act: r.act, amt: amt - U, fall: (1 - m / p) * 100, md, usdt: X.ind.usdt[i - 1], pd: X.ind.panicd[i - 1], dd: X.ind.dd[i - 1] });
      }
    }
  }
}
const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(f * (s.length - 1))]; };
const row = (L, a) => {
  const W = a.reduce((s, x) => s + x.amt, 0), wf = a.reduce((s, x) => s + x.amt * x.fall, 0) / W, big = a.filter((x) => x.fall > 30).reduce((s, x) => s + x.amt, 0) / W;
  console.log(L, '|', a.length, '|', wf.toFixed(1), '|', q(a.map((x) => x.fall), 0.5).toFixed(1), '|', q(a.map((x) => x.fall), 0.75).toFixed(1), '|', (big * 100).toFixed(0) + '%', '|', q(a.map((x) => x.md), 0.5));
};
console.log('правило | покупок | взвеш. падение после покупки, % | медиана | 75% | доля денег при падении >30% | медиана дней до дна');
for (const L of ['паника', 'волна ликв.', 'капитуляция', 'отложенная', 'разворот BTC', 'возврат']) { const a = recs.filter((x) => x.L === L); if (a.length) row(L, a); }
console.log('\nпаника по правилам:');
for (const k of [...new Set(recs.filter((x) => x.L === 'паника').map((x) => x.act + ' ' + x.rule))]) row(k, recs.filter((x) => x.act + ' ' + x.rule === k));
console.log('\nпаника по дню эпизода (panicd накануне):');
for (const [a, b] of [[1, 1], [2, 3], [4, 7], [8, 15], [16, 30], [31, 999]]) { const s = recs.filter((x) => x.L === 'паника' && x.pd >= a && x.pd <= b); if (s.length) row(`день ${a}–${b}`, s); }
// эпизоды паники по датам (сигнал рыночный)
const btc = G.sel.find((x) => x.name === 'BTC'), bi = new Map(Array.from(btc.t).map((t, i) => [t, i]));
const days = [...new Set(recs.filter((x) => x.L === 'паника').map((x) => x.t))].sort((a, b) => a - b);
const ep = []; for (const t of days) { const e = ep[ep.length - 1]; if (e && t - e.last <= 10) { e.last = t; e.n++; } else ep.push({ first: t, last: t, n: 1 }); }
const d = (t) => new Date(t * 864e5).toISOString().slice(0, 10);
console.log('\nэпизоды: начало — конец (дней) | BTC в начале → минимум 120 дн (через дней) | падение | деньги по монетам, ср. падение после покупок');
for (const e of ep) {
  const i = bi.get(e.first); let s = '';
  if (i != null && i + H < btc.n) { let m = btc.c[i], md = 0; for (let j = i; j <= i + H; j++) if (btc.c[j] < m) { m = btc.c[j]; md = j - i; } s = `${Math.round(btc.c[i])} → ${Math.round(m)} (${md} дн) | −${((1 - m / btc.c[i]) * 100).toFixed(0)}%`; }
  const a = recs.filter((x) => x.L === 'паника' && x.t >= e.first && x.t <= e.last), W = a.reduce((s, x) => s + x.amt, 0);
  console.log(`${d(e.first)} — ${d(e.last)} (${e.n}) | ${s} | $${Math.round(W)}, ${(a.reduce((s, x) => s + x.amt * x.fall, 0) / W).toFixed(0)}%`);
}
module.exports = { recs };
