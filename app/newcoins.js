/* Проверка стратегий на случайной выборке монет, которых не было ни в поиске, ни в отборе, ни в экзамене.
   Запуск: node app/newcoins.js <выборка.json> <страница1.html> <страница2.html> ... */
const fs = require('fs');
const { chromium } = require('playwright');
const { inPage, open } = require('./simple.js');
const HERE = __dirname;
const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const q = (v, f) => { const s = [...v].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
(async () => {
  const [pickFile, ...files] = process.argv.slice(2), picks = JSON.parse(fs.readFileSync(pickFile, 'utf8'));
  const names = [['ИТОГОВАЯ (слабая продажа 16%)', 'gentle-impulse'], ['с градацией, без возврата', 'gentle-graded'], ['мягкая', 'gentle'], ['простая', 'simple']];
  const list = names.map((n) => JSON.parse(fs.readFileSync(`${HERE}/found/${n[1]}.json`, 'utf8')));
  // правило возврата опирается на btcr30 — он есть в самих страницах
  const browser = await chromium.launch(), R = { full: [], h1: [], h2: [] }, coins = [];
  for (const f of files) {
    const p = await open(browser, f, 'nc');
    for (const part of ['full', 'h1', 'h2']) { const r = await p.evaluate(inPage, { seed: 1, unit: 10, evalMany: list, part }); R[part].push(r); if (part === 'full') coins.push(...r[0].names); }
    await p.close();
  }
  const get = (si, part) => R[part].flatMap((r) => r[si].e);
  const grp = (t) => (picks.find((c) => c.ticker === t) || {}).group, mult = (t) => (picks.find((c) => c.ticker === t) || {}).mult;
  console.log(`монет ${coins.length}: ${coins.filter((t) => grp(t) === '2022').length} из топ-300 на январь 2022 и ${coins.filter((t) => grp(t) === 'new').length} новых`);
  console.log(`сами монеты: упали с начала расчёта ${coins.filter((t) => mult(t) < 1).length}, из них больше чем в 10 раз — ${coins.filter((t) => mult(t) < 0.1).length}; выросли ${coins.filter((t) => mult(t) >= 1).length}`);
  names.forEach((n, si) => {
    const f = get(si, 'full'), h = [...get(si, 'h1'), ...get(si, 'h2')], h2 = get(si, 'h2');
    console.log(`\n${n[0]}\n  вся история: в плюсе ${f.filter((x) => x > 0).length}/${f.length}, медиана ${med(f).toFixed(0)}%, худшая ${Math.min(...f).toFixed(0)}%, нижняя четверть ${q(f, 0.25).toFixed(0)}%, верхняя четверть ${q(f, 0.75).toFixed(0)}%`);
    console.log(`  половины истории: в плюсе ${h.filter((x) => x > 0).length}/${h.length}, худшая ${Math.min(...h).toFixed(0)}%, медиана ${med(h).toFixed(0)}% | вторая половина: в плюсе ${h2.filter((x) => x > 0).length}/${h2.length}, медиана ${med(h2).toFixed(0)}%`);
    for (const g of ['2022', 'new']) { const v = f.filter((x, i) => grp(coins[i]) === g); console.log(`  группа «${g === '2022' ? 'топ-300 января 2022' : 'новые'}»: в плюсе ${v.filter((x) => x > 0).length}/${v.length}, медиана ${med(v).toFixed(0)}%, худшая ${Math.min(...v).toFixed(0)}%`); }
    for (const [t, cond] of [['монеты, упавшие в 10+ раз', (m) => m < 0.1], ['упавшие меньше чем в 10 раз', (m) => m >= 0.1 && m < 1], ['выросшие', (m) => m >= 1]]) { const v = f.filter((x, i) => cond(mult(coins[i]))); if (v.length) console.log(`  ${t}: в плюсе ${v.filter((x) => x > 0).length}/${v.length}, медиана ${med(v).toFixed(0)}%, худшая ${Math.min(...v).toFixed(0)}%`); }
    if (si === 0) {
      const rows = coins.map((t, i) => ({ t, e: f[i], a: get(0, 'h1')[i], b: h2[i], m: mult(t) })).sort((x, y) => x.e - y.e);
      console.log('  по монетам (итог к DCA, вся история | 1-я половина | 2-я половина | цена монеты ×):');
      for (const r of rows) console.log(`    ${r.t.padEnd(9)} ${r.e.toFixed(0).padStart(6)}% | ${r.a.toFixed(0).padStart(6)}% | ${r.b.toFixed(0).padStart(6)}% | ×${r.m}`);
    }
  });
  await browser.close();
})();
