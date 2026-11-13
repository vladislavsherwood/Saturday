/* Маркеры вершин и дна как добавка к текущей стратегии (а не вместо неё).
   Запуск: node app/mcombo.js <папка со страницами> */
const fs = require('fs');
const { lab, c, stable, report } = require('./lab.js');
const CUR = JSON.parse(fs.readFileSync(__dirname + '/found/gentle-impulse.json', 'utf8')), [B, ST, WK, RB] = CUR.rules;
const L = [{ tag: 'ТЕКУЩАЯ', S: CUR }];
for (const tn of ['topn', 'topm']) for (const k of [4, 5]) for (const f of [-0.1, -0.25, -0.5]) for (const hi of [[c('hi90', '>', 0.5)], [c('sma200', '>', 1)]]) {
  if (tn === 'topm' && k > 5) continue;
  const r = { act: f, conds: [...hi, c(tn, '>', k - 0.5)] }, nm = `${hi[0].ind === 'hi90' ? 'на 90-дн. максимуме' : 'выше средней 200'} и ${tn === 'topn' ? 'маркеров' : 'рыночных маркеров'} вершины ≥ ${k} → продать ${-f * 100}%`;
  L.push({ kind: 'продажа у вершины', tag: nm, S: { base: 1, rules: [B, r, ST, WK, RB] } });
  L.push({ kind: 'продажа у вершины + без возврата при маркерах', tag: nm + '; возврат по биткоину только при маркерах < ' + k, S: { base: 1, rules: [B, r, ST, WK, { act: RB.act, conds: [...RB.conds, c(tn, '<', k - 0.5)] }] } });
}
for (const bn of ['botn', 'botm']) for (const k of [3, 4]) for (const a of [1.25, 1.5, 2]) for (const lo of [1, 0]) {
  const r = { act: a, conds: [...(lo ? [c('lo90', '>', 0.5)] : []), c(bn, '>', k - 0.5)] }, nm = `${lo ? 'на 90-дн. минимуме и ' : ''}${bn === 'botn' ? 'маркеров' : 'рыночных маркеров'} дна ≥ ${k} → взнос + ${Math.round((a - 1) * 100)}% резерва`;
  L.push({ kind: 'покупка у дна (первым правилом)', tag: nm, S: { base: 1, rules: [r, B, ST, WK, RB] } });
  L.push({ kind: 'не продавать у дна', tag: `не продавать, если ${lo ? 'на минимуме и ' : ''}${bn === 'botn' ? 'маркеров' : 'рыночных маркеров'} дна ≥ ${k}`, S: { base: 1, rules: [B, { act: 1, conds: [...WK.conds, ...r.conds] }, ST, WK, RB] } });
}
for (const tn of ['topn', 'topm']) for (const k of [0.5, 1.5]) L.push({ kind: 'возврат при отсутствии маркеров вершины', tag: `на 90-дн. максимуме и ${tn === 'topn' ? 'маркеров' : 'рыночных маркеров'} вершины ≤ ${Math.floor(k)} → вернуть весь резерв`, S: { base: 1, rules: [B, ST, WK, RB, { act: 2, conds: [c('hi90', '>', 0.5), c(tn, '<', k)] }] } });
(async () => {
  const lb = await lab(process.argv[2], { rnd: true }), rows = await lb.run(L), base = rows[0];
  console.log('вариантов', rows.length - 1); console.log(base.tag + '\n' + report(base));
  const better = (r) => stable(r, base, 'sel') && r.sel.med >= base.sel.med, exOk = (r) => stable(r, base, 'ex') && r.ex.med >= base.ex.med, rndOk = (r) => r.rnd.pos >= base.rnd.pos && r.rnd.worst >= base.rnd.worst && r.rnd.med >= base.rnd.med;
  for (const kind of [...new Set(rows.slice(1).map((r) => r.kind))]) {
    const pool = rows.filter((r) => r.kind === kind), ok = pool.filter(better);
    console.log(`\n[${kind}] вариантов ${pool.length}; не хуже текущей на отборе ${ok.length}; из них на экзамене ${ok.filter(exOk).length}; из них и на 50 случайных ${ok.filter((r) => exOk(r) && rndOk(r)).length}`);
    const sc = (r) => r.sel.worst + r.sel.hworst + r.sel.med / 5;
    for (const r of (ok.length ? ok : pool).sort((x, y) => sc(y) - sc(x)).slice(0, 3)) console.log(`  ${r.tag} ${better(r) ? (exOk(r) ? (rndOk(r) ? '✔✔✔' : '✔✔') : '✔') : '(ближайший)'}\n${report(r)}`);
  }
  // отдельно: что лучше всего на 50 случайных среди не ухудшающих отбор заметно
  const safe = rows.slice(1).filter((r) => r.sel.pos === 17 && r.ex.pos === 14 && r.sel.med >= 0.9 * base.sel.med).sort((x, y) => (y.rnd.worst + y.rnd.med / 5 + y.rnd.pos) - (x.rnd.worst + x.rnd.med / 5 + x.rnd.pos));
  console.log('\nЛУЧШЕ ВСЕГО НА 50 СЛУЧАЙНЫХ (при всех знакомых монетах в плюсе и медиане отбора не ниже 90% текущей) — подсмотрено, не отбор:');
  for (const r of safe.slice(0, 4)) console.log(`  ${r.tag}\n${report(r)}`);
  await lb.close();
})();
