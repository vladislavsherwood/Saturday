/* Маркер «тихой вершины» (биткоин у максимума, доля альткоинов растёт) в сочетании с каждой из наших стратегий.
   К каждой стратегии добавляется правило продажи по маркеру в разных вариантах; засчитывается только то,
   что не хуже своей исходной стратегии по устойчивости и лучше по прибыли на отборе, экзамене и 50 случайных монетах.
   Запуск: node app/qtmix.js <папка со страницами> <куда.json> */
const fs = require('fs');
const { lab, c, stable, report } = require('./lab.js');
const HERE = __dirname;
const BASES = [['простая', 'simple'], ['мягкая', 'gentle'], ['с градацией', 'gentle-graded'], ['с возвратом (стабильная)', 'gentle-impulse'], ['с маркером вершины', 'markers-top'], ['объединённая', 'merged']];
const L = [];
for (const [name, file] of BASES) {
  const S = JSON.parse(fs.readFileSync(`${HERE}/found/${file}.json`, 'utf8')), rules = S.rules;
  L.push({ base: name, kind: 'base', tag: name, S: { base: 1, rules } });
  for (const [cn, cond] of [['маркер', [c('qt', '>', 0.5)]], ['маркер и монета на 90-дн. максимуме', [c('qt', '>', 0.5), c('hi90', '>', 0.5)]], ['маркер и цена выше средней 200', [c('qt', '>', 0.5), c('sma200', '>', 1)]]])
    for (const f of [0.02, 0.05, 0.1, 0.25, 0.5, 1]) for (const first of [1, 0]) {
      const r = { act: -f, conds: cond };
      L.push({ base: name, kind: 'sell', f, cn, first, tag: `${cn} → продать ${f * 100}% (${first ? 'первым правилом' : 'последним правилом'})`, S: { base: 1, rules: first ? [r, ...rules] : [...rules, r] } });
    }
  // маркер как запрет: пока он горит, резерв не возвращается и не докупается (все покупки сверх взноса превращаются в обычный взнос)
  L.push({ base: name, kind: 'block', tag: 'маркер → только обычный взнос, без докупок из резерва (первым правилом)', S: { base: 1, rules: [{ act: 1, conds: [c('qt', '>', 0.5)] }, ...rules] } });
  L.push({ base: name, kind: 'block', tag: 'маркер → пропуск взноса (первым правилом)', S: { base: 1, rules: [{ act: 0, conds: [c('qt', '>', 0.5)] }, ...rules] } });
}
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  let rows = [];
  for (let i = 0; i < L.length; i += 60) { rows = rows.concat(await lb.run(L.slice(i, i + 60))); console.error('посчитано', rows.length, 'из', L.length); }
  await lb.close();
  const out = [];
  for (const [name] of BASES) {
    const base = rows.find((r) => r.base === name && r.kind === 'base'), pool = rows.filter((r) => r.base === name && r.kind !== 'base');
    const okS = (r) => stable(r, base, 'sel') && r.sel.med > base.sel.med, okE = (r) => stable(r, base, 'ex') && r.ex.med > base.ex.med, okR = (r) => r.rnd.pos >= base.rnd.pos && r.rnd.worst >= base.rnd.worst - 0.5 && r.rnd.med > base.rnd.med;
    const a = pool.filter(okS), b = a.filter(okE), d = b.filter(okR);
    console.log(`\n=== ${name.toUpperCase()} ===\n${report(base)}`);
    console.log(`вариантов ${pool.length}; лучше исходной на отборе ${a.length}; из них на экзамене ${b.length}; из них и на 50 случайных ${d.length}`);
    const sc = (r) => r.sel.worst + r.sel.hworst + r.sel.med / 5;
    const show = (d.length ? d : b.length ? b : a.length ? a : pool).sort((x, y) => sc(y) - sc(x)).slice(0, 3);
    for (const r of show) console.log(`  ${r.tag} ${okS(r) ? (okE(r) ? (okR(r) ? '✔✔✔' : '✔✔') : '✔') : '(ближайший, не прошёл)'}\n${report(r)}`);
    // по размеру продажи: сколько вариантов прошло все три проверки
    console.log('  прошли все три проверки по размеру продажи: ' + [0.02, 0.05, 0.1, 0.25, 0.5, 1].map((f) => `${f * 100}%: ${d.filter((r) => r.f === f).length}`).join(', ') + `; запреты: ${d.filter((r) => r.kind === 'block').length}`);
    out.push({ name, base: { sel: base.sel, ex: base.ex, rnd: base.rnd, all: base.all }, passed: d.map((r) => ({ tag: r.tag, S: r.S, sel: r.sel, ex: r.ex, rnd: r.rnd, all: r.all, neg: r.neg })), best: show.map((r) => ({ tag: r.tag, S: r.S, sel: r.sel, ex: r.ex, rnd: r.rnd, all: r.all })) });
  }
  fs.writeFileSync(process.argv[3], JSON.stringify(out));
})();
