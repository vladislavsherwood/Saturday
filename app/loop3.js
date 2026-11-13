/* Цикл 3. Сначала — проверка находки цикла 2 (возврат резерва на импульсе биткоина) на соседних порогах и окнах.
   Затем гипотеза на обновлённой стратегии: важна ДЛИТЕЛЬНОСТЬ — как давно держится сигнал продажи, как давно он был,
   сколько живёт сама монета и насколько она сейчас волатильна.
   Запуск: node app/loop3.js <папка со страницами> */
const { lab, c, med, stable, report } = require('./lab.js');
const B = { act: 1.5, conds: [c('usdt', '>', 1.07), c('othd', '<', 25)] }, SC = [c('fng', '<', 52), c('usdtd', '<', 7.6)], STc = [...SC, c('fng', '<', 40)];
const ST = { act: -0.3, conds: STc }, WK = { act: -0.075, conds: SC }, RB = { act: 1.25, conds: [c('btcr30', '>', 20)] };
const tx = (x) => x.map((k) => `${k.ind} ${k.op} ${k.v}`).join(' и ');
const L = [{ tag: 'С ГРАДАЦИЕЙ (старый эталон)', kind: 'old', S: { base: 1, rules: [B, ST, WK] } }, { tag: 'НОВЫЙ ЭТАЛОН: + возврат 25% резерва, если биткоин за 30 дней вырос больше чем на 20%', kind: 'base', S: { base: 1, rules: [B, ST, WK, RB] } }];
// --- плато находки ---
for (const n of [14, 21, 30, 45, 60]) for (const v of [5, 10, 15, 20, 25, 30, 40]) L.push({ tag: `окно ${n} дн., порог ${v}%`, kind: 'plateau', n, v, S: { base: 1, rules: [B, ST, WK, { act: 1.25, conds: [c('btcr' + n, '>', v)] }] } });
// --- длительность, возраст, волатильность ---
const add = (kind, tag, rules, x) => L.push({ tag, kind, x, S: { base: 1, rules } });
for (const v of [7, 14, 30, 60, 90, 180]) {
  add('a:длительность сигнала продажи', `продавать только первые ${v} дней сигнала`, [B, { act: 1, conds: [...SC, c('selld', '>', v)] }, ST, WK, RB]);
  add('a:длительность сигнала продажи', `продавать только после ${v} дней сигнала подряд`, [B, { act: 1, conds: [...SC, c('selld', '<', v)] }, ST, WK, RB]);
  add('a:длительность сигнала продажи', `сильная продажа только первые ${v} дней, дальше 7,5%`, [B, { act: -0.075, conds: [...STc, c('selld', '>', v)] }, ST, WK, RB]);
  add('a:длительность сигнала продажи', `сильная продажа только после ${v} дней подряд, до этого 7,5%`, [B, { act: -0.075, conds: [...STc, c('selld', '<', v)] }, ST, WK, RB]);
  for (const a of [1.05, 1.1, 1.25]) add('b:возврат по времени', `возврат ${Math.round((a - 1) * 100)}% в день, если сигнала продажи не было ${v} дней`, [B, ST, WK, RB, { act: a, conds: [c('sells', '>', v)] }]);
}
for (const v of [30, 50, 70, 85]) {
  add('c:усталость медвежьего рынка', `не продавать, если сигнал продажи держался больше ${v}% дней за последний год`, [B, { act: 1, conds: [...SC, c('sell365', '>', v)] }, ST, WK, RB]);
  add('c:усталость медвежьего рынка', `не продавать, если сигнал продажи держался больше ${v}% дней за 90 дней`, [B, { act: 1, conds: [...SC, c('sell90', '>', v)] }, ST, WK, RB]);
  for (const a of [1.05, 1.25]) add('c:усталость медвежьего рынка', `возврат ${Math.round((a - 1) * 100)}% в день, если сигнал продажи держался больше ${v}% дней за год`, [B, { act: a, conds: [c('sell365', '>', v)] }, ST, WK, RB]);
  add('c:усталость медвежьего рынка', `продавать только если за год сигнал был меньше ${v}% дней, иначе слабая продажа`, [B, { act: -0.075, conds: [...STc, c('sell365', '>', v)] }, ST, WK, RB]);
}
for (const v of [180, 365, 540, 730, 1095]) {
  add('d:возраст монеты', `не продавать первые ${v} дней истории монеты`, [B, { act: 1, conds: [...SC, c('age', '<', v)] }, ST, WK, RB]);
  add('d:возраст монеты', `первые ${v} дней только слабая продажа`, [B, { act: -0.075, conds: [...STc, c('age', '<', v)] }, ST, WK, RB]);
  add('d:возраст монеты', `возврат по импульсу биткоина только после ${v} дней истории`, [B, ST, WK, { act: 1.25, conds: [...RB.conds, c('age', '>', v)] }]);
}
for (const v of [2, 3, 4, 5, 7]) for (const op of ['<', '>']) {
  add('e:волатильность', `сильная продажа только если волатильность ${op} ${v}%, иначе 7,5%`, [B, { act: -0.3, conds: [...STc, c('vol30', op, v)] }, WK, RB]);
  add('e:волатильность', `не продавать, если волатильность ${op} ${v}%`, [B, { act: 1, conds: [...SC, c('vol30', op, v)] }, ST, WK, RB]);
  add('e:волатильность', `возврат по импульсу биткоина только при волатильности ${op} ${v}%`, [B, ST, WK, { act: 1.25, conds: [...RB.conds, c('vol30', op, v)] }]);
}
(async () => {
  const lb = await lab(process.argv[2]), rows = await lb.run(L), old = rows[0], base = rows[1];
  for (const r of rows.slice(0, 2)) console.log(`${r.tag}\n${report(r)}`);
  console.log('\nПЛАТО НАХОДКИ: медиана на всех 31 / худшая монета / худшая половина (✔ — не хуже старого эталона и на отборе, и на экзамене)');
  console.log('окно\\порог ' + [5, 10, 15, 20, 25, 30, 40].map((v) => String(v + '%').padStart(15)).join(''));
  for (const n of [14, 21, 30, 45, 60]) console.log(String(n).padStart(10) + ' ' + [5, 10, 15, 20, 25, 30, 40].map((v) => { const r = rows.find((q) => q.kind === 'plateau' && q.n === n && q.v === v), ok = stable(r, old, 'sel') && stable(r, old, 'ex') && r.sel.med >= old.sel.med && r.ex.med >= old.ex.med; return `${r.all.med.toFixed(0)}/${r.all.worst.toFixed(0)}/${r.all.hworst.toFixed(0)}${ok ? '✔' : ' '}`.padStart(15); }).join(''));
  const sc = (s) => s.worst + s.hworst + s.med / 5;
  for (const kind of [...new Set(rows.filter((r) => /^[a-e]:/.test(r.kind)).map((r) => r.kind))]) {
    const pool = rows.filter((r) => r.kind === kind), ok = pool.filter((r) => stable(r, base, 'sel') && r.sel.med >= base.sel.med).sort((x, y) => sc(y.sel) - sc(x.sel)), ok2 = ok.filter((r) => stable(r, base, 'ex') && r.ex.med >= base.ex.med);
    console.log(`\n[${kind}] вариантов ${pool.length}; не хуже нового эталона на отборе ${ok.length}; из них и на экзамене ${ok2.length}; медиана по вариантам на всех 31: ${med(pool.map((r) => r.all.med)).toFixed(0)}%, медиана худшей половины ${med(pool.map((r) => r.all.hworst)).toFixed(0)}%`);
    for (const r of ok.slice(0, 4)) console.log(`  ${r.tag} ${ok2.includes(r) ? '✔' : '✘'}\n${report(r)}`);
    if (!ok.length) { const r = [...pool].sort((x, y) => sc(y.sel) - sc(x.sel))[0]; console.log(`  ближайший: ${r.tag}\n${report(r)}`); }
  }
  await lb.close();
})();
