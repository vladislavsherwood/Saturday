/* Четыре стратегии на новой случайной выборке монет, которых не было ни в поиске, ни в отборе, ни в экзамене, ни в первой случайной выборке.
   Запуск: node app/new100.js <выборка.json> <страница1.html> <страница2.html> ... */
const fs = require('fs');
const { chromium } = require('playwright');
const { inPage, open } = require('./simple.js');
const { inject } = require('./lab.js');
const HERE = __dirname;
const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const q = (v, f) => { const s = [...v].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
(async () => {
  const [pickFile, ...files] = process.argv.slice(2), picks = JSON.parse(fs.readFileSync(pickFile, 'utf8'));
  const A = JSON.parse(fs.readFileSync(HERE + '/found/gentle-impulse.json', 'utf8'));
  const names = [['Стабильная', { base: 1, rules: A.rules }], ['Стабильная + тихая вершина 10%', { base: 1, rules: [...A.rules, { act: -0.1, conds: [{ ind: 'qt', op: '>', v: 0.5 }] }] }],
    ['Новый вариант (дно + тихая вершина)', JSON.parse(fs.readFileSync(HERE + '/found/quiet.json', 'utf8'))], ['Объединённая', JSON.parse(fs.readFileSync(HERE + '/found/merged.json', 'utf8'))]];
  const list = names.map((n) => ({ base: 1, rules: n[1].rules }));
  const extra = JSON.parse(fs.readFileSync(HERE + '/found/market_extra.json', 'utf8'));
  const browser = await chromium.launch(), R = { full: [], h1: [], h2: [] }, coins = [];
  for (const f of files) {
    const p = await open(browser, f, 'n100'); await p.evaluate(inject, extra);
    for (const part of ['full', 'h1', 'h2']) { const r = await p.evaluate(inPage, { seed: 1, unit: 10, evalMany: list, part }); R[part].push(r); if (part === 'full') coins.push(...r[0].names); }
    await p.close();
  }
  const get = (si, part) => R[part].flatMap((r) => r[si].e);
  const info = (t) => picks.find((c) => c.ticker === t) || {};
  console.log(`монет ${coins.length}: ${coins.filter((t) => info(t).group === '2022').length} из топ-500 на январь 2022 и ${coins.filter((t) => info(t).group === 'new').length} новых`);
  console.log(`сами монеты: упали ${coins.filter((t) => info(t).mult < 1).length}, из них в 10+ раз — ${coins.filter((t) => info(t).mult < 0.1).length}; выросли ${coins.filter((t) => info(t).mult >= 1).length}; с историей короче двух лет — ${coins.filter((t) => info(t).days < 730).length}`);
  const out = [];
  names.forEach((n, si) => {
    const f = get(si, 'full'), h1 = get(si, 'h1'), h2 = get(si, 'h2'), h = [...h1, ...h2];
    console.log(`\n${n[0].toUpperCase()}\n  вся история: в плюсе ${f.filter((x) => x > 0).length}/${f.length}, медиана ${med(f).toFixed(0)}%, нижняя четверть ${q(f, 0.25).toFixed(0)}%, верхняя четверть ${q(f, 0.75).toFixed(0)}%, худшая ${Math.min(...f).toFixed(0)}%, хуже −20%: ${f.filter((x) => x < -20).length} монет`);
    console.log(`  половины истории: в плюсе ${h.filter((x) => x > 0).length}/${h.length}, худшая ${Math.min(...h).toFixed(0)}% | вторая половина: в плюсе ${h2.filter((x) => x > 0).length}/${h2.length}, медиана ${med(h2).toFixed(0)}%`);
    for (const [t, cond] of [['топ-500 января 2022', (c) => c.group === '2022'], ['новые', (c) => c.group === 'new'], ['история от двух лет', (c) => c.days >= 730], ['история короче двух лет', (c) => c.days < 730],
      ['упавшие в 10+ раз', (c) => c.mult < 0.1], ['упавшие меньше чем в 10 раз', (c) => c.mult >= 0.1 && c.mult < 1], ['выросшие', (c) => c.mult >= 1]]) {
      const v = f.filter((x, i) => cond(info(coins[i]))); if (v.length) console.log(`  ${t}: в плюсе ${v.filter((x) => x > 0).length}/${v.length}, медиана ${med(v).toFixed(0)}%, худшая ${Math.min(...v).toFixed(0)}%`);
    }
    out.push({ name: n[0], full: f, h1, h2 });
  });
  // сравнение по монетам: сколько раз каждая стратегия лучшая и худшая
  const F = names.map((n, si) => get(si, 'full'));
  console.log('\nкто лучший на монете (из четырёх): ' + names.map((n, si) => `${n[0]} — ${coins.filter((t, i) => F.every((v) => v[i] <= F[si][i] + 1e-9)).length}`).join('; '));
  const worst = coins.map((t, i) => [t, ...F.map((v) => v[i]), info(t).mult, info(t).days]).sort((x, y) => x[4] - y[4]);
  console.log('\n15 худших монет для объединённой (стабильная / +тихая / новый вариант / объединённая | цена монеты × | дней истории):');
  for (const r of worst.slice(0, 15)) console.log(`  ${r[0].padEnd(9)} ${r.slice(1, 5).map((x) => (x.toFixed(0) + '%').padStart(7)).join(' ')} | ×${r[5]} | ${r[6]}`);
  console.log('15 лучших:');
  for (const r of worst.slice(-15).reverse()) console.log(`  ${r[0].padEnd(9)} ${r.slice(1, 5).map((x) => (x.toFixed(0) + '%').padStart(7)).join(' ')} | ×${r[5]} | ${r[6]}`);
  fs.writeFileSync(pickFile.replace('.json', '.result.json'), JSON.stringify({ coins, out }));
  await browser.close();
})();
