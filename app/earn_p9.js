/* Сколько заработал бы портфель P9 по combo4 без плеча: $2 в день на каждую из 9 монет, старт 1 / 2 / 3 года назад.
   Логика — как в артефакте (правило дня из таблицы, отложенная паника); данные — viz_data.json (node viz_trades.js).
   Запуск: node earn_p9.js <viz_data.json> */
const D = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const U = 2, FEE = 0.001, COINS = ['BTC', 'ETH', 'SOL', 'HYPE', 'PUMP', 'DOGE', 'PEPE', 'ENA', 'ZEC'];
function sim(C, a) {
  let cash = 0, units = 0, du = 0, owed = 0, inv = 0;
  for (let i = a; i < C.t.length; i++) {
    const p = C.c[i], q = i > a ? C.rq[i] : -1, act = q >= 0 ? C.rt[q][0] : 1, before = cash, f = i > a ? +C.pf[i] : 0;
    cash += U; inv += U; du += U * (1 - FEE) / p;
    if (act < 0) { const amt = -act * units * p; units -= amt / p; cash += amt * (1 - FEE); }
    else if (act > 0) {
      let want = U + (act - 1) * before, rel = 0;
      if (q >= 0 && C.rt[q][1] === 'паника в стейблах' && f & 1) { owed = Math.min(before, owed + (act - 1) * before); want = U; }
      if (owed > 0 && f & 4) { rel = owed; owed = 0; } else if (owed > 0 && f & 2) { rel = 2 * owed; owed = 0; }
      const amt = Math.min(cash, want + rel); units += amt * (1 - FEE) / p; cash -= amt;
    }
    if (f & 4) owed = 0;
  }
  const p = C.c[C.t.length - 1];
  return { inv, val: cash + units * p, dca: du * p, cash };
}
const d = (t) => new Date(t * 864e5).toISOString().slice(0, 10);
const out = {};
for (const Y of [1, 2, 3]) {
  const tot = { inv: 0, val: 0, dca: 0 }; const rows = [];
  for (const nm of COINS) {
    const C = D.coins.find((x) => x.name === nm), n = C.t.length, a = Math.max(0, n - 365 * Y);
    const r = sim(C, a); tot.inv += r.inv; tot.val += r.val; tot.dca += r.dca;
    rows.push({ nm, from: d(C.t[a]), ...r, short: a === 0 });
  }
  out[Y] = { tot, rows, end: d(D.coins[0].t[D.coins[0].t.length - 1]) };
}
console.log(JSON.stringify(out));
