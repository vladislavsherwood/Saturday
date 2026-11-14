/* Разбор сделок основы по типам правил: мемы против не мемов. Для каждой покупки/продажи — доходность монеты через H дней (только для оценки),
   взвешенная деньгами; доля денег и «ошибки» (продажа, после которой монета выросла > ×2 за 120 дн; покупка, после которой упала > 50%).
   Запуск: node app/seg_meme_diag.js [группы через запятую] */
const M = require('./seg_meme_lib.js'), K = M.K;
const G = M.load(), S = process.env.SM_S ? JSON.parse(require('fs').readFileSync(process.env.SM_S, 'utf8')) : M.S0;
const groups = (process.argv[2] || 'sel,ex,rnd').split(',');
const lbl = (r) => { const s = r.conds.map((c) => c.ind).join(','); if (r.act > 1) return s.includes('ago_qt') ? 'возврат' : s.includes('usdt') ? 'паника' : s.includes('btcr30') ? 'разворот' : s.includes('dly') ? 'вынос' : s.includes('oidd30') ? 'OI' : 'fng<10';
  return s.includes('up90') ? 'памп' : s.includes('oth90') ? 'шир.тихая' : s.includes('qt') ? 'тихая' : s.includes('fund30') ? 'фандинг' : r.conds.some((c) => c.v === 40) ? 'сил.страх' : 'страх'; };
const H = [30, 90, 180], acc = {};
for (const g of groups) for (const X of G[g]) {
  const R = S.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])), tr = K.edge(X, S, 0, 'full', true).tr, c = X.c, n = X.n;
  for (const t of tr) { const L = lbl(R[t.q]), k = (X.meme ? 'М ' : 'н ') + (t.s > 0 ? 'BUY ' : 'SELL ') + L, o = (acc[k] = acc[k] || { amt: 0, r: H.map(() => [0, 0]), bad: 0, mx: 0 });
    o.amt += t.amt; H.forEach((h, q) => { if (t.i + h < n) { o.r[q][0] += t.amt * (c[t.i + h] / t.p - 1); o.r[q][1] += t.amt; } });
    let fmx = 0, fmn = Infinity; for (let j = t.i; j < Math.min(n, t.i + 120); j++) { fmx = Math.max(fmx, c[j]); fmn = Math.min(fmn, c[j]); }
    if (t.s < 0 && fmx > 2 * t.p) o.bad += t.amt; if (t.s > 0 && fmn < 0.5 * t.p) o.bad += t.amt; }
}
const tot = { М: 0, н: 0 }; for (const k in acc) tot[k[0]] += acc[k].amt;
for (const k of Object.keys(acc).sort((a, b) => a.slice(2).localeCompare(b.slice(2)))) { const o = acc[k];
  console.log(`${k.padEnd(22)} денег ${(100 * o.amt / tot[k[0]]).toFixed(1).padStart(5)}% | монета через 30/90/180 дн ${o.r.map((x) => (x[1] ? (100 * x[0] / x[1]).toFixed(0) : '-').padStart(5)).join(' ')}% | «ошибок» ${(100 * o.bad / o.amt).toFixed(0)}%`); }
