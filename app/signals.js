/* Две проверки поверх «мягкой» стратегии.
   1. Серии свечей: N красных или зелёных подряд → купить / продать / пропустить; отдельно и как добавка к мягкой.
   2. Сила сигнала: сигнал покупки и сигнал продажи мягкой делятся на «сильный» и «слабый» дополнительным условием,
      на сильном действие крупнее, на слабом мельче. Отбор на 17 монетах, экзамен на 14.

   Запуск: node app/signals.js <наши.html> <отбор.html> <экзамен.html> <мемы.html> <куда.json> */
const { chromium } = require('playwright');
const fs = require('fs');
const { inPage, open } = require('./simple.js');

const c = (ind, op, v) => ({ ind, op, v });
const BC = [c('usdt', '>', 1.07), c('othd', '<', 25)], SC = [c('fng', '<', 52), c('usdtd', '<', 7.6)];
const GENTLE = { base: 1, rules: [{ act: 1.5, conds: BC }, { act: -0.1, conds: SC }] };
const CANDS = [{ S: GENTLE, tag: 'МЯГКАЯ (эталон)', kind: 'base' }, { S: { base: 1, rules: [] }, tag: 'DCA', kind: 'base' }];

// ---- 1. серии свечей ----
for (const n of [2, 3, 4, 5, 6, 7, 8]) {
  for (const [ind, nm] of [['red', 'красных'], ['green', 'зелёных']]) for (const act of [2, 1.5, 0, -0.1, -0.25]) {
    const r = { act, conds: [c(ind, '>', n - 0.5)] }, what = act > 1 ? `купить из резерва ${Math.round((act - 1) * 100)}%` : act === 0 ? 'пропустить взнос' : `продать ${-act * 100}%`;
    CANDS.push({ S: { base: 1, rules: [r] }, tag: `${n} ${nm} подряд → ${what}`, kind: 'streak', n, ind, act });
    CANDS.push({ S: { base: 1, rules: [...GENTLE.rules, r] }, tag: `мягкая + ${n} ${nm} подряд → ${what}`, kind: 'streak+', n, ind, act });
  }
}
// ---- 2. сила сигнала ----
const X = [];
const grid = { usdt: [1.14, 1.21, 1.3], usdtd: [4, 5, 6, 7], fng: [20, 30, 40, 60], dd: [30, 50, 70], ath: [30, 50, 70], sma200: [0.7, 0.85, 1, 1.15], sma50: [0.9, 1, 1.1],
  rsi: [35, 45, 55], ret1: [-3, 0, 3], ret30: [-25, -10, 5, 20], ret90: [-35, -15, 10, 40], bbz: [-1.5, -0.5, 0.5], btcd: [45, 50, 55, 60], ethd: [10, 13, 16], othd: [20, 22, 28, 32],
  vol: [0.8, 1.3, 2], pair: [0.85, 1, 1.15], red: [1.5, 2.5, 3.5], green: [1.5, 2.5, 3.5] };
for (const ind in grid) for (const v of grid[ind]) for (const op of ['<', '>']) X.push(c(ind, op, v));
const sx = (k) => `${k.ind} ${k.op} ${k.v}`;
for (const x of X) {
  for (const [bs, bw] of [[2, 1.25], [2, 1.5], [2, 1], [1.5, 1.25], [1.5, 1]]) CANDS.push({ S: { base: 1, rules: [{ act: bs, conds: [...BC, x] }, { act: bw, conds: BC }, GENTLE.rules[1]] }, tag: `покупка: сильный, если ${sx(x)} → ${bs}, иначе ${bw}`, kind: 'buy', x, a: [bs, bw] });
  for (const [ss, sw] of [[-0.25, -0.05], [-0.25, -0.1], [-0.2, -0.05], [-0.1, -0.05], [-0.1, 0], [-0.25, 0]]) CANDS.push({ S: { base: 1, rules: [GENTLE.rules[0], { act: ss, conds: [...SC, x] }, { act: sw, conds: SC }] }, tag: `продажа: сильный, если ${sx(x)} → ${ss}, иначе ${sw}`, kind: 'sell', x, a: [ss, sw] });
}

const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const stat = (full, halves) => ({ n: full.length, pos: full.filter((x) => x > 0).length, worst: Math.min(...full), med: med(full), mean: full.reduce((x, y) => x + y, 0) / full.length,
  hpos: halves.filter((x) => x > 0).length, hn: halves.length, hworst: Math.min(...halves), hmed: med(halves) });
const show = (t, s) => `${t}: в плюсе ${s.pos}/${s.n}, худшая ${s.worst.toFixed(0)}%, медиана ${s.med.toFixed(0)}% | половины: в плюсе ${s.hpos}/${s.hn}, худшая ${s.hworst.toFixed(0)}%, медиана ${s.hmed.toFixed(0)}%`;

