/* Распределение взноса по монетам P9 по combo4 (без плеча): $1 / $2 / $3 в день на монету, старт 1 / 2 / 3 года назад,
   плюс устойчивость — старт каждые 30 дней за последние 3 года (до конца данных): медиана прибыли, доля стартов в минусе, худший старт, доля лучше DCA.
   Логика — как в артефакте (план из таблицы правил + отложенная паника для всех монет). Запуск: node alloc_p9.js <viz_data.json> */
const D = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const FEE = 0.001, COINS = ['BTC', 'ETH', 'SOL', 'HYPE', 'PUMP', 'DOGE', 'PEPE', 'ENA', 'ZEC'];
function sim(C, a, U) {
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
  return { inv, val: cash + units * p, dca: du * p };
}
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const out = [];
for (const nm of COINS) {
  const C = D.coins.find((x) => x.name === nm), n = C.t.length, row = { nm, n, beta: (C.k.filter((x) => x != null).pop() || 0) / 100, y: {} };
  for (const Y of [1, 2, 3]) { const a = Math.max(0, n - 365 * Y), r = sim(C, a, 1); row.y[Y] = { full: a === 0, inv: r.inv, p: (r.val / r.inv - 1) * 100, d: (r.dca / r.inv - 1) * 100 }; }
  const pr = [], win = [];
  for (let a = Math.max(0, n - 365 * 3); a <= n - 180; a += 30) { const r = sim(C, a, 1); pr.push((r.val / r.inv - 1) * 100); win.push(r.val > r.dca); }
  Object.assign(row, { starts: pr.length, med: med(pr), loss: pr.filter((x) => x < 0).length / pr.length, worst: Math.min(...pr), beat: win.filter(Boolean).length / win.length });
  out.push(row);
}
console.log(JSON.stringify(out));
// портфель: равные $2 против предложенного распределения (сумма $18 в день), старт каждые 30 дней за 3 года
if (process.argv[3]) {
  const W = JSON.parse(process.argv[3]), E = Object.fromEntries(COINS.map((c) => [c, 2]));
  const port = (w, back) => { let inv = 0, val = 0, dca = 0; for (const nm of COINS) { const C = D.coins.find((x) => x.name === nm), r = sim(C, Math.max(0, C.t.length - back), w[nm]); inv += r.inv; val += r.val; dca += r.dca; } return { inv, val, dca }; };
  for (const [lab, w] of [['поровну по $2', E], ['распределение', W]]) {
    const ys = [1, 2, 3].map((Y) => { const r = port(w, 365 * Y); return `${Y} г.: $${Math.round(r.inv)} → $${Math.round(r.val)} (${((r.val / r.inv - 1) * 100).toFixed(0)}%), DCA $${Math.round(r.dca)}`; });
    const rs = []; for (let back = 365 * 3; back >= 180; back -= 30) { const r = port(w, back); rs.push((r.val / r.inv - 1) * 100); }
    console.error(lab.padEnd(16), ys.join(' | '), `| старты каждые 30 дн: медиана ${med(rs).toFixed(0)}%, худший ${Math.min(...rs).toFixed(0)}%, в минусе ${rs.filter((x) => x < 0).length}/${rs.length}`);
  }
}
