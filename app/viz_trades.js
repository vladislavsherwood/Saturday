/* Данные для артефакта «сделки на графике»: цены монет пользователя и сделки нескольких стратегий (покупки из резерва и продажи)
   с суммами и правилом, плюс стоимость счёта стратегии и DCA. Взнос $10 в день, решение по вчерашнему дню, комиссия 0,1%.
   Запуск: node app/viz_trades.js <куда.json> */
const fs = require('fs');
const AS = require('./agent_sim.js');
AS.PAGES.mine = ['mine'];
const Z = require('./combo2_sim.js');
const G = Z.load(['sel', 'ex', 'rnd', 'mine']);
const WANT = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'TRX', 'ADA', 'DOGE', 'LINK', 'HYPE', 'PUMP', 'PEPE', 'PENGU', 'ENA', 'ZEC', 'VVV', 'MYX', 'USELESS'];
const rd = (f) => JSON.parse(fs.readFileSync(__dirname + '/found/' + f, 'utf8'));
const STRATS = [{ id: 'combo4', name: 'combo4 (итоговая)', S: rd('combo4-best.json') }]; // combo4 = правила combo3 без tune1 + эйфория в стейблах + отложенная паника (симуляция в странице)
const FEE = 0.001, U = 10;
function label(r) {
  const h = (k) => r.conds.some((c) => c.ind === k), v = (k) => (r.conds.find((c) => c.ind === k) || {}).v;
  if (r.act > 0 && r.act <= 1.0001) return 'только взнос';
  if (r.act > 0) {
    if (h('dly20_100f')) return 'отложенная покупка';
    if (h('oidd30') && !h('usdt')) return 'волна ликвидаций';
    if (h('fng') && v('fng') <= 10 && !h('usdt')) return 'капитуляция';
    if (h('usdt')) return 'паника в стейблах';
    if (h('ago_qt')) return 'возврат после вершины';
    if (h('btcr30')) return 'разворот биткоина';
    return 'покупка';
  }
  if (h('usdt') && h('beta180')) return 'эйфория в стейблах';
  if (h('qt')) return 'тихая вершина';
  if (h('isalt') && h('oth90') && h('fng')) return 'альтсезон';
  if (h('oth90')) return 'широкая тихая вершина';
  if (h('up90')) return 'памп в медвежьем рынке';
  if (h('fund30')) return 'перегретый фандинг';
  if (h('fng')) return r.conds.some((c) => c.ind === 'fng' && c.v <= 40) ? 'сильный страх' : 'страх';
  return 'продажа';
}
function run(X, S) {
  const c = X.c, rules = S.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind]));
  const R = rules.map((r) => ({ r, cs: r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v]) }));
  const dec = (j) => { for (let q = 0; q < R.length; q++) { let ok = true; for (const [a, lt, v] of R[q].cs) { const x = a[j]; if (!(lt ? x < v : x > v)) { ok = false; break; } } if (ok) return q; } return -1; };
  let cash = 0, units = 0, du = 0; const tr = [], eq = [], dq = [];
  for (let i = 0; i < X.n; i++) {
    const p = c[i], q = i ? dec(i - 1) : -1, a = q >= 0 ? R[q].r.act : 1, before = cash;
    cash += U; du += U * (1 - FEE) / p;
    if (a < 0) { const amt = -a * units * p; if (amt > 0.01) { const eqb = cash + units * p; units -= amt / p; cash += amt * (1 - FEE); tr.push([i, -1, +amt.toFixed(2), label(R[q].r), +(amt / eqb).toFixed(4)]); } }
    else if (a > 0) { const amt = Math.min(cash, U + (a - 1) * before), eqb = cash + units * p; units += amt * (1 - FEE) / p; cash -= amt; if (amt > U * 1.5) tr.push([i, 1, +(amt - U).toFixed(2), label(R[q].r), +((amt - U) / eqb).toFixed(4)]); }
    eq.push(cash + units * p); dq.push(du * p);
  }
  return { tr, eq, dq, cash, units };
}
const out = { unit: U, fee: FEE, strategy: STRATS[0].name, coins: [] };
const all = Object.values(G).flat();
for (const nm of WANT) {
  const X = all.find((x) => x.name === nm);
  if (!X) { console.log('нет', nm); continue; }
  const S = STRATS[0].S, rules = S.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind]));
  const R = rules.map((r) => ({ r, cs: r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v]) }));
  const dec = (j) => { for (let q = 0; q < R.length; q++) { let ok = true; for (const [a, lt, v] of R[q].cs) { const x = a[j]; if (!(lt ? x < v : x > v)) { ok = false; break; } } if (ok) return q; } return -1; };
  // таблица правил монеты: [доля, подпись]; rq[i] — правило, которое исполняется в день i (решено по дню i−1)
  const rt = [], key = {}, rq = new Array(X.n).fill(-1);
  for (let i = 1; i < X.n; i++) { const q = dec(i - 1); if (q < 0) continue; const r = R[q].r, k = r.act + '|' + label(r); if (key[k] == null) { key[k] = rt.length; rt.push([+r.act.toFixed(6), label(r)]); } rq[i] = key[k]; }
  // отложенная паника (combo4): флаги дня исполнения i по данным дня i−1 — 1: отложить (все монеты с ноября 2026 — порог возраста 0; было > 540; usdt ≤ 1,2, upk10 ≥ 0,98),
  // 2: разворот usdt (upk10 < 0,965) — выдать долг ×2, 4: конец эпизода паники (10 дней без паники) — выдать долг без надбавки
  const I = X.ind, u = I.usdt, pf = new Array(X.n).fill(0); let last = -1e9, st = -1;
  const upk = (j) => { let m = -Infinity; for (let k = Math.max(0, j - 9); k <= j; k++) if (u[k] > m) m = u[k]; return u[j] / m; };
  const pend = new Array(X.n).fill(0);
  for (let j = 0; j < X.n; j++) { const on = u[j] > 1.07 && I.othd[j] < 25; if (on) { if (j - last > 10) st = j; last = j; } if (st >= 0 && !on && j - last === 10) pend[j] = 1; }
  for (let i = 1; i < X.n; i++) { const j = i - 1, k = upk(j); pf[i] = (I.age[j] > 0 && u[j] <= 1.2 && k >= 0.98 ? 1 : 0) | (k < 0.965 ? 2 : 0) | (pend[j] ? 4 : 0); }
  out.coins.push({ name: nm, seg: X.seg, t: Array.from(X.t, (v) => Math.round(v)), c: Array.from(X.c, (v) => +v.toPrecision(5)), rt, rq, pf: pf.join(''), k: Array.from(X.ind.beta180, (v) => (isFinite(v) ? Math.round(v * 100) : null)) }); // светофор: бета к BTC за 180 дней
  const r0 = run(X, S); console.log(nm, X.seg, X.n, 'дней, правил', rt.length, 'итог $' + Math.round(r0.eq[X.n - 1]));
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
console.log(process.argv[2], Math.round(fs.statSync(process.argv[2]).size / 1024), 'КБ');
