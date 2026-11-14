/* Сведение: B, K1 (тихая вершина 40%), K3 (агент), и они же + отложенная покупка после выноса (толпа вышла из шортов, 50% резерва).
   Отбор/экзамен/50 случайных, затем 100 новых. Запуск: node app/combo_final.js <папка> */
const fs = require('fs');
const { chromium } = require('playwright');
const { lab, c, stable, report, inject } = require('./lab.js');
const { inPage, open } = require('./simple.js');
const { injLiq } = require('./liq_inject.js');
const { injLs } = require('./ls_inject.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const B = JSON.parse(fs.readFileSync(__dirname + '/found/main-crypto.json', 'utf8'));
const K3 = JSON.parse(fs.readFileSync(__dirname + '/found/agent-best.json', 'utf8'));
const qt40 = (S) => ({ ...S, rules: S.rules.map((r) => (r.conds.length === 1 && r.conds[0].ind === 'qt' ? { ...r, act: -0.4 } : r)) });
const K1 = qt40(B);
const DLY = { act: 1.5, conds: [c('dly20_100f', '>', 0.5)] };
const withD = (S) => { const i = S.rules.findIndex((r) => r.conds.some((cd) => cd.ind === 'oidd30' && cd.v === -28)); return { ...S, rules: [...S.rules.slice(0, i), DLY, ...S.rules.slice(i)] }; };
const L = [{ tag: 'B', S: B }, { tag: 'K1 = B + тихая вершина 40%', S: K1 }, { tag: 'K3 (агент)', S: K3 },
  { tag: 'B + отложенная', S: withD(B) }, { tag: 'K1 + отложенная', S: withD(K1) }, { tag: 'K3 + отложенная', S: withD(K3) }];
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  for (const g in lb.pages) { await lb.pages[g].evaluate(injLiq, LIQ); await lb.pages[g].evaluate(injLs); }
  const rows = await lb.run(L); await lb.close();
  const base = rows[0];
  const ok = (r) => [stable(r, base, 'sel') && r.sel.med >= base.sel.med, stable(r, base, 'ex') && r.ex.med >= base.ex.med, r.rnd.pos >= base.rnd.pos && r.rnd.hpos >= base.rnd.hpos && r.rnd.med >= base.rnd.med];
  console.log('отбор медиана/худш.пол./половин+/худшая | экзамен | 50 случ. медиана/худш.пол./половин+');
  for (const r of rows) console.log(`${r.sel.med.toFixed(0).padStart(5)}/${r.sel.hworst.toFixed(0).padStart(4)}/${r.sel.hpos}/${r.sel.worst.toFixed(0)} | ${r.ex.med.toFixed(0).padStart(4)}/${r.ex.hworst.toFixed(0).padStart(3)}/${r.ex.hpos} | ${r.rnd.med.toFixed(0).padStart(4)}/${r.rnd.hworst.toFixed(0)}/${r.rnd.hpos} ${ok(r).map((x) => (x ? '✔' : '·')).join('')} ${r.tag}`);
  // 100 новых
  const [dir] = process.argv.slice(2), files = [...Array(10).keys()].map((i) => `${dir}/n${i}.html`);
  const extra = JSON.parse(fs.readFileSync(__dirname + '/found/market_extra.json', 'utf8'));
  const br = await chromium.launch(), R = { full: [], h1: [], h2: [] };
  for (const f of files) { const p = await open(br, f, 'n100'); await p.evaluate(inject, extra); await p.evaluate(injLiq, LIQ); await p.evaluate(injLs);
    for (const part of ['full', 'h1', 'h2']) R[part].push(await p.evaluate(inPage, { seed: 1, unit: 10, evalMany: L.map((x) => x.S), part })); await p.close(); }
  await br.close();
  const med = (v) => { const s = [...v].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const F0 = R.full.flatMap((r) => r[0].e);
  console.log('\n100 новых монет:');
  L.forEach((x, i) => { const f = R.full.flatMap((r) => r[i].e), h = [...R.h1, ...R.h2].flatMap((r) => r[i].e);
    console.log(`  ${x.tag.padEnd(28)} в плюсе ${f.filter((v) => v > 0).length}/100, медиана ${med(f).toFixed(0)}%, половины в плюсе ${h.filter((v) => v > 0).length}/200 | лучше B на ${f.filter((v, k) => v > F0[k] + 0.5).length} монетах, хуже на ${f.filter((v, k) => v < F0[k] - 0.5).length}`); });
  fs.writeFileSync(dir + '/combo_final.json', JSON.stringify(L));
})();
