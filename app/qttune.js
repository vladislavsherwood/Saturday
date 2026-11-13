/* Докрутка: стабильная стратегия + продажа по маркеру тихой вершины дала большую прибавку, но углубила провалы.
   Задача — сохранить прибавку и убрать провалы. Перебираются:
   - условие самой продажи (маркер один, маркер с уточнением про монету, рынок, длительность сигнала, размер резерва);
   - размер продажи и место правила;
   - как возвращать деньги после неё (возврат по биткоину только после того, как маркер погас; покупка у дна; возврат на новом максимуме).
   Выбор по 17 монетам отбора, экзамен на 14, лучшие — на 50 случайных.
   Запуск: node app/qttune.js <папка со страницами> <куда.json> */
const fs = require('fs');
const { lab, c, stable, report } = require('./lab.js');
const HERE = __dirname;
const A = JSON.parse(fs.readFileSync(HERE + '/found/gentle-impulse.json', 'utf8')), M = JSON.parse(fs.readFileSync(HERE + '/found/merged.json', 'utf8'));
const [B, ST, WK, RB] = A.rules, QT = c('qt', '>', 0.5);
const QC = [['маркер', [QT]], ['маркер и монета на 90-дн. максимуме', [QT, c('hi90', '>', 0.5)]], ['маркер и цена выше средней 200', [QT, c('sma200', '>', 1)]],
  ['маркер и монета сильнее биткоина', [QT, c('pair', '>', 1)]], ['маркер и монета слабее биткоина', [QT, c('pair', '<', 1)]], ['маркер и MVRV биткоина выше 2', [QT, c('mvrv', '>', 2)]],
  ['маркер и 2+ маркера вершины', [QT, c('topm', '>', 1.5)]], ['маркер и USDT.D ниже своей средней на 10%', [QT, c('usdt', '<', 0.9)]],
  ['маркер, пока резерв меньше половины счёта', [QT, c('cashp', '<', 50)]], ['маркер, пока резерв меньше 75% счёта', [QT, c('cashp', '<', 75)]],
  ['маркер, первые 30 дней сигнала', [QT, c('qtd', '<', 30.5)]], ['маркер, первые 60 дней сигнала', [QT, c('qtd', '<', 60.5)]], ['маркер, после 14 дней сигнала', [QT, c('qtd', '>', 14.5)]],
  ['маркер и цена выше средней 50', [QT, c('sma50', '>', 1)]], ['маркер и рост монеты за 90 дней больше 50%', [QT, c('ret90', '>', 50)]]];
const BOT = { act: 1.5, conds: [c('botm', '>', 3.5)] };
const RET = [['возврат как был', (q) => ({ pre: [], ret: [RB] })], ['возврат по биткоину только когда маркер погас', () => ({ pre: [], ret: [{ act: 2, conds: [...RB.conds, c('qt', '<', 0.5)] }] })],
  ['+ покупка у дна (4 маркера)', () => ({ pre: [BOT], ret: [RB] })], ['+ покупка у дна, возврат только когда маркер погас', () => ({ pre: [BOT], ret: [{ act: 2, conds: [...RB.conds, c('qt', '<', 0.5)] }] })],
  ['+ возврат на 90-дн. максимуме через 30+ дней после маркера', () => ({ pre: [], ret: [RB, { act: 2, conds: [c('hi90', '>', 0.5), c('qtoff', '>', 30), c('topm', '<', 3.5)] }] })],
  ['+ покупка у дна и возврат на максимуме после маркера', () => ({ pre: [BOT], ret: [RB, { act: 2, conds: [c('hi90', '>', 0.5), c('qtoff', '>', 30), c('topm', '<', 3.5)] }] })]];
