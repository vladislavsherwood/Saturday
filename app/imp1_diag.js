/* imp1, круг 1: разбор покупок разворота BTC по эпизодам (основа combo-best). Для каждой монеты — сделки правил разворота (btcr30 > 20),
   эпизод = первый день разворота после ≥ 30 дней без него. Контекст на день решения: btcath (просадка BTC от максимума, %), дней с максимума BTC,
   доля резерва в капитале монеты, дней с последней покупки резерва, breadth. Оценка (только для разбора): цена к будущему 90-дн. минимуму, BTC через 90/180 дней.
   Запуск: node app/imp1_diag.js */
const K = require('./imp1_sim.js');
const G = K.groups(['sel', 'ex', 'rnd']); K.prep(G);
const S = K.S0;
const BT = G.sel.find((x) => x.name === 'BTC');
const bi = new Map(); for (let i = 0; i < BT.n; i++) bi.set(BT.t[i], i);
// дней с максимума BTC
const bc = BT.c, sinceAth = new Float64Array(BT.n); { let m = 0, k = 0; for (let i = 0; i < BT.n; i++) { if (bc[i] >= m) { m = bc[i]; k = 0; } else k++; sinceAth[i] = k; } }
const fmin = (c, i, w) => { let m = Infinity; for (let j = i; j < Math.min(c.length, i + w + 1); j++) m = Math.min(m, c[j]); return m; };
const ep = {}; // по дате начала эпизода BTC
for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) {
  const R = S.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind]));
  const { tr } = K.edge(X, S, 0, 'full', true);
  for (const t of tr) {
    if (t.s <= 0 || !K.isRev(R[t.q])) continue;
    const j = t.i - 1, b = bi.get(X.t[j]); if (b == null) continue;
    // начало эпизода BTC: назад, пока btcr30 > 20 (с разрывами < 30 дней)
    let s = b; for (let k = b; k >= Math.max(0, b - 400); k--) { if (BT.ind.btcr30[k] > 20) s = k; else if (s - k > 30) break; }
    const key = new Date(BT.t[s] * 86400000).toISOString().slice(0, 10);
    const E = (ep[key] = ep[key] || { n: 0, amt: 0, above: 0, f180: 0, w: 0, s, b0: b, days: new Set(), coins: new Set() });
    E.n++; E.amt += t.amt; E.above += t.amt * (t.p / fmin(X.c, t.i, 90) - 1); E.coins.add(X.name); E.days.add(b - s);
    const p180 = X.c[Math.min(X.n - 1, t.i + 180)]; E.f180 += t.amt * (p180 / t.p - 1);
  }
}
console.log('эпизод    | btcath  дн.с макс | BTC: +90д +180д  мин90 | сделок монет  день(ы) от начала | $ резерва | выше мин90 | через180');
for (const k of Object.keys(ep).sort()) {
  const E = ep[k], s = E.s, c = bc;
  const r = (w) => (((c[Math.min(BT.n - 1, s + w)] / c[s]) - 1) * 100).toFixed(0);
  const d = [...E.days].sort((a, b) => a - b);
  console.log(`${k} | ${BT.ind.btcath[s].toFixed(0).padStart(4)} ${String(sinceAth[s]).padStart(6)} | ${r(90).padStart(5)} ${r(180).padStart(5)} ${((fmin(c, s, 90) / c[s] - 1) * 100).toFixed(0).padStart(5)} | ${String(E.n).padStart(4)} ${String(E.coins.size).padStart(4)}  ${d.slice(0, 4).join(',')}${d.length > 4 ? '…' + d[d.length - 1] : ''} | ${E.amt.toFixed(0).padStart(7)} | ${(100 * E.above / E.amt).toFixed(0).padStart(4)}% | ${(100 * E.f180 / E.amt).toFixed(0).padStart(4)}%`);
}