(async () => {
  const [own, valid, exam, memes, outPath] = process.argv.slice(2);
  const browser = await chromium.launch(), R = {};
  const SEL = ['own', 'valid'], EX = ['exam', 'memes'], ALL = [...SEL, ...EX];
  async function run(list) {
    const out = {};
    for (const [name, file] of [['own', own], ['valid', valid], ['exam', exam], ['memes', memes]]) {
      const page = await open(browser, file, 'sg' + name); out[name] = {};
      for (const part of ['full', 'h1', 'h2']) out[name][part] = await page.evaluate(inPage, { seed: 1, unit: 10, evalMany: list.map((x) => x.S), part });
      await page.close();
    }
    const get = (i, g, part) => g.flatMap((k) => out[k][part][i].e);
    return list.map((x, i) => ({ ...x, sel: stat(get(i, SEL, 'full'), [...get(i, SEL, 'h1'), ...get(i, SEL, 'h2')]), ex: stat(get(i, EX, 'full'), [...get(i, EX, 'h1'), ...get(i, EX, 'h2')]),
      all: stat(get(i, ALL, 'full'), [...get(i, ALL, 'h1'), ...get(i, ALL, 'h2')]) }));
  }
  console.log('кандидатов', CANDS.length);
  const rows = await run(CANDS), base = rows[0];
  console.log(show('МЯГКАЯ, отбор', base.sel)); console.log(show('МЯГКАЯ, экзамен', base.ex)); console.log(show('МЯГКАЯ, все 31', base.all));

  console.log('\n=== 1. СЕРИИ СВЕЧЕЙ, все 31 монета, итог к DCA (медиана / худшая / в плюсе) ===');
  for (const ind of ['red', 'green']) for (const act of [2, 1.5, 0, -0.1, -0.25]) {
    console.log(`${ind === 'red' ? 'красные' : 'зелёные'} → ${act}:  ` + rows.filter((r) => r.kind === 'streak' && r.ind === ind && r.act === act).map((r) => `${r.n}: ${r.all.med.toFixed(1)}/${r.all.worst.toFixed(0)}/${r.all.pos}`).join('  '));
  }
  console.log('--- как добавка к мягкой (медиана на всех 31; у мягкой ' + base.all.med.toFixed(0) + '%, худшая ' + base.all.worst.toFixed(0) + '%)');
  for (const ind of ['red', 'green']) for (const act of [2, 1.5, 0, -0.1, -0.25]) {
    console.log(`${ind === 'red' ? 'красные' : 'зелёные'} → ${act}:  ` + rows.filter((r) => r.kind === 'streak+' && r.ind === ind && r.act === act).map((r) => `${r.n}: ${r.all.med.toFixed(0)}/${r.all.worst.toFixed(0)}/${r.all.pos}`).join('  '));
  }

  const stable = (r, k, b) => r[k].pos >= b[k].pos && r[k].worst >= b[k].worst && r[k].hpos >= b[k].hpos && r[k].hworst >= b[k].hworst;
  const res = {};
  for (const kind of ['buy', 'sell']) {
    const pool = rows.filter((r) => r.kind === kind), ok = pool.filter((r) => stable(r, 'sel', base) && r.sel.med > base.sel.med).sort((x, y) => y.sel.med - x.sel.med);
    console.log(`\n=== 2. СИЛА СИГНАЛА: ${kind === 'buy' ? 'ПОКУПКА' : 'ПРОДАЖА'} — вариантов ${pool.length}; на отборе не менее устойчивы и прибыльнее мягкой: ${ok.length}; из них на экзамене не менее устойчивы и прибыльнее: ${ok.filter((r) => stable(r, 'ex', base) && r.ex.med > base.ex.med).length}`);
    for (const r of ok.slice(0, 8)) { console.log(`  ${r.tag}`); console.log(show('     отбор', r.sel)); console.log(show('     экзамен', r.ex) + (stable(r, 'ex', base) && r.ex.med > base.ex.med ? '  ✔' : '  ✘')); }
    // какие признаки чаще всего отличают сильный сигнал
    const byX = {};
    for (const r of ok) { const k = sx(r.x); (byX[k] = byX[k] || []).push(r); }
    console.log('  признаки (сколько вариантов размеров прошло отбор / из них экзамен): ' + Object.entries(byX).sort((x, y) => y[1].length - x[1].length).slice(0, 12).map(([k, v]) => `${k}: ${v.length}/${v.filter((r) => stable(r, 'ex', base) && r.ex.med > base.ex.med).length}`).join(' ; '));
    res[kind] = ok;
  }
  // ---- объединение лучших делений покупки и продажи ----
  const combo = [];
  for (const b of res.buy.slice(0, 15)) for (const s of res.sell.slice(0, 15)) combo.push({ S: { base: 1, rules: [b.S.rules[0], b.S.rules[1], s.S.rules[1], s.S.rules[2]] }, tag: b.tag + '  +  ' + s.tag });
  let crow = [];
  if (combo.length) {
    crow = (await run(combo)).filter((r) => stable(r, 'sel', base) && r.sel.med > base.sel.med).sort((x, y) => y.sel.med - x.sel.med);
    console.log(`\n=== 3. ВМЕСТЕ: вариантов ${combo.length}, прошли отбор ${crow.length}, из них экзамен ${crow.filter((r) => stable(r, 'ex', base) && r.ex.med > base.ex.med).length}`);
    for (const r of crow.slice(0, 5)) { console.log(`  ${r.tag}`); console.log(show('     отбор', r.sel)); console.log(show('     экзамен', r.ex) + (stable(r, 'ex', base) && r.ex.med > base.ex.med ? '  ✔' : '  ✘')); console.log(show('     все 31', r.all)); }
  }
  fs.writeFileSync(outPath, JSON.stringify({ base, streak: rows.filter((r) => r.kind.startsWith('streak')), buy: res.buy.slice(0, 40), sell: res.sell.slice(0, 40), combo: crow.slice(0, 20) }));
  await browser.close();
})();
