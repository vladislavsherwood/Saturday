/* Мелкий перебор размеров в «мягкой с градацией»: сколько продавать на сильном сигнале (страх глубже порога),
   сколько на слабом, сколько резерва вкладывать на сигнале покупки, и сам порог страха.
   Запуск: node app/sizes.js <папка со страницами> <куда.json> */
const { chromium } = require('playwright');
const fs = require('fs');
const { inPage, open } = require('./simple.js');
const c = (ind, op, v) => ({ ind, op, v });
const BC = [c('usdt', '>', 1.07), c('othd', '<', 25)], SC = [c('fng', '<', 52), c('usdtd', '<', 7.6)];
const mk = (b, ss, sw, thr) => ({ base: 1, rules: [{ act: b, conds: BC }, { act: -ss / 100, conds: [...SC, c('fng', '<', thr)] }, { act: -sw / 100, conds: SC }] });
const SS = [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 35, 40, 45, 50, 60, 75, 100], SW = [0, 1, 2, 3, 4, 5, 6, 7.5, 10, 12.5, 15, 20, 25], BB = [1.1, 1.25, 1.4, 1.5, 1.6, 1.75, 2], TH = [25, 30, 35, 40, 45];
const L = [];
for (const b of BB) for (const ss of SS) for (const sw of SW) L.push({ b, ss, sw, thr: 40, S: mk(b, ss, sw, 40) });
for (const thr of TH) if (thr !== 40) for (const ss of SS) for (const sw of SW) L.push({ b: 1.5, ss, sw, thr, S: mk(1.5, ss, sw, thr) });
const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const stat = (full, halves) => ({ pos: full.filter((x) => x > 0).length, worst: Math.min(...full), med: med(full), hpos: halves.filter((x) => x > 0).length, hworst: Math.min(...halves) });
(async () => {
  const [dir, outPath] = process.argv.slice(2), browser = await chromium.launch(), R = {};
  const P = { own: 'strategy-builder-sol', valid: 'valid', exam: 'exam', memes: 'memes6' }, SEL = ['own', 'valid'], EX = ['exam', 'memes'], ALL = [...SEL, ...EX];
  for (const g in P) { const page = await open(browser, `${dir}/${P[g]}.html`, 'sz'); R[g] = {}; for (const part of ['full', 'h1', 'h2']) R[g][part] = await page.evaluate(inPage, { seed: 1, unit: 10, evalMany: L.map((x) => x.S), part }); await page.close(); }
  const get = (i, g, part) => g.flatMap((k) => R[k][part][i].e);
  const rows = L.map((x, i) => ({ ...x, S: undefined, sel: stat(get(i, SEL, 'full'), [...get(i, SEL, 'h1'), ...get(i, SEL, 'h2')]), ex: stat(get(i, EX, 'full'), [...get(i, EX, 'h1'), ...get(i, EX, 'h2')]),
    all: stat(get(i, ALL, 'full'), [...get(i, ALL, 'h1'), ...get(i, ALL, 'h2')]), h2: stat(get(i, ALL, 'h2'), get(i, ALL, 'h2')) }));
  console.log('вариантов', rows.length);
  const tab = (title, f, flt) => { console.log('\n' + title + '\nсильная\\слабая ' + SW.map((x) => String(x).padStart(5)).join('')); for (const ss of SS) console.log(String(ss).padStart(14) + ' ' + SW.map((sw) => { const r = rows.find((q) => flt(q) && q.ss === ss && q.sw === sw); return String(f(r)).padStart(5); }).join('')); };
  const f15 = (q) => q.b === 1.5 && q.thr === 40;
  tab('МЕДИАНА на всех 31, % (покупка 50% резерва, порог страха 40)', (r) => r.all.med.toFixed(0), f15);
  tab('ХУДШАЯ МОНЕТА на всех 31, %', (r) => r.all.worst.toFixed(0), f15);
  tab('ХУДШАЯ ПОЛОВИНА истории, %', (r) => r.all.hworst.toFixed(0), f15);
  tab('ПОЛОВИН В ПЛЮСЕ из 62', (r) => r.all.hpos, f15);
  tab('МЕДИАНА на второй половине истории, %', (r) => r.h2.med.toFixed(0), f15);
  const score = (s) => s.worst + s.hworst + s.med / 5;          // устойчивость важнее прибыли
  const line = (r) => `покупка ${Math.round((r.b - 1) * 100)}% резерва, сильная ${r.ss}%, слабая ${r.sw}%, порог ${r.thr}`;
  const sh = (s) => `в плюсе ${s.pos}, худшая ${s.worst.toFixed(0)}%, медиана ${s.med.toFixed(0)}%, половины ${s.hpos}, худшая половина ${s.hworst.toFixed(0)}%`;
  console.log('\nЛУЧШИЕ ПО ОТБОРУ (17 монет) → что вышло на экзамене (14):');
  for (const r of [...rows].sort((x, y) => score(y.sel) - score(x.sel)).slice(0, 6)) console.log(`  ${line(r)}\n     отбор: ${sh(r.sel)}\n     экзамен: ${sh(r.ex)}\n     все 31: ${sh(r.all)}`);
  console.log('ЛУЧШИЕ ПО ЭКЗАМЕНУ (для сравнения, так выбирать нельзя):');
  for (const r of [...rows].sort((x, y) => score(y.ex) - score(x.ex)).slice(0, 3)) console.log(`  ${line(r)}\n     отбор: ${sh(r.sel)}\n     экзамен: ${sh(r.ex)}`);
  for (const [n, q] of [['мягкая (10/10)', (r) => f15(r) && r.ss === 10 && r.sw === 10], ['с градацией (25/5)', (r) => f15(r) && r.ss === 25 && r.sw === 5]]) { const r = rows.find(q); console.log(`${n}: отбор ${sh(r.sel)} | экзамен ${sh(r.ex)} | все ${sh(r.all)}`); }
  console.log('\nРАЗМЕР ПОКУПКИ (сильная 25, слабая 5, порог 40): ' + BB.map((b) => { const r = rows.find((q) => q.b === b && q.thr === 40 && q.ss === 25 && q.sw === 5); return `${Math.round((b - 1) * 100)}%: мед ${r.all.med.toFixed(0)} худ ${r.all.worst.toFixed(0)} пол ${r.all.hworst.toFixed(0)}`; }).join(' | '));
  console.log('ПОРОГ СТРАХА (покупка 50%, сильная 25, слабая 5): ' + TH.map((t) => { const r = rows.find((q) => q.b === 1.5 && q.thr === t && q.ss === 25 && q.sw === 5); return `${t}: мед ${r.all.med.toFixed(0)} худ ${r.all.worst.toFixed(0)} пол ${r.all.hworst.toFixed(0)}`; }).join(' | '));
  // связь отбора и экзамена: если сетка «настоящая», хорошее на отборе хорошо и на экзамене
  const a = rows.map((r) => score(r.sel)), b = rows.map((r) => score(r.ex)), ma = a.reduce((x, y) => x + y) / a.length, mb = b.reduce((x, y) => x + y) / b.length;
  let sab = 0, saa = 0, sbb = 0; a.forEach((x, i) => { sab += (x - ma) * (b[i] - mb); saa += (x - ma) ** 2; sbb += (b[i] - mb) ** 2; });
  console.log('корреляция оценки на отборе и на экзамене по всем вариантам: ' + (sab / Math.sqrt(saa * sbb)).toFixed(2));
  fs.writeFileSync(outPath, JSON.stringify(rows));
  await browser.close();
})();
