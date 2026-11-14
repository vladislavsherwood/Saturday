/* Финалисты по точкам входа на 100 новых случайных монетах + дни срабатывания маркеров дна и капитуляции.
   Запуск: node app/entries_new100.js <random100.json> <n0.html> ... */
const fs = require('fs');
const { chromium } = require('playwright');
const { inPage, open } = require('./simple.js');
const { inject, c } = require('./lab.js');
const { injLiq } = require('./liq_inject.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const q = (v, f) => [...v].sort((x, y) => x - y)[Math.floor(f * v.length)];
const A = JSON.parse(fs.readFileSync(__dirname + '/found/gentle-impulse.json', 'utf8'));
const [PANIC, ST, WK, RB] = A.rules, QT = { act: -0.1, conds: [c('qt', '>', 0.5)] }, R0 = [PANIC, ST, WK, RB, QT];
const cap = (f, g) => ({ act: g, conds: [c('fng', '<', f)] }), bot = (g) => ({ act: g, conds: [c('botm', '>', 3.5)] });
const QC = JSON.parse(fs.readFileSync(__dirname + '/found/quiet-capit.json', 'utf8')).rules, CAP = QC[0];
const OI = (x, g) => ({ act: g, conds: [c('oidd30', '<', -x)] }), HOT = { act: -0.05, conds: [c('fund30', '>', 2)] };
const N = [['Текущая (без капитуляции)', R0], ['Тихая вершина + капитуляция', QC], ['+ OI −25% от макс. → 25%', [CAP, OI(25, 1.25), ...QC.slice(1)]], ['+ OI −28% от макс. → 35%', [CAP, OI(28, 1.35), ...QC.slice(1)]],
  ['+ OI −30% от макс. → 25%', [CAP, OI(30, 1.25), ...QC.slice(1)]], ['+ фандинг 30 дн > 2% → продать 5%', [...QC.slice(0, 5), HOT, QC[5]]], ['+ OI −28% → 35% и фандинг > 2% → продать 5%', [CAP, OI(28, 1.35), ...QC.slice(1, 5), HOT, QC[5]]]];
(async () => {
  const [, ...files] = process.argv.slice(2), extra = JSON.parse(fs.readFileSync(__dirname + '/found/market_extra.json', 'utf8'));
  const b = await chromium.launch(), R = { full: [], h1: [], h2: [] }; let days = null;
  for (const f of files) {
    const p = await open(b, f, 'n100'); await p.evaluate(inject, extra); await p.evaluate(injLiq, LIQ);
    if (!days) days = await p.evaluate(() => { const o = {}; for (const k of SETS.avg) { setup(k, true); H.t.forEach((t, i) => { if (IND.oidd30.v[i] < -25) { const m = new Date(t * 864e5).toISOString().slice(0, 10); o[m] = Math.min(o[m] ?? 0, IND.oidd30.v[i]); } }); } return o; });
    for (const part of ['full', 'h1', 'h2']) R[part].push(await p.evaluate(inPage, { seed: 1, unit: 10, evalMany: N.map((n) => ({ base: 1, rules: n[1] })), part }));
    await p.close();
  }
  await b.close();
  { const d = Object.keys(days).sort(); const ep = []; for (const x of d) { const l = ep[ep.length - 1]; if (l && (new Date(x) - new Date(l.b)) / 864e5 < 20) { l.b = x; l.n++; l.m = Math.min(l.m, days[x]); } else ep.push({ a: x, b: x, n: 1, m: days[x] }); }
    console.log('эпизоды «OI ниже максимума за 30 дней на 25%+»: ' + ep.map((e) => `${e.a}…${e.b.slice(5)} (${e.n} дн, до ${e.m.toFixed(0)}%)`).join('; ') + '\n'); }
  const F0 = R.full.flatMap((r) => r[0].e);
  N.forEach((n, si) => {
    const f = R.full.flatMap((r) => r[si].e), h = [...R.h1, ...R.h2].flatMap((r) => r[si].e), h2 = R.h2.flatMap((r) => r[si].e);
    console.log(`${n[0].padEnd(46)} в плюсе ${f.filter((x) => x > 0).length}/${f.length}, медиана ${med(f).toFixed(0)}%, нижняя четверть ${q(f, 0.25).toFixed(0)}%, худшая ${Math.min(...f).toFixed(0)}% | половины в плюсе ${h.filter((x) => x > 0).length}/${h.length}, худшая ${Math.min(...h).toFixed(0)}% | 2-я пол. медиана ${med(h2).toFixed(0)}%`
      + (si ? ` | лучше текущей на ${f.filter((x, i) => x > F0[i] + 0.5).length} монетах, хуже на ${f.filter((x, i) => x < F0[i] - 0.5).length}` : ''));
  });
})();
