/* Агент «АЛЬТЫ»: проверка кандидатов в настоящем браузерном стенде (страницы simple.js/lab.js + inject, injLiq, injLs, injB, injC, injBeta
   как в combo_lab.js + флаг isalt из seg_alt_inject.js) на отборе, экзамене, 50 случайных и 100 новых; статистика по альтам и остальным
   отдельно (по тикерам), строгая проверка внутри подгрупп, лучше/хуже эталона по монетам. Кандидаты — JSON {название: стратегия}; первая — эталон.
   Запуск: node app/seg_alt_lab.js <папка со страницами> <кандидаты.json>  → <кандидаты>.lab.json */
const fs = require('fs');
const { chromium } = require('playwright');
const { inject } = require('./lab.js');
const { inPage, open } = require('./simple.js');
const { injLiq } = require('./liq_inject.js');
const { injLs } = require('./ls_inject.js');
const { injB } = require('./agent4b_inject.js');
const { injC } = require('./combo_inject.js');
const { injBeta } = require('./agent3_inject.js');
const { injAlt } = require('./seg_alt_inject.js');
const Q = require('./seg_alt_sim.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const EXTRA = JSON.parse(fs.readFileSync(__dirname + '/found/market_extra.json', 'utf8'));
const NOT = [...Q.LARGE, ...Q.MEME, ...Q.STABLE];
const PG = { sel: ['strategy-builder-sol', 'valid'], ex: ['exam', 'memes6'], rnd: ['rnd0', 'rnd1', 'rnd2', 'rnd3', 'rnd4'], n100: [...Array(10).keys()].map((i) => 'n' + i) };
(async () => {
  const [dir, file] = process.argv.slice(2), C = JSON.parse(fs.readFileSync(file, 'utf8'));
  const L = Object.entries(C).map(([tag, S]) => ({ tag, S }));
  const br = await chromium.launch(), R = {};
  for (const g in PG) {
    R[g] = L.map(() => []);
    for (const pg of PG[g]) {
      const p = await open(br, `${dir}/${pg}.html`, 'segalt');
      await p.evaluate(inject, EXTRA); await p.evaluate(injLiq, LIQ); await p.evaluate(injLs); await p.evaluate(injB); await p.evaluate(injC); await p.evaluate(injBeta); await p.evaluate(injAlt, NOT);
      const parts = {}; for (const part of ['full', 'h1', 'h2']) parts[part] = await p.evaluate(inPage, { seed: 1, unit: 10, evalMany: L.map((x) => x.S), part });
      await p.close();
      L.forEach((x, i) => parts.full[i].e.forEach((v, k) => R[g][i].push({ name: parts.full[i].names[k], alt: !NOT.includes(parts.full[i].names[k]), full: v, h1: parts.h1[i].e[k], h2: parts.h2[i].e[k] })));
    }
    console.error('готово', g);
  }
  await br.close();
  const out = {};
  L.forEach((x, i) => { const r = { c: {} }; for (const g in PG) { r.c[g] = R[g][i]; r[g] = { all: Q.st(R[g][i]), alt: Q.st(R[g][i].filter((y) => y.alt)), oth: Q.st(R[g][i].filter((y) => !y.alt)) }; } out[x.tag] = r; });
  const b = out[L[0].tag];
  for (const x of L) console.log(Q.row(x.tag, out[x.tag], x === L[0] ? null : b));
  for (const x of L) { const r = out[x.tag]; console.log(`  ${x.tag}: 100 новых — все ${r.n100.all.med.toFixed(0)}% (в плюсе ${r.n100.all.pos}/100, половин ${r.n100.all.hpos}/200), альты ${r.n100.alt.med.toFixed(0)}% (${r.n100.alt.pos}/${r.n100.alt.n}, половин ${r.n100.alt.hpos}/${2 * r.n100.alt.n})`); }
  const slim = {}; for (const t in out) { slim[t] = {}; for (const g in PG) slim[t][g] = out[t][g]; slim[t].coins = out[t].c; }
  fs.writeFileSync(file.replace(/\.json$/, '') + '.lab.json', JSON.stringify(slim));
})();
