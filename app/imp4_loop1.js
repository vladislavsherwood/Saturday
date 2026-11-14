/* imp4, круг 1. Событийный разбор обвалов: что делала основа (combo-best) перед обвалом и сколько теряла в первые дни.
   Обвал (заранее): день, когда медиана дневной доходности монет стенда ≤ −13% или BTC ≤ −12% (с 2018-06, ≥ 24 монет), эпизоды склеены
   с разрывом < 14 дней (берётся первый день). Отдельно — названные пользователем эпизоды. Монеты: отбор + экзамен + 50 случайных (81),
   у которых к дню D−1 ≥ 200 дней истории. Запуск: node app/imp4_loop1.js <out.json> */
const L = require('./imp4_lib.js');
const fs = require('fs');
const { K } = L;
const G = K.groups(['sel', 'ex', 'rnd', 'n100']); K.prep(G);
const { M } = L.market(G);
const T0 = L.tOf('2018-06-01');
let ep = [];
for (const [t, v] of M) if (t >= T0 && (v.alt <= -0.13 || v.btc <= -0.12)) { if (ep.length && t - ep[ep.length - 1].last < 14) { ep[ep.length - 1].last = t; ep[ep.length - 1].days.push(t); } else ep.push({ t, last: t, days: [t] }); }
const NAMED = ['2020-03-12', '2021-05-19', '2022-05-09', '2022-11-08', '2025-10-10', '2026-02-05'];
const coins = [...G.sel, ...G.ex, ...G.rnd];
const P = new Map(coins.map((X) => [X, L.path(X, L.S0, 0)]));
const NM = ['капит', 'отлож', 'ликв', 'пан+сс', 'пан+сс', 'пан+сс', 'пан+стр', 'пан+стр', 'пан+стр', 'разв/страх', 'разв+фанд', 'паника', 'паника', 'паника', 'страх-', 'страх-', 'страх-', 'страх-', 'разворот', 'фанд-', 'фанд-', 'тихая-', 'тихая-', 'шир.тихая-', 'шир.тихая-', 'возврат', 'памп-', 'памп-'];
const btcX = G.sel.find((X) => X.name === 'BTC');
const at = (X, t) => { const i = t - X.t[0]; return i >= 0 && i < X.n && X.t[i] === t ? i : -1; };
const out = [];
console.log('эпизод | дни | рынок D (альты/BTC) | монет | доля в монете D−1 (D−31) | продано за 14 дн, % позиции | купл. резерва 14 дн (сколько монет) | правила 14 дн | потеря стратегии D/D+2/D+6 | DCA D/D+2/D+6 | рынок за 7/30 дн до D | fng fund7 fund30 oic14 oic30 lsr btcath');
for (const e of ep) {
  const t = e.t, v = M.get(t);
  const rows = [];
  const rc = {};
  for (const X of coins) {
    const i = at(X, t); if (i < 201 || i + 6 >= X.n) continue;
    const p = P.get(X), c = X.c, e1 = p.eq(i - 1);
    let sold = 0, bought = 0;
    for (let k = i - 14; k < i; k++) { const a = p.A[k]; if (a < 0) sold = 1 - (1 - sold) * (1 + a); if (a > 1.001) bought++; if (p.Q[k] >= 0) rc[NM[p.Q[k]]] = (rc[NM[p.Q[k]]] || 0) + 1; }
    const loss = (k) => ((p.eq(i + k) - 10 * (k + 1)) / e1 - 1) * 100, dl = (k) => ((p.dca(i + k) - 10 * (k + 1)) / p.dca(i - 1) - 1) * 100;
    rows.push({ name: X.name, ex: p.expo(i - 1), ex30: p.expo(i - 31), sold, bought: bought > 0, l: [0, 2, 6].map(loss), d: [0, 2, 6].map(dl) });
  }
  if (!rows.length) continue;
  const b = at(btcX, t), I = btcX.ind, j = b - 1;
  const m7 = [...Array(7)].reduce((s, _, k) => s * (1 + (M.get(t - 1 - k)?.alt || 0)), 1) - 1, m30 = [...Array(30)].reduce((s, _, k) => s * (1 + (M.get(t - 1 - k)?.alt || 0)), 1) - 1;
  const o = { date: L.day(t), days: e.days.map(L.day), alt: v.alt * 100, btc: v.btc * 100, n: rows.length, ex: K.med(rows.map((r) => r.ex)) * 100, ex30: K.med(rows.map((r) => r.ex30)) * 100,
    sold: K.med(rows.map((r) => r.sold)) * 100, soldAny: rows.filter((r) => r.sold > 0).length, boughtAny: rows.filter((r) => r.bought).length,
    l: [0, 1, 2].map((k) => K.med(rows.map((r) => r.l[k]))), d: [0, 1, 2].map((k) => K.med(rows.map((r) => r.d[k]))), m7: m7 * 100, m30: m30 * 100,
    ind: Object.fromEntries(['fng', 'fund7', 'fund30', 'oic14', 'oic30', 'lsr', 'btcath', 'usdt', 'oth90', 'btcr30'].map((k) => [k, I[k] ? I[k][j] : NaN])), rules: rc, named: NAMED.includes(L.day(t)) || e.days.some((x) => NAMED.includes(L.day(x))) };
  out.push(o);
  const f = (x, d = 0) => (isFinite(x) ? x.toFixed(d) : '—');
  console.log(`${o.named ? "*" : " "}${o.date} | ${o.days.length} | ${f(o.alt)}/${f(o.btc)} | ${o.n} | ${f(o.ex)}% (${f(o.ex30)}%) | ${f(o.sold)}% у ${o.soldAny} | ${o.boughtAny} | ${Object.entries(rc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ':' + v).join(' ')} | ${o.l.map((x) => f(x, 1)).join('/')} | ${o.d.map((x) => f(x, 1)).join('/')} | ${f(o.m7)}/${f(o.m30)} | ${['fng', 'fund7', 'fund30', 'oic14', 'oic30', 'lsr', 'btcath'].map((k) => f(o.ind[k], k === 'lsr' ? 2 : 1)).join(' ')}`);
}
// средние по всем эпизодам
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
console.log(`\nэпизодов ${out.length}; медиана доли в монете D−1 ${K.med(out.map((o) => o.ex)).toFixed(0)}%; потеря стратегии D+6 медиана ${K.med(out.map((o) => o.l[2])).toFixed(1)}% против DCA ${K.med(out.map((o) => o.d[2])).toFixed(1)}%`);
fs.writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(out, null, 1));
