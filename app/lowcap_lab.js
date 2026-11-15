/* Агент «ЛОУКАП», круг 9: проверка в настоящем браузерном стенде (lab.js: отбор, экзамен, 50 случайных, металлы; injLiq + injLs + injB + injC + injBeta
   + injLow с капитализацией/оборотом/фандингом монеты), на 100 новых монетах (n0…n9) и на лоукапах (страницы lc0…lc15: отбор и проверка).
   Кандидаты — JSON {название: стратегия}; первая — эталон. Запуск: node app/lowcap_lab.js <папка со страницами стенда> <кандидаты.json> */
const fs = require('fs');
const { chromium } = require('playwright');
const { lab, stable, report, inject } = require('./lab.js');
const { inPage, open } = require('./simple.js');
const { injLiq } = require('./liq_inject.js');
const { injLs } = require('./ls_inject.js');
const { injB } = require('./agent4b_inject.js');
const { injC } = require('./combo_inject.js');
const { injBeta } = require('./agent3_inject.js');
const { injLow, lowcapPayload } = require('./lowcap_inject.js');
const L = require('./lowcap_sim.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const EXTRA = JSON.parse(fs.readFileSync(__dirname + '/found/market_extra.json', 'utf8'));
const LCDIR = '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/lowcap/pages';
(async () => {
  const [dir, file] = process.argv.slice(2), C = JSON.parse(fs.readFileSync(file, 'utf8'));
  const Lst = Object.entries(C).map(([tag, S]) => ({ tag, S }));
  const G = L.load(), byPage = {};
  for (const g in G) for (const X of G[g]) (byPage[X.page] = byPage[X.page] || []).push(X);
  const pay = (p) => lowcapPayload(byPage[p] || []);
  const injAll = async (p, nm) => { await p.evaluate(injLiq, LIQ); await p.evaluate(injLs); await p.evaluate(injB); await p.evaluate(injC); await p.evaluate(injBeta); await p.evaluate(injLow, pay(nm)); };
  const lb = await lab(dir, { rnd: true });
  const PN = { own: 'strategy-builder-sol', valid: 'valid', exam: 'exam', memes: 'memes6', metals: 'metals', r0: 'rnd0', r1: 'rnd1', r2: 'rnd2', r3: 'rnd3', r4: 'rnd4' };
  for (const g in lb.pages) await injAll(lb.pages[g], PN[g]);
  const rows = await lb.run(Lst); await lb.close();
  const base = rows[0];
  const strict = (r) => stable(r, base, 'sel') && stable(r, base, 'ex') && r.rnd.pos >= base.rnd.pos && r.rnd.hpos >= base.rnd.hpos && r.rnd.hworst >= base.rnd.hworst;
  for (const r of rows) console.log(`\n== ${r.tag} ${strict(r) ? '[строгая ✔]' : ''}\n${report(r)}`);
  const med = (v) => { const s = [...v].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const br = await chromium.launch(), out = {};
  async function group(tag, files) {
    const R = { full: [], h1: [], h2: [] }, names = [];
    for (const [f, nm] of files) { const p = await open(br, f, 'lc'); await p.evaluate(inject, EXTRA); await injAll(p, nm);
      for (const part of ['full', 'h1', 'h2']) { const x = await p.evaluate(inPage, { seed: 1, unit: 10, evalMany: Lst.map((q) => q.S), part }); R[part].push(x); if (part === 'full') names.push(...x[0].names); } await p.close(); }
    const F0 = R.full.flatMap((r) => r[0].e); out[tag] = {};
    console.log(`\n${tag} (${F0.length} монет):`);
    Lst.forEach((x, i) => { const f = R.full.flatMap((r) => r[i].e), h = [...R.h1, ...R.h2].flatMap((r) => r[i].e);
      const o = { n: f.length, pos: f.filter((v) => v > 0).length, med: med(f), hpos: h.filter((v) => v > 0).length, hworst: Math.min(...h), worst: Math.min(...f), better: f.filter((v, k) => v > F0[k] + 0.5).length, worse: f.filter((v, k) => v < F0[k] - 0.5).length,
        mlog: f.reduce((s, v, k) => s + Math.log1p(v / 100) - Math.log1p(F0[k] / 100), 0) / f.length, e: f, names };
      out[tag][x.tag] = o;
      console.log(`  ${x.tag}: медиана ${o.med.toFixed(0)}%, в плюсе ${o.pos}/${o.n}, половин ${o.hpos}/${2 * o.n}, худшая половина ${o.hworst.toFixed(0)}%, худшая монета ${o.worst.toFixed(0)}% | ср. лог к эталону ${o.mlog >= 0 ? '+' : ''}${o.mlog.toFixed(3)}, лучше/хуже ${o.better}/${o.worse}`); });
  }
  await group('100 новых монет', [...Array(10).keys()].map((i) => [`${dir}/n${i}.html`, `n${i}`]));
  // лоукапы: страницы lc*, затем разбиение на отбор и проверку по монетам
  const PL = JSON.parse(fs.readFileSync(LCDIR + '/pages.json', 'utf8'));
  await group('лоукапы (все 157)', Object.keys(PL).map((p) => [`${LCDIR}/${p}.html`, p]));
  const all = out['лоукапы (все 157)'];
  for (const part of ['sel', 'chk']) { const tag = part === 'sel' ? 'отбор лоукапов' : 'проверка лоукапов'; out[tag] = {}; console.log(`\n${tag}:`);
    const idx = all[Lst[0].tag].names.map((nm, k) => (L.LOW[nm] && L.LOW[nm].part === part ? k : -1)).filter((k) => k >= 0), F0 = idx.map((k) => all[Lst[0].tag].e[k]);
    for (const x of Lst) { const f = idx.map((k) => all[x.tag].e[k]); const o = { n: f.length, pos: f.filter((v) => v > 0).length, med: med(f), mlog: f.reduce((s, v, k) => s + Math.log1p(v / 100) - Math.log1p(F0[k] / 100), 0) / f.length, better: f.filter((v, k) => v > F0[k] + 0.5).length, worse: f.filter((v, k) => v < F0[k] - 0.5).length };
      out[tag][x.tag] = o; console.log(`  ${x.tag}: медиана ${o.med.toFixed(0)}%, в плюсе ${o.pos}/${o.n} | ср. лог к эталону ${o.mlog >= 0 ? '+' : ''}${o.mlog.toFixed(3)}, лучше/хуже ${o.better}/${o.worse}`); } }
  await br.close();
  for (const g in out) for (const t in out[g]) { delete out[g][t].e; delete out[g][t].names; }
  fs.writeFileSync(file.replace(/\.json$/, '') + '.lab.json', JSON.stringify({ rows: rows.map((r) => ({ tag: r.tag, sel: r.sel, ex: r.ex, rnd: r.rnd, met: r.met, strict: strict(r) })), groups: out }));
})();
