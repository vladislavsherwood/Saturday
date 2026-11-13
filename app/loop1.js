/* Цикл 1. Гипотеза: минусы появляются, когда резерв простаивает, — значит, стратегия должна знать, какая доля счёта лежит в резерве.
   Запуск: node app/loop1.js <папка со страницами> */
const { lab, c, med, stable, report } = require('./lab.js');
const B = { act: 1.5, conds: [c('usdt', '>', 1.07), c('othd', '<', 25)] }, SC = [c('fng', '<', 52), c('usdtd', '<', 7.6)], STc = [...SC, c('fng', '<', 40)];
const ST = { act: -0.3, conds: STc }, WK = { act: -0.075, conds: SC }, TR = [c('sma50', '>', 1.1), c('sma200', '>', 1)];
const L = [{ tag: 'С ГРАДАЦИЕЙ (эталон)', kind: 'base', S: { base: 1, rules: [B, ST, WK] } }, { tag: 'с возвратом по тренду (для сравнения)', kind: 'ref', S: { base: 1, rules: [B, ST, WK, { act: 1.25, conds: TR }] } }];
for (const x of [20, 30, 40, 50, 60, 70, 80, 90]) {
  const lo = c('cashp', '<', x), hi = c('cashp', '>', x);
  L.push({ tag: `продавать, только пока резерв < ${x}% счёта`, kind: 'a:потолок резерва', S: { base: 1, rules: [B, { act: -0.3, conds: [...STc, lo] }, { act: -0.075, conds: [...SC, lo] }] } });
  L.push({ tag: `слабая продажа — только пока резерв < ${x}%`, kind: 'a:потолок резерва', S: { base: 1, rules: [B, ST, { act: -0.075, conds: [...SC, lo] }] } });
  L.push({ tag: `сильная продажа 30% пока резерв < ${x}%, дальше 7,5%`, kind: 'a:потолок резерва', S: { base: 1, rules: [B, { act: -0.3, conds: [...STc, lo] }, WK] } });
  for (const a of [1.02, 1.05, 1.1, 1.25]) {
    L.push({ tag: `капельный возврат ${Math.round((a - 1) * 100)}% резерва в день без сигналов, если резерв > ${x}%`, kind: 'b:капельный возврат', S: { base: 1, rules: [B, ST, WK, { act: a, conds: [hi] }] } });
    L.push({ tag: `возврат ${Math.round((a - 1) * 100)}% в день по тренду, если резерв > ${x}%`, kind: 'c:возврат по тренду и резерву', S: { base: 1, rules: [B, ST, WK, { act: a, conds: [...TR, hi] }] } });
    L.push({ tag: `возврат ${Math.round((a - 1) * 100)}% в день, если цена выше SMA200 и резерв > ${x}%`, kind: 'c:возврат по тренду и резерву', S: { base: 1, rules: [B, ST, WK, { act: a, conds: [c('sma200', '>', 1), hi] }] } });
    L.push({ tag: `возврат ${Math.round((a - 1) * 100)}% в день, если страх/жадность > 52 и резерв > ${x}%`, kind: 'd:возврат вне страха', S: { base: 1, rules: [B, ST, WK, { act: a, conds: [c('fng', '>', 52), hi] }] } });
  }
  for (const [bs, bw] of [[2, 1.5], [2, 1.25], [1.5, 1.1]]) L.push({ tag: `покупка: ${Math.round((bs - 1) * 100)}% резерва, если резерв > ${x}%, иначе ${Math.round((bw - 1) * 100)}%`, kind: 'e:размер покупки от резерва', S: { base: 1, rules: [{ act: bs, conds: [...B.conds, hi] }, { act: bw, conds: B.conds }, ST, WK] } });
}
(async () => {
  const lb = await lab(process.argv[2]), rows = await lb.run(L), base = rows[0];
  console.log('вариантов', rows.length - 2); for (const r of rows.slice(0, 2)) console.log(`${r.tag}\n${report(r)}`);
  const kinds = [...new Set(rows.slice(2).map((r) => r.kind))];
  const sc = (s) => s.worst + s.hworst + s.med / 5;
  for (const kind of kinds) {
    const pool = rows.filter((r) => r.kind === kind), ok = pool.filter((r) => stable(r, base, 'sel') && r.sel.med >= base.sel.med).sort((x, y) => sc(y.sel) - sc(x.sel)), ok2 = ok.filter((r) => stable(r, base, 'ex') && r.ex.med >= base.ex.med);
    console.log(`\n[${kind}] вариантов ${pool.length}; не хуже эталона на отборе ${ok.length}; из них и на экзамене ${ok2.length}; медиана по вариантам на всех 31: ${med(pool.map((r) => r.all.med)).toFixed(0)}%, медиана худшей половины ${med(pool.map((r) => r.all.hworst)).toFixed(0)}%`);
    for (const r of ok.slice(0, 3)) console.log(`  ${r.tag} ${ok2.includes(r) ? '✔' : '✘'}\n${report(r)}`);
    if (!ok.length) { const r = [...pool].sort((x, y) => sc(y.sel) - sc(x.sel))[0]; console.log(`  ближайший: ${r.tag}\n${report(r)}`); }
  }
  // мягкий критерий: худшая половина заметно лучше при медиане не ниже 90% эталона — на отборе и на экзамене
  const soft = rows.slice(2).filter((r) => r.sel.pos === 17 && r.ex.pos === 14 && r.sel.hworst > base.sel.hworst + 5 && r.ex.hworst > base.ex.hworst + 5 && r.sel.med >= 0.9 * base.sel.med && r.ex.med >= 0.9 * base.ex.med && r.sel.worst >= base.sel.worst - 5 && r.ex.worst >= base.ex.worst - 5).sort((x, y) => (y.all.hworst + y.all.med / 10) - (x.all.hworst + x.all.med / 10));
  console.log(`\nМЯГКИЙ КРИТЕРИЙ (провалы мельче минимум на 5 п.п. на обеих группах, прибыль не ниже 90%, худшая монета не хуже чем на 5 п.п.): ${soft.length}`);
  for (const r of soft.slice(0, 6)) console.log(`  ${r.tag}\n${report(r)}`);
  await lb.close();
})();
