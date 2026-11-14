/* Выгрузка рядов со страниц стенда (цены и все индикаторы после inject + injLiq) в двоичные файлы для быстрого расчёта в node.
   Заодно — эталонный итог стратегии B через inPage для сверки оценщика agent_sim.js.
   Запуск: node app/agent_export.js <папка со страницами> <куда> [страницы...] */
const fs = require('fs');
const { chromium } = require('playwright');
const { inPage, open } = require('./simple.js');
const { inject } = require('./lab.js');
const { injLiq } = require('./liq_inject.js');
const EXTRA = JSON.parse(fs.readFileSync(__dirname + '/found/market_extra.json', 'utf8')), LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const B = JSON.parse(fs.readFileSync(__dirname + '/found/main-crypto.json', 'utf8'));
(async () => {
  const [dir, out, ...names] = process.argv.slice(2), b = await chromium.launch();
  fs.mkdirSync(out, { recursive: true });
  await Promise.all(names.map(async (nm) => {
    const p = await open(b, `${dir}/${nm}.html`, 'exp');
    await p.evaluate(inject, EXTRA); await p.evaluate(injLiq, LIQ);
    const ref = {}; for (const part of ['full', 'h1', 'h2']) ref[part] = await p.evaluate(inPage, { seed: 1, unit: 10, evalMany: [B], part });
    const meta = await p.evaluate(() => { const cur = SETS.order.find((k) => SETS.sets[k] === RAW), o = []; for (const k of SETS.avg) { setup(k, true); o.push({ k, name: RAW.ticker, n: H.c.length, N, keys: Object.keys(IND) }); } setup(cur, true); return o; });
    const bufs = [];
    for (let i = 0; i < meta.length; i++) {
      const arr = await p.evaluate((k) => { const cur = SETS.order.find((q) => SETS.sets[q] === RAW); setup(k, true); const o = { t: H.t, c: H.c, h: H.h, l: H.l }; for (const key in IND) o[key] = IND[key].v.map((x) => (x == null ? NaN : x)); setup(cur, true); return o; }, meta[i].k);
      meta[i].cols = Object.keys(arr); meta[i].off = bufs.reduce((s, x) => s + x.length, 0);
      for (const col of meta[i].cols) { const f = new Float64Array(meta[i].n); for (let j = 0; j < meta[i].n; j++) f[j] = arr[col][j] == null ? NaN : arr[col][j]; bufs.push(f); }
    }
    const all = new Float64Array(bufs.reduce((s, x) => s + x.length, 0)); let o = 0; for (const x of bufs) { all.set(x, o); o += x.length; }
    fs.writeFileSync(`${out}/${nm}.bin`, Buffer.from(all.buffer));
    fs.writeFileSync(`${out}/${nm}.json`, JSON.stringify({ meta, ref: { full: ref.full[0].e, h1: ref.h1[0].e, h2: ref.h2[0].e, names: ref.full[0].names } }));
    console.log(nm, meta.length, 'активов');
    await p.close();
  }));
  await b.close();
})();
