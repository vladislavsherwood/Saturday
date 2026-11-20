/* h2, диагностика: что делает combo4 + фитили у дна цикла (по неделям): правило дня (семья), доля кэша в капитале монеты, покупки/продажи из резерва,
   рыночные признаки (MVRV, страх, BTC ниже ATH, othd, usdt, BTC/200-нед.). Сдвиг исполнения 0. Запуск: node h2_d1.js [монеты через запятую] [окно] */
const H = require('./h2_lib.js'), { L, P, G, S57 } = H;
const fam = (q) => (q < 0 ? '—' : q === 0 ? 'кап' : q === 1 ? 'отл' : q === 2 ? 'ликв' : q <= 8 ? 'пан' : q === 9 ? 'охр' : q <= 17 ? 'Сстр' : q <= 25 ? 'стр' : q === 26 ? 'разв' : q <= 29 ? 'фанд' : q <= 37 ? 'тих' : q <= 49 ? 'шир' : q === 50 ? 'возв' : q <= 53 ? 'памп' : q === 54 ? 'альт' : 'эйф');
const W = { '2015': ['2015-04-10', '2016-01-31'], '2018': ['2018-09-01', '2019-05-15'], '2020': ['2020-02-01', '2020-05-31'], '2022': ['2022-04-01', '2023-03-31'] };
const coins = (process.argv[2] || 'BTC,ETH,LTC,ADA,BCH,EOS,XRP,BNB,DOGE,ATOM,SHIB,LINK').split(',');
const wins = (process.argv[3] || '2015,2018,2020,2022').split(',');
const all = Object.values(G).flat();
for (const nm of coins) {
  const X = all.find((x) => x.name === nm); if (!X) continue; const I = X.ind;
  const R = S57.rules.map((r) => r.conds.every((cd) => I[cd.ind]) ? r : null);
  const dec = (j) => { for (let q = 0; q < R.length; q++) { const r = R[q]; if (!r) continue; if (r.conds.every((cd) => (cd.op === '<' ? I[cd.ind][j] < cd.v : I[cd.ind][j] > cd.v))) return q; } return -1; };
  const pol = { ...H.polW, trace: [] }; const { tr } = P.edge(X, S57, 0, 'full', true, pol); const T = pol.trace;
  for (const w of wins) {
    const a = L.T(W[w][0]), b = L.T(W[w][1]); const idx = []; for (let i = 1; i < X.n; i++) if (I.t[i] >= a && I.t[i] <= b) idx.push(i);
    if (!idx.length) continue;
    let mn = Infinity, mi = -1; for (const i of idx) if (X.c[i] < mn) { mn = X.c[i]; mi = i; }
    console.log(`\n== ${nm} ${w}: дно ${L.day(I.t[mi])} ${mn.toPrecision(4)} (кэш ${(100 * T[mi][1] / (T[mi][1] + T[mi][2] * X.c[mi])).toFixed(0)}%)`);
    for (let k = 0; k < idx.length; k += 7) {
      const wk = idx.slice(k, k + 7), cnt = {}; let buy = 0, sell = 0, wick = 0;
      for (const i of wk) { const f = fam(dec(i - 1)); cnt[f] = (cnt[f] || 0) + 1; }
      for (const t of tr) if (wk.includes(t.i)) { if (t.s > 0) buy += t.amt; else sell += t.amt; }
      // фитили: прирост монет сверх сделок дня
      const e = wk[wk.length - 1], V = T[e][1] + T[e][2] * X.c[e], cs = T[e][1] / V;
      const j = e - 1;
      console.log(`${L.day(I.t[e])} ${X.c[e].toPrecision(4).padStart(8)} кэш ${(cs * 100).toFixed(0).padStart(3)}% куп ${buy.toFixed(0).padStart(5)} прод ${sell.toFixed(0).padStart(5)} | ${Object.entries(cnt).map(([f, n]) => f + n).join(' ').padEnd(22)} | mvrv ${I.mvrv[j].toFixed(2)} fng ${String(I.fng[j]).padStart(3)} ath ${I.btcath[j].toFixed(0)} othd ${I.othd[j].toFixed(1)} usdt ${I.usdt[j].toFixed(2)} wma ${I.h2wma[j].toFixed(2)} dd365 ${I.dd365[j].toFixed(0)} bwr ${I.h2bwr[j].toFixed(0)} cwr ${I.h2cwr[j].toFixed(0)}`);
    }
  }
}
