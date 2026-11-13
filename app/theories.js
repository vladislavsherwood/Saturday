/* Теории «как простая стратегия»: одно правило покупки из резерва + одно правило продажи, пороги по короткой сетке.

   Каждая теория — осмысленная гипотеза (паника в стейблах, страх, альтсезон, жадность …), а не случайный набор условий.
   Отбор идёт на 17 монетах (наши 9 + 8 монет отбора), экзамен — на 14 монетах, которых отбор не видел (8 + 6 мемкоинов).
   Кандидат проходит, только если он не менее устойчив, чем простая стратегия, по трём меркам сразу:
   худшая монета на всей истории, число плюсовых «монето-половин», худшая монето-половина. Среди прошедших — лучшая медиана.

   Запуск: node app/theories.js <наши.html> <отбор.html> <экзамен.html> <мемы.html> <куда.json> */
const { chromium } = require('playwright');
const fs = require('fs');
const { inPage, open } = require('./simple.js');

const c = (ind, op, v) => ({ ind, op, v });
const BUY = [], SELL = [];
const add = (L, theory, conds) => L.push({ theory, conds });
// ---- когда вкладывать резерв ----
for (const a of [1.0, 1.04, 1.07, 1.1, 1.14, 1.21]) {
  add(BUY, 'паника в стейблах', [c('usdt', '>', a)]);
  for (const b of [38, 41.5, 45, 50, 55]) add(BUY, 'паника в стейблах + сильный биткоин', [c('usdt', '>', a), c('btcd', '>', b)]);
  for (const f of [25, 35, 45]) add(BUY, 'паника в стейблах + страх', [c('usdt', '>', a), c('fng', '<', f)]);
  for (const d of [40, 60]) add(BUY, 'паника в стейблах + монета глубоко под максимумом', [c('usdt', '>', a), c('dd', '>', d)]);
  for (const o of [25, 30]) add(BUY, 'паника в стейблах + альты слабые', [c('usdt', '>', a), c('othd', '<', o)]);
}
for (const f of [15, 20, 25, 30]) add(BUY, 'сильный страх', [c('fng', '<', f)]);
for (const u of [5, 6, 7, 8]) add(BUY, 'высокая доля стейблов', [c('usdtd', '>', u)]);
for (const b of [50, 55, 60]) add(BUY, 'сильный биткоин', [c('btcd', '>', b)]);
for (const x of [0.6, 0.75, 0.9]) { add(BUY, 'цена сильно ниже годовой средней', [c('sma200', '<', x)]); add(BUY, 'цена ниже средней + паника в стейблах', [c('sma200', '<', x), c('usdt', '>', 1.0)]); }
for (const d of [50, 65, 80]) add(BUY, 'глубокая просадка', [c('dd', '>', d)]);
for (const r of [-30, -45]) add(BUY, 'обвал за 90 дней', [c('ret90', '<', r)]);
add(BUY, 'без правила покупки', null);
// ---- когда продавать часть ----
for (const f of [40, 46, 52, 58]) for (const u of [5, 6, 6.9, 7.6, 9]) add(SELL, 'страх без паники в стейблах', [c('fng', '<', f), c('usdtd', '<', u)]);
for (const f of [40, 52]) for (const a of [0.95, 1.0, 1.07]) add(SELL, 'страх, стейблы ниже своей средней', [c('fng', '<', f), c('usdt', '<', a)]);
for (const a of [0.9, 1.0, 1.07]) { add(SELL, 'нисходящий тренд без паники', [c('sma200', '<', 1), c('usdt', '<', a)]); add(SELL, 'цена под 50-дневной без паники', [c('sma50', '<', 1), c('usdt', '<', a)]); }
for (const o of [30, 33, 35.5]) add(SELL, 'альтсезон', [c('othd', '>', o)]);
for (const b of [41.5, 45, 48]) add(SELL, 'слабый биткоин', [c('btcd', '<', b)]);
for (const f of [70, 75, 80]) { add(SELL, 'жадность', [c('fng', '>', f)]); add(SELL, 'жадность у максимума', [c('fng', '>', f), c('ath', '>', 80)]); }
for (const a of [0.8, 0.87, 0.94]) add(SELL, 'стейблов мало', [c('usdt', '<', a)]);
for (const u of [3, 4, 5]) add(SELL, 'низкая доля стейблов', [c('usdtd', '<', u)]);
for (const r of [75, 80]) add(SELL, 'перекупленность', [c('rsi', '>', r)]);
for (const r of [100, 200]) add(SELL, 'взлёт за 90 дней', [c('ret90', '>', r)]);
for (const f of [40, 52]) add(SELL, 'страх и цена под годовой средней', [c('fng', '<', f), c('sma200', '<', 1)]);
add(SELL, 'без правила продажи', null);