const L = [{ kind: 'ref', tag: 'СТАБИЛЬНАЯ', S: A }, { kind: 'ref', tag: 'ОБЪЕДИНЁННАЯ', S: { base: 1, rules: M.rules } }, { kind: 'ref', tag: 'СТАБИЛЬНАЯ + маркер → 10% (прошлый шаг)', S: { base: 1, rules: [B, ST, WK, RB, { act: -0.1, conds: [QT] }] } }];
for (const [qn, qc] of QC) for (const f of [0.03, 0.05, 0.1, 0.15, 0.25]) for (const pos of ['last', 'mid']) for (const [rn, rf] of RET) {
  const { pre, ret } = rf(), q = { act: -f, conds: qc };
  const rules = pos === 'last' ? [...pre, B, ST, WK, ...ret, q] : [...pre, B, q, ST, WK, ...ret];
  L.push({ kind: 'm', parts: [qn, f, pos, rn], tag: `${qn} → продать ${f * 100}% (${pos === 'last' ? 'последним' : 'перед продажами на страхе'}) | ${rn}`, S: { base: 1, rules } });
}
(async () => {
  let lb = await lab(process.argv[2]), rows = [];
  for (let i = 0; i < L.length; i += 300) { rows = rows.concat(await lb.run(L.slice(i, i + 300))); console.error('посчитано', rows.length, 'из', L.length); }
  await lb.close();
  const [a, m, prev] = rows, pool = rows.filter((r) => r.kind === 'm');
  console.log('вариантов', pool.length); for (const r of [a, m, prev]) console.log(r.tag + '\n' + report(r));
  const sc = (s) => s.worst + s.hworst + s.med / 5;
  // не хуже стабильной по устойчивости и прибыльнее, чем «стабильная + маркер 10%» хотя бы на 90% её медианы
  const okS = (r) => stable(r, a, 'sel') && r.sel.med > a.sel.med, okE = (r) => stable(r, a, 'ex') && r.ex.med > a.ex.med;
  const pass = pool.filter((r) => okS(r) && okE(r)).sort((x, y) => (y.sel.med + y.ex.med) - (x.sel.med + x.ex.med));
  console.log(`\nне хуже стабильной по устойчивости и прибыльнее её: на отборе ${pool.filter(okS).length}; и на экзамене ${pass.length}`);
  for (const [i, name] of [[0, 'условие продажи'], [1, 'размер'], [2, 'место'], [3, 'возврат']]) {
    const cnt = {}; for (const r of pool) { const k = String(r.parts[i]); const o = (cnt[k] = cnt[k] || [0, 0]); o[0]++; if (pass.includes(r)) o[1]++; }
    console.log(`  ${name}: ` + Object.entries(cnt).sort((x, y) => y[1][1] - x[1][1]).map(([k, v]) => `«${k}» ${v[1]} из ${v[0]}`).join(' ; '));
  }
  // лучше объединённой?
  const beatM = pass.filter((r) => stable(r, m, 'sel') && stable(r, m, 'ex') && r.sel.med > m.sel.med && r.ex.med > m.ex.med);
  console.log(`из них лучше и объединённой (по устойчивости не хуже, по прибыли выше на отборе и экзамене): ${beatM.length}`);
  const cand = [...new Map([...beatM.slice(0, 6), ...pass.slice(0, 8)].map((r) => [r.tag, r])).values()].slice(0, 12);
  lb = await lab(process.argv[2], { rnd: true });
  const rr = await lb.run([{ tag: a.tag, S: A }, { tag: m.tag, S: { base: 1, rules: M.rules } }, { tag: prev.tag, S: prev.S }, ...cand.map((r) => ({ tag: r.tag, S: r.S }))]); await lb.close();
  console.log('\nЛУЧШИЕ ПО ПРИБЫЛИ ИЗ ПРОШЕДШИХ — с 50 случайными монетами:');
  for (const r of rr) console.log(`  ${r.tag}\n${report(r)}`);
  fs.writeFileSync(process.argv[3], JSON.stringify({ rows: rr.map((r) => ({ tag: r.tag, S: r.S, sel: r.sel, ex: r.ex, all: r.all, rnd: r.rnd, h2: r.h2, neg: r.neg })) }));
})();
