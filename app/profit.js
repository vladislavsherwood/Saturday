/* Прибыль в деньгах, а не относительно DCA: сколько внесено, сколько стало, по каждой монете и по всему набору.
   Взнос $10 в день в каждую монету с первого дня её истории; комиссия 0,1%; сделка на следующий день после сигнала.
   Запуск: node app/profit.js <название набора> <страница1.html> ... */
const fs = require('fs');
const { chromium } = require('playwright');
const { open } = require('./simple.js');
const { inject } = require('./lab.js');
const HERE = __dirname;
const inPage = ({ list, unit }) => {
  const FEE = 0.001, cur = SETS.order.find((k) => SETS.sets[k] === RAW), out = [];
  for (const k of SETS.avg) {
    setup(k, true);
    const ind = {}; for (const key in IND) ind[key] = IND[key].v;
    let du = 0; for (let i = 0; i < N; i++) du += (unit * (1 - FEE)) / H.c[i];
    const row = { name: RAW.ticker, inv: unit * N, days: N, dca: du * H.c[N - 1], v: [], cash: [], maxdd: [] };
    for (const S of list) {
      let cash = 0, units = 0, peak = 0, dd = 0;
      for (let i = 0; i < N; i++) {
        const p = H.c[i], j = i - 1; let a = 1;
        if (j >= 0) for (const r of S.rules) { let ok = true; for (const cd of r.conds) { const v = ind[cd.ind] ? ind[cd.ind][j] : NaN; if (!(cd.op === '<' ? v < cd.v : v > cd.v)) { ok = false; break; } } if (ok) { a = r.act; break; } }
        const before = cash; cash += unit;
        if (a < 0) { const amt = -a * units * p; if (amt > 0) { units += a * units; cash += amt * (1 - FEE); } }
        else if (a > 0) { const amt = Math.min(cash, unit + (a - 1) * before); units += (amt * (1 - FEE)) / p; cash -= amt; }
        // просадка счёта: насколько стоимость падала ниже внесённых денег и ниже своего максимума
        const w = cash + units * p, ratio = w / (unit * (i + 1)); if (ratio > peak) peak = ratio; if (peak > 0 && 1 - ratio / peak > dd) dd = 1 - ratio / peak;
      }
      row.v.push(cash + units * H.c[N - 1]); row.cash.push(cash); row.maxdd.push(dd * 100);
    }
    out.push(row);
  }
  setup(cur, true);
  return out;
};
const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const money = (x) => '$' + Math.round(x).toLocaleString('ru-RU');
(async () => {
  const [title, ...files] = process.argv.slice(2);
  const A = JSON.parse(fs.readFileSync(HERE + '/found/gentle-impulse.json', 'utf8'));
  const names = ['DCA', 'Стабильная', 'Стабильная + тихая вершина', 'Новый вариант', 'Объединённая'];
  const list = [{ rules: [] }, { rules: A.rules }, { rules: [...A.rules, { act: -0.1, conds: [{ ind: 'qt', op: '>', v: 0.5 }] }] }, JSON.parse(fs.readFileSync(HERE + '/found/quiet.json', 'utf8')), JSON.parse(fs.readFileSync(HERE + '/found/merged.json', 'utf8'))].map((s) => ({ rules: s.rules }));
  const extra = JSON.parse(fs.readFileSync(HERE + '/found/market_extra.json', 'utf8')), browser = await chromium.launch(); let R = [];
  for (const f of files) { const p = await open(browser, f, 'pf'); await p.evaluate(inject, extra); R = R.concat(await p.evaluate(inPage, { list, unit: 10 })); await p.close(); }
  await browser.close();
  const inv = R.reduce((s, r) => s + r.inv, 0);
  console.log(`=== ${title}: монет ${R.length}, всего внесено ${money(inv)} (по $10 в день в каждую монету) ===`);
  console.log(`${'стратегия'.padEnd(28)} | весь набор: стало / прибыль / на вложенное | монет в прибыли | медиана по монете | худшая | лучшая | в резерве сейчас | медианная просадка счёта`);
  names.forEach((n, i) => {
    const tot = R.reduce((s, r) => s + r.v[i], 0), per = R.map((r) => (r.v[i] / r.inv - 1) * 100), cash = R.reduce((s, r) => s + r.cash[i], 0);
    console.log(`${n.padEnd(28)} | ${money(tot).padStart(14)} / ${((tot - inv >= 0 ? '+' : '−') + money(Math.abs(tot - inv))).padStart(14)} / ${((tot / inv - 1) * 100).toFixed(0).padStart(5)}% | ${String(per.filter((x) => x > 0).length).padStart(3)} из ${R.length} | ${med(per).toFixed(0).padStart(5)}% | ${Math.min(...per).toFixed(0).padStart(4)}% | ${Math.max(...per).toFixed(0).padStart(7)}% | ${(100 * cash / tot).toFixed(0).padStart(3)}% | ${med(R.map((r) => r.maxdd[i])).toFixed(0)}%`);
  });
  // без пяти самых прибыльных монет — чтобы итог не определяли единичные взлёты
  const top = [...R].sort((x, y) => y.v[4] - x.v[4]).slice(0, 5).map((r) => r.name), rest = R.filter((r) => !top.includes(r.name)), inv2 = rest.reduce((s, r) => s + r.inv, 0);
  console.log(`без пяти самых прибыльных монет (${top.join(', ')}), внесено ${money(inv2)}:`);
  names.forEach((n, i) => { const tot = rest.reduce((s, r) => s + r.v[i], 0); console.log(`  ${n.padEnd(28)} стало ${money(tot).padStart(12)}, на вложенное ${((tot / inv2 - 1) * 100).toFixed(0)}%`); });
  // распределение результата по монетам
  console.log('сколько монет закончили: в минусе больше половины / в минусе / в плюсе до ×2 / больше ×2 / больше ×5');
  names.forEach((n, i) => { const m = R.map((r) => r.v[i] / r.inv); console.log(`  ${n.padEnd(28)} ${m.filter((x) => x < 0.5).length} / ${m.filter((x) => x >= 0.5 && x < 1).length} / ${m.filter((x) => x >= 1 && x < 2).length} / ${m.filter((x) => x >= 2 && x < 5).length} / ${m.filter((x) => x >= 5).length}`); });
  fs.writeFileSync(files[0].replace(/[^/]+$/, '') + 'profit-' + title + '.json', JSON.stringify(R));
})();
