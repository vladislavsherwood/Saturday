/* Объединение (копия agent4b_lab.js + rel90/rel180 из combo_inject.js): проверка кандидатов в настоящем браузерном стенде (lab.js: отбор, экзамен, 50 случайных, металлы; injLiq + injLs)
   и на 100 новых монетах (страницы n0…n9). Кандидаты — JSON {название: стратегия}; первая — эталон.
   Запуск: node app/combo_lab.js <папка со страницами> <кандидаты.json> */
const fs = require('fs');
const { chromium } = require('playwright');
const { lab, stable, report, inject } = require('./lab.js');
const { inPage, open } = require('./simple.js');
const { injLiq } = require('./liq_inject.js');
const { injLs } = require('./ls_inject.js');
const { injB } = require('./agent4b_inject.js');
const { injC } = require('./combo_inject.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const EXTRA = JSON.parse(fs.readFileSync(__dirname + '/found/market_extra.json', 'utf8'));
(async () => {
  const [dir, file] = process.argv.slice(2), C = JSON.parse(fs.readFileSync(file, 'utf8'));
  const L = Object.entries(C).map(([tag, S]) => ({ tag, S }));
  const lb = await lab(dir, { rnd: true });
  for (const g in lb.pages) { await lb.pages[g].evaluate(injLiq, LIQ); await lb.pages[g].evaluate(injLs); await lb.pages[g].evaluate(injB); await lb.pages[g].evaluate(injC); }
  const rows = await lb.run(L); await lb.close();
  const base = rows[0];
  const user = (r) => ['sel', 'ex', 'rnd'].every((k) => r[k].pos >= base[k].pos && r[k].hpos >= base[k].hpos && r[k].hworst >= base[k].hworst);
  const strict = (r) => stable(r, base, 'sel') && stable(r, base, 'ex') && r.rnd.pos >= base.rnd.pos && r.rnd.hpos >= base.rnd.hpos && r.rnd.hworst >= base.rnd.hworst;
  for (const r of rows) console.log(`\n== ${r.tag} ${strict(r) ? '[строгая ✔]' : user(r) ? '[критерии пользователя ✔]' : ''}\n${report(r)}`);
  const files = [...Array(10).keys()].map((i) => `${dir}/n${i}.html`), br = await chromium.launch(), R = { full: [], h1: [], h2: [] };
  for (const f of files) { const p = await open(br, f, 'a2'); await p.evaluate(inject, EXTRA); await p.evaluate(injLiq, LIQ); await p.evaluate(injLs); await p.evaluate(injB); await p.evaluate(injC);
    for (const part of ['full', 'h1', 'h2']) R[part].push(await p.evaluate(inPage, { seed: 1, unit: 10, evalMany: L.map((x) => x.S), part })); await p.close(); }
  await br.close();
  const med = (v) => { const s = [...v].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const F0 = R.full.flatMap((r) => r[0].e);
  console.log('\n100 новых монет:');
  const out = {};
  L.forEach((x, i) => { const f = R.full.flatMap((r) => r[i].e), h = [...R.h1, ...R.h2].flatMap((r) => r[i].e);
    out[x.tag] = { pos: f.filter((v) => v > 0).length, med: med(f), hpos: h.filter((v) => v > 0).length, better: f.filter((v, k) => v > F0[k] + 0.5).length, worse: f.filter((v, k) => v < F0[k] - 0.5).length };
    console.log(`  ${x.tag}: в плюсе ${out[x.tag].pos}/100, медиана ${out[x.tag].med.toFixed(0)}%, половины в плюсе ${out[x.tag].hpos}/200 | лучше эталона на ${out[x.tag].better}, хуже на ${out[x.tag].worse}`); });
  fs.writeFileSync(file.replace(/\.json$/, '') + '.lab.json', JSON.stringify({ rows: rows.map((r) => ({ tag: r.tag, sel: r.sel, ex: r.ex, rnd: r.rnd, met: r.met })), n100: out }));
})();
