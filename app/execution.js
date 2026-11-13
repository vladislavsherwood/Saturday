/* По какой цене внутри свечи исполняется сделка и насколько от этого зависит результат.
   В основных расчётах сделка идёт по закрытию дня после сигнала. Здесь те же стратегии считаются с другими ценами:
   открытие, середина свечи, случайная точка между минимумом и максимумом, худший случай (покупка по максимуму, продажа по минимуму)
   и лучший случай. DCA, с которым идёт сравнение, покупает по той же цене, что и стратегия в этот день.

   Запуск: node app/execution.js <папка со страницами> */
const { chromium } = require('playwright');
const fs = require('fs');
const { open } = require('./simple.js');
const HERE = __dirname;
const inPage = ({ list, unit, modes, runs }) => {
  const FEE = 0.001, cur = SETS.order.find((k) => SETS.sets[k] === RAW), out = [];
  let st = 12345; const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (const k of SETS.avg) {
    setup(k, true);
    const row = { name: RAW.ticker, e: {} };
    const ind = {}; for (const key in IND) ind[key] = IND[key].v;
    const range = H.h.reduce((s, v, i) => s + (v / H.l[i] - 1), 0) / N * 100;
    row.range = range;
    for (const mode of modes) {
      const res = list.map(() => []);
      for (let run = 0; run < (mode === 'rand' ? runs : 1); run++) {
        // цена покупки и продажи на каждый день
        const pb = new Float64Array(N), ps = new Float64Array(N);
        for (let i = 0; i < N; i++) {
          const o = H.o[i], h = H.h[i], l = H.l[i], c = H.c[i];
          if (mode === 'close') pb[i] = ps[i] = c; else if (mode === 'open') pb[i] = ps[i] = o; else if (mode === 'mid') pb[i] = ps[i] = (h + l) / 2;
          else if (mode === 'worst') { pb[i] = h; ps[i] = l; } else if (mode === 'best') { pb[i] = l; ps[i] = h; }
          else { pb[i] = ps[i] = l + (h - l) * rnd(); }
        }
        let du = 0; for (let i = 0; i < N; i++) du += (unit * (1 - FEE)) / pb[i];
        const dca = du * H.c[N - 1];
        list.forEach((S, si) => {
          let cash = 0, units = 0;
          for (let i = 0; i < N; i++) {
            const j = i - 1; let a = 1;
            if (j >= 0) { a = S.base; for (const r of S.rules) { let ok = true; for (const cd of r.conds) { const v = ind[cd.ind] ? ind[cd.ind][j] : NaN; if (!(cd.op === '<' ? v < cd.v : v > cd.v)) { ok = false; break; } } if (ok) { a = r.act; break; } } }
            const before = cash; cash += unit;
            if (a < 0) { const amt = -a * units * ps[i]; if (amt > 0) { units += a * units; cash += amt * (1 - FEE); } }
            else if (a > 0) { const amt = Math.min(cash, unit + (a - 1) * before); units += (amt * (1 - FEE)) / pb[i]; cash -= amt; }
          }
          res[si].push(((units * H.c[N - 1] + cash) / dca - 1) * 100);
        });
      }
      row.e[mode] = res.map((v) => ({ mean: v.reduce((x, y) => x + y, 0) / v.length, min: Math.min(...v), max: Math.max(...v) }));
    }
    out.push(row);
  }
  setup(cur, true);
  return out;
};
const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
(async () => {
  const dir = process.argv[2], browser = await chromium.launch();
  const names = [['простая', 'simple'], ['мягкая', 'gentle'], ['с градацией', 'gentle-graded'], ['с возвратом', 'gentle-return']];
  const list = names.map((n) => JSON.parse(fs.readFileSync(`${HERE}/found/${n[1]}.json`, 'utf8')));
  const modes = ['close', 'open', 'mid', 'rand', 'worst', 'best'], title = { close: 'закрытие (как считали)', open: 'открытие', mid: 'середина свечи', rand: 'случайная точка свечи', worst: 'худший случай', best: 'лучший случай' };
  let rows = [];
  for (const g of ['strategy-builder-sol', 'valid', 'exam', 'memes6']) { const p = await open(browser, `${dir}/${g}.html`, 'exe'); rows = rows.concat(await p.evaluate(inPage, { list, unit: 10, modes, runs: 30 })); await p.close(); }
  console.log(`монет ${rows.length}; средний размах дневной свечи (максимум к минимуму): медиана ${med(rows.map((r) => r.range)).toFixed(1)}%`);
  names.forEach((n, si) => {
    console.log(`\n${n[0].toUpperCase()}: итог к DCA, медиана по 31 монете / худшая монета / монет в плюсе`);
    for (const m of modes) { const v = rows.map((r) => r.e[m][si].mean); console.log(`  ${title[m].padEnd(24)} ${med(v).toFixed(0).padStart(5)}% / ${Math.min(...v).toFixed(0).padStart(4)}% / ${v.filter((x) => x > 0).length}` + (m === 'rand' ? `   (30 прогонов; худший прогон худшей монеты ${Math.min(...rows.map((r) => r.e[m][si].min)).toFixed(0)}%, разброс у монеты в среднем ±${(rows.reduce((s, r) => s + (r.e[m][si].max - r.e[m][si].min) / 2, 0) / rows.length).toFixed(1)} п.п.)` : '')); }
  });
  await browser.close();
})();