const CANDS = [];
for (const b of BUY) for (const s of SELL) {
  if (!b.conds && !s.conds) continue;
  for (const ba of b.conds ? [1.5, 2] : [0]) for (const sa of s.conds ? [-0.1, -0.25, 0] : [9]) for (const order of b.conds && s.conds ? [0, 1] : [0]) {
    const rules = [];
    if (b.conds) rules.push({ act: ba, conds: b.conds });
    if (s.conds) rules.push({ act: sa, conds: s.conds });
    if (order) rules.reverse();
    CANDS.push({ S: { base: 1, rules }, theory: b.theory + ' / ' + s.theory });
  }
}
const SIMPLE = { base: 1, rules: [{ act: 2, conds: [c('usdt', '>', 1.07), c('btcd', '>', 41.5)] }, { act: -0.25, conds: [c('fng', '<', 52), c('usdtd', '<', 7.6)] }] };
CANDS.unshift({ S: SIMPLE, theory: 'ПРОСТАЯ (эталон)' });

const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const stat = (full, halves) => ({ n: full.length, pos: full.filter((x) => x > 0).length, worst: Math.min(...full), med: med(full),
  hpos: halves.filter((x) => x > 0).length, hn: halves.length, hworst: Math.min(...halves), hmed: med(halves) });
const txt = (S) => S.rules.map((r) => r.conds.map((k) => `${k.ind} ${k.op} ${k.v}`).join(' и ') + ' → ' + r.act).join(' | ');
const show = (t, s) => `${t}: в плюсе ${s.pos}/${s.n}, худшая ${s.worst.toFixed(0)}%, медиана ${s.med.toFixed(0)}% | половины: в плюсе ${s.hpos}/${s.hn}, худшая ${s.hworst.toFixed(0)}%, медиана ${s.hmed.toFixed(0)}%`;

