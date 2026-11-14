/* Финалисты по точкам входа на 100 новых случайных монетах + дни срабатывания маркеров дна и капитуляции.
   Запуск: node app/entries_new100.js <random100.json> <n0.html> ... */
const fs = require('fs');
const { chromium } = require('playwright');
const { inPage, open } = require('./simple.js');
const { inject, c } = require('./lab.js');
const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const q = (v, f) => [...v].sort((x, y) => x - y)[Math.floor(f * v.length)];
const A = JSON.parse(fs.readFileSync(__dirname + '/found/gentle-impulse.json', 'utf8'));
const [PANIC, ST, WK, RB] = A.rules, QT = { act: -0.1, conds: [c('qt', '>', 0.5)] }, R0 = [PANIC, ST, WK, RB, QT];
const cap = (f, g) => ({ act: g, conds: [c('fng', '<', f)] }), bot = (g) => ({ act: g, conds: [c('botm', '>', 3.5)] });
const RB200 = { act: 2, conds: [...RB.conds, c('btc200', '>', 1)] };
const N = [['Текущая', R0], ['+ страх < 10 → 25% резерва', [cap(10, 1.25), ...R0]], ['+ страх < 10 → 25%, разворот только выше средней 200', [cap(10, 1.25), PANIC, ST, WK, RB200, QT]],
  ['разворот только выше средней 200 (без страха)', [PANIC, ST, WK, RB200, QT]]];
(async () => {
  const [, ...files] = process.argv.slice(2), extra = JSON.parse(fs.readFileSync(__dirname + '/found/market_extra.json', 'utf8'));
  const b = await chromium.launch(), R = { full: [], h1: [], h2: [] }; let days = null;
  for (const f of files) {
    const p = await open(b, f, 'n100'); await p.evaluate(inject, extra);
    if (!days) days = await p.evaluate(() => { const d = (k, fn) => H.t.filter((t, i) => fn(IND[k].v[i])).map((t) => new Date(t * 864e5).toISOString().slice(0, 7));
      const g = (a) => Object.entries(a.reduce((o, m) => ((o[m] = (o[m] || 0) + 1), o), {})).map(([m, n]) => m + ':' + n).join(' ');
      setup(SETS.order.find((k) => SETS.sets[k].ticker === 'BTC') || SETS.order[0], true);
      return { coin: RAW.ticker, bot: g(d('botm', (v) => v >= 4)), f10: g(d('fng', (v) => v < 10)), f8: g(d('fng', (v) => v < 8)) }; });
    for (const part of ['full', 'h1', 'h2']) R[part].push(await p.evaluate(inPage, { seed: 1, unit: 10, evalMany: N.map((n) => ({ base: 1, rules: n[1] })), part }));
    await p.close();
  }
  await b.close();
  console.log(`дни срабатывания (по истории ${days.coin}):\n  дно рынка 4 из 4: ${days.bot}\n  страх < 10: ${days.f10}\n  страх < 8: ${days.f8}\n`);
  const F0 = R.full.flatMap((r) => r[0].e);
  N.forEach((n, si) => {
    const f = R.full.flatMap((r) => r[si].e), h = [...R.h1, ...R.h2].flatMap((r) => r[si].e), h2 = R.h2.flatMap((r) => r[si].e);
    console.log(`${n[0].padEnd(40)} в плюсе ${f.filter((x) => x > 0).length}/${f.length}, медиана ${med(f).toFixed(0)}%, нижняя четверть ${q(f, 0.25).toFixed(0)}%, худшая ${Math.min(...f).toFixed(0)}% | половины в плюсе ${h.filter((x) => x > 0).length}/${h.length}, худшая ${Math.min(...h).toFixed(0)}% | 2-я пол. медиана ${med(h2).toFixed(0)}%`
      + (si ? ` | лучше текущей на ${f.filter((x, i) => x > F0[i] + 0.5).length} монетах, хуже на ${f.filter((x, i) => x < F0[i] - 0.5).length}` : ''));
  });
})();
