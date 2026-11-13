/* Рыночная структура (higher high / higher low, пробои впадин и вершин):
   1. отдельные стратегии только на структуре: правило продажи + правило возврата денег;
   2. структура как дополнительное условие в «мягкой с градацией»: сила продажи, фильтр, возврат резерва.
   Отбор на 17 монетах, экзамен на 14.  Запуск: node app/structure.js <папка со страницами> <куда.json> */
const { chromium } = require('playwright');
const fs = require('fs');
const { inPage, open } = require('./simple.js');
const c = (ind, op, v) => ({ ind, op, v });
const B = { act: 1.5, conds: [c('usdt', '>', 1.07), c('othd', '<', 25)] }, SC = [c('fng', '<', 52), c('usdtd', '<', 7.6)], STc = [...SC, c('fng', '<', 40)];
const ST = { act: -0.3, conds: STc }, WK = { act: -0.075, conds: SC }, RET = { act: 1.25, conds: [c('sma50', '>', 1.1), c('sma200', '>', 1)] };
const tx = (x) => x.map((k) => `${k.ind} ${k.op} ${k.v}`).join(' и ');
const L = [{ tag: 'С ГРАДАЦИЕЙ (эталон)', kind: 'base', S: { base: 1, rules: [B, ST, WK] } }, { tag: 'С ВОЗВРАТОМ по средним', kind: 'ref', S: { base: 1, rules: [B, ST, WK, RET] } }];
// события структуры
const SELLS = [], BUYS = [];
for (const k of [5, 15]) {
  SELLS.push(['выход из восходящей структуры (пробой впадины)', [c('st' + k, '>', 0.5), c('sl' + k, '<', 1)], k]);
  SELLS.push(['выход из восходящей структуры с запасом 3%', [c('st' + k, '>', 0.5), c('sl' + k, '<', 0.97)], k]);
  SELLS.push(['пробой последней впадины (любая структура)', [c('sl' + k, '<', 1)], k]);
  SELLS.push(['пробой последней впадины с запасом 5%', [c('sl' + k, '<', 0.95)], k]);
  SELLS.push(['нисходящая структура', [c('st' + k, '<', -0.5)], k]);
  SELLS.push(['нисходящая структура и новый пробой впадины', [c('st' + k, '<', -0.5), c('sl' + k, '<', 1)], k]);
  SELLS.push(['не восходящая структура', [c('st' + k, '<', 0.5)], k]);
  BUYS.push(['пробой последней вершины', [c('sh' + k, '>', 1)], k]);
  BUYS.push(['пробой вершины с запасом 3%', [c('sh' + k, '>', 1.03)], k]);
  BUYS.push(['восходящая структура', [c('st' + k, '>', 0.5)], k]);
  BUYS.push(['восходящая структура и пробой вершины', [c('st' + k, '>', 0.5), c('sh' + k, '>', 1)], k]);
  BUYS.push(['выход из нисходящей структуры (пробой вершины)', [c('st' + k, '<', -0.5), c('sh' + k, '>', 1)], k]);
  BUYS.push(['не нисходящая структура', [c('st' + k, '>', -0.5)], k]);
}
// 1. только структура
for (const s of SELLS) for (const f of [-0.05, -0.1, -0.25, -0.5]) {
  L.push({ tag: `[${s[2]}д] ${s[0]} → продать ${-f * 100}%`, kind: 'solo', S: { base: 1, rules: [{ act: f, conds: s[1] }] } });
  for (const b of BUYS) for (const a of [1.1, 1.25, 2]) for (const first of [0, 1]) { const rs = [{ act: f, conds: s[1] }, { act: a, conds: b[1] }]; L.push({ tag: `[${s[2]}д] ${s[0]} → продать ${-f * 100}% | [${b[2]}д] ${b[0]} → вернуть ${Math.round((a - 1) * 100)}% резерва${first ? ' (покупка первой)' : ''}`, kind: 'pair', S: { base: 1, rules: first ? rs.reverse() : rs } }); }
}
// 2. добавки к мягкой с градацией
const XS = [];
for (const k of [5, 15]) { for (const v of [-0.5, 0.5]) for (const op of ['<', '>']) XS.push(c('st' + k, op, v)); for (const v of [0.9, 0.95, 1, 1.05, 1.15]) for (const op of ['<', '>']) XS.push(c('sl' + k, op, v)); for (const v of [0.6, 0.75, 0.9, 1]) for (const op of ['<', '>']) XS.push(c('sh' + k, op, v)); }
for (const x of XS) {
  for (const [ss, sw] of [[-0.3, -0.075], [-0.5, -0.075], [-0.3, 0], [-0.15, -0.075]]) L.push({ tag: `сильная продажа ${-ss * 100}% только если ${tx([x])}, иначе ${-sw * 100}%`, kind: 'g:strong', x: tx([x]), S: { base: 1, rules: [B, { act: ss, conds: [...STc, x] }, { act: sw, conds: SC }] } });
  for (const [ws, wo] of [[-0.15, -0.03], [-0.15, 0], [-0.075, 0]]) L.push({ tag: `слабая продажа ${-ws * 100}% если ${tx([x])}, иначе ${-wo * 100}%`, kind: 'g:weak', x: tx([x]), S: { base: 1, rules: [B, ST, { act: ws, conds: [...SC, x] }, { act: wo, conds: SC }] } });
  for (const [bs, bw] of [[2, 1.25], [2, 1], [1.5, 1]]) L.push({ tag: `покупка ${Math.round((bs - 1) * 100)}% резерва если ${tx([x])}, иначе ${Math.round((bw - 1) * 100)}%`, kind: 'g:buy', x: tx([x]), S: { base: 1, rules: [{ act: bs, conds: [...B.conds, x] }, { act: bw, conds: B.conds }, ST, WK] } });
}
for (const b of BUYS) for (const a of [1.1, 1.25, 1.5, 2]) for (const first of [0, 1]) { const r = { act: a, conds: b[1] }; L.push({ tag: `возврат ${Math.round((a - 1) * 100)}% резерва в день: [${b[2]}д] ${b[0]} (${first ? 'до продаж' : 'после продаж'})`, kind: 'g:ret', x: b[0] + ' ' + b[2], S: { base: 1, rules: first ? [B, r, ST, WK] : [B, ST, WK, r] } }); }
for (const s of SELLS) for (const f of [-0.05, -0.1, -0.25]) for (const first of [0, 1]) { const r = { act: f, conds: s[1] }; L.push({ tag: `доп. продажа ${-f * 100}%: [${s[2]}д] ${s[0]} (${first ? 'первой' : 'последней'})`, kind: 'g:sell+', x: s[0] + ' ' + s[2], S: { base: 1, rules: first ? [r, B, ST, WK] : [B, ST, WK, r] } }); }

