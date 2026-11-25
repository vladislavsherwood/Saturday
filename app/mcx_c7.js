/* mcx, круг 1: выгрузка ежедневных сделок combo7 (found/combo7-draft.json + отложенная паника + фитили, как в приложении) по BTC, ETH и выборке монет
   для метрик «активность и точность» (считаются в mcx_r1.py одинаково для крипты и металлов). Запуск: node app/mcx_c7.js
   Выход: scratchpad/mcx/c7_trades.json — по монете: даты (YYYY-MM-DD), закрытия, покупки резерва сверх взноса ($, вкл. фитили), продажи ($), сдвиг 0. */
process.env.C7_BASE = 'combo7-draft.json';
const fs = require('fs');
const O = require('./op_lib.js');
O.base('c7');
const P = O.P, S7 = O.S7;
const OUT = '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/mcx/';
fs.mkdirSync(OUT, { recursive: true });
const names = new Set(['BTC', 'ETH']);
for (const X of O.G.sel) names.add(X.name);
const res = {};
for (const nm of names) {
  const X = O.BY[nm];
  if (!X) continue;
  const log = [];
  const pol = { ...O.polW, wick: { ...O.polW.wick, log } };
  const r = P.edge(X, S7, 0, 'full', true, pol);
  const buy = new Array(X.n).fill(0), sell = new Array(X.n).fill(0), wick = new Array(X.n).fill(0);
  for (const t of r.tr) { if (t.s > 0) buy[t.i] += t.amt; else sell[t.i] += t.amt; }
  for (const w of log) { wick[w[1]] += w[3]; }
  const day = (t) => new Date(t * 86400000).toISOString().slice(0, 10);
  res[nm] = { seg: X.seg, grp: X.grp, d: Array.from(X.ind.t, day), c: Array.from(X.c), l: Array.from(X.l || X.c), h: Array.from(X.h || X.c), buy, sell, wick, edge: r.e };
  console.log(nm, X.n, 'к DCA', r.e.toFixed(1), 'покупок', buy.filter((x) => x > 0).length, 'фитилей', wick.filter((x) => x > 0).length, 'продаж', sell.filter((x) => x > 0).length);
}
fs.writeFileSync(OUT + 'c7_trades.json', JSON.stringify(res));