(async () => {
  const [own, valid, exam, memes, outPath] = process.argv.slice(2);
  const browser = await chromium.launch(), list = CANDS.map((x) => x.S), R = {};
  console.log('кандидатов', CANDS.length, '| правил покупки', BUY.length, '| правил продажи', SELL.length);
  for (const [name, file] of [['own', own], ['valid', valid], ['exam', exam], ['memes', memes]]) {
    const page = await open(browser, file, 'th' + name);
    R[name] = {};
    for (const part of ['full', 'h1', 'h2']) R[name][part] = await page.evaluate(inPage, { seed: 1, unit: 10, evalMany: list, part });
    await page.close();
  }
  const get = (i, groups, part) => groups.flatMap((g) => R[g][part][i].e);
  const rows = CANDS.map((x, i) => {
    const sel = ['own', 'valid'], ex = ['exam', 'memes'];
    return { i, ...x, sel: stat(get(i, sel, 'full'), [...get(i, sel, 'h1'), ...get(i, sel, 'h2')]), ex: stat(get(i, ex, 'full'), [...get(i, ex, 'h1'), ...get(i, ex, 'h2')]),
      selH1: stat(get(i, sel, 'h1'), get(i, sel, 'h1')), allH2: stat(get(i, [...sel, ...ex], 'h2'), get(i, [...sel, ...ex], 'h2')),
      all: stat(get(i, [...sel, ...ex], 'full'), [...get(i, [...sel, ...ex], 'h1'), ...get(i, [...sel, ...ex], 'h2')]) };
  });
  const base = rows[0];
  console.log('\nЭТАЛОН  ' + txt(base.S));
  console.log(show('  отбор (17)', base.sel)); console.log(show('  экзамен (14)', base.ex)); console.log(show('  вторая половина, все 31', base.allH2));
  // не менее устойчивые на монетах отбора
  const okSel = rows.filter((r) => r.i && r.sel.pos === r.sel.n && r.sel.worst >= base.sel.worst && r.sel.hpos >= base.sel.hpos && r.sel.hworst >= base.sel.hworst);
  console.log(`\nне менее устойчивых на отборе: ${okSel.length} из ${rows.length - 1}`);
  const better = okSel.filter((r) => r.sel.med > base.sel.med).sort((x, y) => y.sel.med - x.sel.med);
  console.log(`из них с медианой выше эталона: ${better.length}`);
  const exOk = (r) => r.ex.pos >= base.ex.pos && r.ex.worst >= base.ex.worst && r.ex.hpos >= base.ex.hpos && r.ex.hworst >= base.ex.hworst;
  console.log(`…и на экзамене тоже не менее устойчивы: ${better.filter(exOk).length}; с медианой экзамена выше эталона: ${better.filter((r) => exOk(r) && r.ex.med > base.ex.med).length}`);
  console.log('\nЛУЧШИЕ ПО ОТБОРУ (экзамен не подглядывали):');
  for (const r of better.slice(0, 8)) { console.log(`\n[${r.theory}]  ${txt(r.S)}`); console.log(show('  отбор', r.sel)); console.log(show('  экзамен', r.ex) + (exOk(r) ? '  ✔ устойчивость' : '  ✘ устойчивость')); }
  // проверка во времени: выбор только по первой половине на монетах отбора
  const okT = rows.filter((r) => r.i && r.selH1.pos >= base.selH1.pos && r.selH1.worst >= base.selH1.worst).sort((x, y) => y.selH1.med - x.selH1.med);
  console.log(`\nПРОВЕРКА ВО ВРЕМЕНИ: выбор по первой половине (кандидатов ${okT.length}), результат — вторая половина всех 31 монет`);
  console.log(show('  эталон', base.allH2));
  for (const r of okT.slice(0, 5)) { console.log(`  [${r.theory}]  ${txt(r.S)}`); console.log(show('    первая половина (отбор)', r.selH1)); console.log(show('    вторая половина (все)', r.allH2)); }
  // какие теории вообще работают: доля кандидатов теории, у которых все монеты отбора в плюсе
  const byT = {};
  for (const r of rows.slice(1)) for (const [k, t] of [['b', r.theory.split(' / ')[0]], ['s', r.theory.split(' / ')[1]]]) { const o = (byT[k + t] = byT[k + t] || { k, t, n: 0, ok: 0, med: [] }); o.n++; if (r.sel.pos === r.sel.n) o.ok++; o.med.push(r.sel.med); }
  console.log('\nТЕОРИИ (доля вариантов, где все 17 монет отбора в плюсе; медиана прибавки):');
  for (const o of Object.values(byT).sort((x, y) => y.ok / y.n - x.ok / x.n)) console.log(`  ${o.k === 'b' ? 'покупка' : 'продажа'}: ${o.t} — ${(100 * o.ok / o.n).toFixed(0)}% из ${o.n}, медиана ${med(o.med).toFixed(0)}%`);
  fs.writeFileSync(outPath, JSON.stringify({ base, better: better.slice(0, 50), okT: okT.slice(0, 20), names: Object.fromEntries(Object.keys(R).map((g) => [g, R[g].full[0].names])) }));
  await browser.close();
})();
