/* Стратегия «от обратного»: правила собраны из маркеров вершин и дна (markers.py).
   topn — сколько из шести маркеров вершины выполнено, botn — сколько из пяти маркеров дна; hi90 / lo90 — монета за последние 7 дней
   обновила 90-дневный максимум / минимум. Выбор по 17 монетам отбора, экзамен на 14, затем 50 случайных монет.
   Запуск: node app/mstrat.js <папка со страницами> <куда.json> */
const fs = require('fs');
const { lab, c, med, stable, sh, report } = require('./lab.js');
const HERE = __dirname;
const L = [{ tag: 'ТЕКУЩАЯ (с возвратом, слабая продажа 16%)', kind: 'ref', S: JSON.parse(fs.readFileSync(HERE + '/found/gentle-impulse.json', 'utf8')) }, { tag: 'DCA', kind: 'ref', S: { base: 1, rules: [] } }];
const pc = (a) => (a < 0 ? `продать ${+(-a * 100).toFixed(1)}%` : `взнос + ${Math.round((a - 1) * 100)}% резерва`);
for (const tn of ['topn', 'topm']) for (const useHi of [1, 0]) for (const [k1, k2] of [[2, 4], [2, 5], [3, 4], [3, 5], [3, 6], [4, 5], [4, 6], [5, 6]]) for (const f1 of [-0.02, -0.05, -0.1]) for (const f2 of [-0.1, -0.25, -0.5]) {
  if (tn === 'topm' && k2 > 5) continue;
  const hi = useHi ? [c('hi90', '>', 0.5)] : [c('sma200', '>', 1)];
  const sells = [{ act: f2, conds: [...hi, c(tn, '>', k2 - 0.5)] }, { act: f1, conds: [...hi, c(tn, '>', k1 - 0.5)] }];
  const BUYS = [[null, 'без покупки на дне']];
  for (const bn of ['botn', 'botm']) for (const kb of [3, 4]) for (const a of [1.25, 2]) { if (bn === 'botm' && kb > 4) continue; BUYS.push([{ act: a, conds: [c('lo90', '>', 0.5), c(bn, '>', kb - 0.5)] }, `на минимуме и ${bn === 'botn' ? 'маркеров' : 'рыночных маркеров'} дна ≥ ${kb} → ${pc(a)}`], [{ act: a, conds: [c(bn, '>', kb - 0.5)] }, `${bn === 'botn' ? 'маркеров' : 'рыночных маркеров'} дна ≥ ${kb} → ${pc(a)}`]); }
  const RETS = [[null, 'без возврата'], [{ act: 2, conds: [c('hi90', '>', 0.5), c(tn, '<', 1.5)] }, 'на максимуме и маркеров вершины ≤ 1 → вернуть весь резерв'], [{ act: 1.25, conds: [c('hi90', '>', 0.5), c(tn, '<', 1.5)] }, 'на максимуме и маркеров вершины ≤ 1 → вернуть 25%'],
    [{ act: 2, conds: [c(tn, '<', 0.5)] }, 'маркеров вершины 0 → вернуть весь резерв'], [{ act: 2, conds: [c('btcr30', '>', 20)] }, 'биткоин +20% за 30 дней → вернуть весь резерв']];
  for (const [b, bt] of BUYS) for (const [r, rt] of RETS) {
    const rules = [...(b ? [b] : []), ...sells, ...(r ? [r] : [])];
    L.push({ kind: 'm', tag: `${useHi ? 'на 90-дн. максимуме' : 'выше средней 200'}: ${tn === 'topn' ? 'маркеров' : 'рыночных маркеров'} вершины ≥ ${k2} → ${pc(f2)}, ≥ ${k1} → ${pc(f1)} | ${bt} | ${rt}`, S: { base: 1, rules } });
  }
}
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  let rows = [];
  for (let i = 0; i < L.length; i += 3000) { rows = rows.concat(await lb.run(L.slice(i, i + 3000))); console.error('посчитано', rows.length, 'из', L.length); }
  const cur = rows[0], pool = rows.filter((r) => r.kind === 'm');
  console.log('вариантов', pool.length); console.log(cur.tag + '\n' + report(cur));
  const sc = (s) => s.worst + s.hworst + s.med / 5;
  console.log(`\nвсе 17 монет отбора в плюсе: ${pool.filter((r) => r.sel.pos === 17).length}; из них все 14 экзаменационных в плюсе: ${pool.filter((r) => r.sel.pos === 17 && r.ex.pos === 14).length}`);
  console.log(`медиана по всем вариантам: отбор ${med(pool.map((r) => r.sel.med)).toFixed(0)}%, экзамен ${med(pool.map((r) => r.ex.med)).toFixed(0)}%, 50 случайных ${med(pool.map((r) => r.rnd.med)).toFixed(0)}%; худшая монета (медиана по вариантам): ${med(pool.map((r) => r.all.worst)).toFixed(0)}%`);
  const top = [...pool].sort((x, y) => sc(y.sel) - sc(x.sel));
  console.log('\nЛУЧШИЕ ПО ОТБОРУ (экзамен и случайные монеты в выборе не участвовали):');
  for (const r of top.slice(0, 6)) console.log(`  ${r.tag}\n${report(r)}`);
  // связь отбора с экзаменом и случайными
  const corr = (a, b) => { const ma = a.reduce((s, v) => s + v) / a.length, mb = b.reduce((s, v) => s + v) / b.length; let sab = 0, saa = 0, sbb = 0; a.forEach((v, i) => { sab += (v - ma) * (b[i] - mb); saa += (v - ma) ** 2; sbb += (b[i] - mb) ** 2; }); return sab / Math.sqrt(saa * sbb); };
  console.log(`\nкорреляция оценки: отбор–экзамен ${corr(pool.map((r) => sc(r.sel)), pool.map((r) => sc(r.ex))).toFixed(2)}, отбор–случайные ${corr(pool.map((r) => sc(r.sel)), pool.map((r) => sc(r.rnd))).toFixed(2)}`);
  const best = top[0];
  console.log('\nЛУЧШАЯ ПО ОТБОРУ на 50 случайных монетах, по монетам (новая / текущая):');
  console.log(best.rndNames.map((n, i) => [n, best.rndE[i], cur.rndE[i]]).sort((x, y) => x[1] - y[1]).map((x) => `${x[0]} ${x[1].toFixed(0)}/${x[2].toFixed(0)}`).join(', '));
  fs.writeFileSync(process.argv[3], JSON.stringify({ cur: { ...cur, S: undefined }, top: top.slice(0, 40) }));
  await lb.close();
})();