const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const stat = (full, halves) => ({ n: full.length, pos: full.filter((x) => x > 0).length, worst: Math.min(...full), med: med(full), hpos: halves.filter((x) => x > 0).length, hworst: Math.min(...halves) });
const sh = (s) => `в плюсе ${s.pos}/${s.n}, худшая ${s.worst.toFixed(0)}%, медиана ${s.med.toFixed(0)}%, половины ${s.hpos}, худшая половина ${s.hworst.toFixed(0)}%`;
(async () => {
  const [dir, outPath] = process.argv.slice(2), browser = await chromium.launch(), R = {};
  const P = { own: 'strategy-builder-sol', valid: 'valid', exam: 'exam', memes: 'memes6', metals: 'metals' }, SEL = ['own', 'valid'], EX = ['exam', 'memes'], ALL = [...SEL, ...EX];
  for (const g in P) { const page = await open(browser, `${dir}/${P[g]}.html`, 'str'); R[g] = {}; for (const part of ['full', 'h1', 'h2']) R[g][part] = await page.evaluate(inPage, { seed: 1, unit: 10, evalMany: L.map((x) => x.S), part }); await page.close(); }
  const get = (i, g, part) => g.flatMap((k) => R[k][part][i].e);
  const rows = L.map((x, i) => ({ ...x, i, sel: stat(get(i, SEL, 'full'), [...get(i, SEL, 'h1'), ...get(i, SEL, 'h2')]), ex: stat(get(i, EX, 'full'), [...get(i, EX, 'h1'), ...get(i, EX, 'h2')]), all: stat(get(i, ALL, 'full'), [...get(i, ALL, 'h1'), ...get(i, ALL, 'h2')]), h2: stat(get(i, ALL, 'h2'), get(i, ALL, 'h2')), met: R.metals.full[i].e.map((v) => Math.round(v)) }));
  const base = rows[0];
  console.log('вариантов', rows.length);
  for (const r of rows.slice(0, 2)) console.log(`${r.tag}: отбор ${sh(r.sel)} | экзамен ${sh(r.ex)} | все ${sh(r.all)} | 2-я пол. ${r.h2.med.toFixed(0)}% | металлы ${r.met.join('/')}`);
  const sc = (s) => s.worst + s.hworst / 2 + s.med / 5;
  console.log('\n=== 1. ТОЛЬКО СТРУКТУРА ===');
  const solo = rows.filter((r) => r.kind === 'solo' || r.kind === 'pair');
  console.log(`вариантов ${solo.length}; все 17 монет отбора в плюсе: ${solo.filter((r) => r.sel.pos === 17).length}; из них все 14 экзаменационных в плюсе: ${solo.filter((r) => r.sel.pos === 17 && r.ex.pos === 14).length}`);
  console.log('медиана прибавки по всем вариантам (все 31): ' + med(solo.map((r) => r.all.med)).toFixed(0) + '%, медиана худшей монеты: ' + med(solo.map((r) => r.all.worst)).toFixed(0) + '%');
  for (const r of [...solo].sort((x, y) => sc(y.sel) - sc(x.sel)).slice(0, 6)) console.log(`  ${r.tag}\n     отбор: ${sh(r.sel)}\n     экзамен: ${sh(r.ex)}\n     все 31: ${sh(r.all)} | 2-я пол. ${r.h2.med.toFixed(0)}% | металлы ${r.met.join('/')}`);
  console.log('  без возврата денег (только продажа), лучшие по отбору:');
  for (const r of rows.filter((q) => q.kind === 'solo').sort((x, y) => sc(y.sel) - sc(x.sel)).slice(0, 3)) console.log(`  ${r.tag}: все 31 ${sh(r.all)}`);
  const better = (r, k) => r[k].pos >= base[k].pos && r[k].worst >= base[k].worst && r[k].hworst >= base[k].hworst && r[k].hpos >= base[k].hpos;
  console.log('\n=== 2. ДОБАВКИ К «С ГРАДАЦИЕЙ» ===');
  const out = {};
  for (const [kind, name] of [['g:strong', 'сильная продажа зависит от структуры'], ['g:weak', 'слабая продажа зависит от структуры'], ['g:buy', 'покупка зависит от структуры'], ['g:ret', 'возврат резерва по структуре'], ['g:sell+', 'дополнительная продажа по структуре']]) {
    const pool = rows.filter((r) => r.kind === kind), ok = pool.filter((r) => better(r, 'sel') && r.sel.med > base.sel.med).sort((x, y) => sc(y.sel) - sc(x.sel)), ok2 = ok.filter((r) => better(r, 'ex') && r.ex.med > base.ex.med);
    console.log(`\n[${name}] вариантов ${pool.length}; прошли отбор ${ok.length}; из них экзамен ${ok2.length}; медиана по вариантам на всех 31: ${med(pool.map((r) => r.all.med)).toFixed(0)}% (эталон ${base.all.med.toFixed(0)}%)`);
    for (const r of ok.slice(0, 4)) console.log(`  ${r.tag}\n     отбор: ${sh(r.sel)}\n     экзамен: ${sh(r.ex)} ${ok2.includes(r) ? '✔' : '✘'}\n     все 31: ${sh(r.all)} | 2-я пол. ${r.h2.med.toFixed(0)}% | металлы ${r.met.join('/')}`);
    if (kind === 'g:ret') { console.log('  лучшие по худшей половине на отборе (как правило возврата по средним):'); for (const r of [...pool].sort((x, y) => (y.sel.hworst + y.sel.worst / 2) - (x.sel.hworst + x.sel.worst / 2)).slice(0, 4)) console.log(`  ${r.tag}\n     отбор: ${sh(r.sel)}\n     экзамен: ${sh(r.ex)}\n     все 31: ${sh(r.all)} | 2-я пол. ${r.h2.med.toFixed(0)}% | металлы ${r.met.join('/')}`); }
    out[kind] = ok.slice(0, 20);
  }
  fs.writeFileSync(outPath, JSON.stringify({ base, ref: rows[1], out }));
  await browser.close();
})();
