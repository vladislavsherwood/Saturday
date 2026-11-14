/* Объединение 2: браузерный стенд (страницы simple.js + inject, injLiq, injLs, injB, injC, injBeta, injBig, injSeg, injTA) на отборе, экзамене,
   50 случайных и 100 новых (n0…n9); статистика по всей выборке и по сегментам (крупные/альты/мемы — единые списки combo2_sim.js),
   строгая проверка к эталону (первый кандидат), доход, лучше/хуже по монетам. Кандидаты — JSON {название: стратегия}.
   Запуск: node app/combo2_lab.js <папка со страницами> <кандидаты.json>  → <кандидаты>.lab.json */
const fs = require('fs');
const { chromium } = require('playwright');
const { inject } = require('./lab.js');
const { inPage, open } = require('./simple.js');
const { injLiq } = require('./liq_inject.js');
const { injLs } = require('./ls_inject.js');
const { injB } = require('./agent4b_inject.js');
const { injC } = require('./combo_inject.js');
const { injBeta } = require('./agent3_inject.js');
const { injBig } = require('./seg_big_inject.js');
const { injSeg, injTA } = require('./combo2_inject.js');
const Z = require('./combo2_sim.js');
const T = require('./ta_sim.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const EXTRA = JSON.parse(fs.readFileSync(__dirname + '/found/market_extra.json', 'utf8'));
const LISTS = { BIG: Z.BIG, MEME: Z.MEME, STABLE: Z.STABLE };
const BT = T.btcTA(), TAM = {}; for (const [t, j] of BT.map) TAM[t] = [BT.o.b_bbwp[j], BT.o.b_w20[j]];
const PG = { sel: ['strategy-builder-sol', 'valid'], ex: ['exam', 'memes6'], rnd: ['rnd0', 'rnd1', 'rnd2', 'rnd3', 'rnd4'], n100: [...Array(10).keys()].map((i) => 'n' + i) };
(async () => {
  const [dir, file] = process.argv.slice(2), C = JSON.parse(fs.readFileSync(file, 'utf8'));
  const L = Object.entries(C).map(([tag, S]) => ({ tag, S }));
  const br = await chromium.launch(), R = {};
  for (const g in PG) {
    R[g] = L.map(() => []);
    for (const pg of PG[g]) {
      const p = await open(br, `${dir}/${pg}.html`, 'combo2');
      await p.evaluate(inject, EXTRA); await p.evaluate(injLiq, LIQ); await p.evaluate(injLs); await p.evaluate(injB); await p.evaluate(injC); await p.evaluate(injBeta);
      await p.evaluate(injBig); await p.evaluate(injSeg, LISTS); await p.evaluate(injTA, TAM);
      const parts = {}; for (const part of ['full', 'h1', 'h2']) parts[part] = await p.evaluate(inPage, { seed: 1, unit: 10, evalMany: L.map((x) => x.S), part });
      await p.close();
      L.forEach((x, i) => parts.full[i].e.forEach((v, k) => { const nm = parts.full[i].names[k]; R[g][i].push({ name: nm, seg: Z.seg(String(nm).toUpperCase().replace(/[-_/].*$/, '')), f: v, h1: parts.h1[i].e[k], h2: parts.h2[i].e[k] }); }));
    }
    console.error('готово', g);
  }
  await br.close();
  const b = R && Object.fromEntries(Object.keys(PG).map((g) => [g, R[g][0]])), bs = Z.sum(b), out = {};
  L.forEach((x, i) => {
    const r = Object.fromEntries(Object.keys(PG).map((g) => [g, R[g][i]])), S = Z.sum(r), o = { R: {}, inc: {}, strict: {}, mlog: {} };
    for (const g in S) { o.R[g] = {}; for (const s of Z.SEGS) if (S[g][s]) { const { e, ...y } = S[g][s]; o.R[g][s] = y; } }
    for (const s of Z.SEGS) { o.inc[s] = Z.inc(S, s) - Z.inc(bs, s); o.strict[s] = Z.strict(S, bs, s); o.mlog[s] = { old: Z.mlog(r, b, s, ['sel', 'ex', 'rnd']), n100: Z.mlog(r, b, s, ['n100']) }; }
    o.coins = r; out[x.tag] = o;
    console.log(`\n== ${x.tag}`);
    for (const s of Z.SEGS) {
      const q = Object.keys(PG).map((g) => S[g][s] ? `${S[g][s].med.toFixed(0)}/${S[g][s].pos}из${S[g][s].n}/${S[g][s].hpos}/${S[g][s].hworst.toFixed(1)}/${S[g][s].worst.toFixed(0)}` : '—').join(' | ');
      console.log(`  ${s.padEnd(4)} доход ${o.inc[s] >= 0 ? '+' : ''}${o.inc[s].toFixed(3)} ${o.strict[s].length ? '· ' + o.strict[s].join(',') : '✔'} | ${q} | 100н лучше/хуже ${o.mlog[s].n100.u}/${o.mlog[s].n100.d}`);
    }
  });
  fs.writeFileSync(file.replace(/\.json$/, '') + '.lab.json', JSON.stringify(out));
})();
