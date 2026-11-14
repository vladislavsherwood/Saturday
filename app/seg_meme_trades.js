/* Сделки основы по монете, сгруппированные по месяцам: продано/куплено (в долях), правила, цена, макс./мин. ±90 дней. Запуск: node app/seg_meme_trades.js JELLYJELLY TIBBIR ... */
const M = require('./seg_meme_lib.js'), K = M.K;
const G = M.load(), all = Object.values(G).flat();
const S = process.env.SM_S ? JSON.parse(require('fs').readFileSync(process.env.SM_S, 'utf8')) : M.S0;
const lbl = (r) => { const s = r.conds.map((c) => c.ind).join(','); if (r.act > 1) return s.includes('ago_qt') ? 'возврат' : s.includes('usdt') ? 'паника' : s.includes('btcr30') ? 'разворот' : s.includes('dly') ? 'вынос' : s.includes('oidd30') ? 'OI' : s.includes('fng') ? 'fng<10' : 'buy?';
  return s.includes('up90') ? 'памп' : s.includes('oth90') ? 'шир.тихая' : s.includes('qt') ? 'тихая' : s.includes('fund30') ? 'фандинг' : s.includes('fng') && r.conds.some((c) => c.v === 40) ? 'сил.страх' : 'страх'; };
for (const nm of process.argv.slice(2)) {
  const X = all.find((x) => x.name === nm); const e = K.edge(X, S, 0, 'full', true), c = X.c, n = X.n;
  console.log(`== ${nm} итог ${e.e.toFixed(0)}%`);
  const mo = {}; let units = 0; // приблизительно: доля продажи = amt/(стоимость позиции) неизвестна — печатаем сумму в $
  // перекомпилируем, чтобы знать правила
  const R = S.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind]));
  for (const t of e.tr) { const k = M.day(X, t.i).slice(0, 7), o = (mo[k] = mo[k] || { b: 0, s: 0, br: {}, sr: {}, pmin: Infinity, pmax: 0, i: t.i }); const L = lbl(R[t.q]); if (t.s > 0) { o.b += t.amt; o.br[L] = (o.br[L] || 0) + t.amt; } else { o.s += t.amt; o.sr[L] = (o.sr[L] || 0) + t.amt; } o.pmin = Math.min(o.pmin, t.p); o.pmax = Math.max(o.pmax, t.p); }
  for (const k in mo) { const o = mo[k], i = o.i; let fmx = 0, fmn = Infinity; for (let j = i; j < Math.min(n, i + 120); j++) { fmx = Math.max(fmx, c[j]); fmn = Math.min(fmn, c[j]); }
    const f = (m) => Object.entries(m).map(([a, v]) => a + ' ' + v.toFixed(0)).join(', ');
    console.log(`${k} цена ${o.pmin.toPrecision(3)}–${o.pmax.toPrecision(3)} | будущие 120д мин ${fmn.toPrecision(3)} макс ${fmx.toPrecision(3)} | купил ${o.b.toFixed(0)} [${f(o.br)}] | продал ${o.s.toFixed(0)} [${f(o.sr)}]`); }
}
