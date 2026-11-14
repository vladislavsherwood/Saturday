/* Приоритеты правил «Тихая вершина + ликвидации»: все 40 320 порядков 8 правил, сведённые к реально разным
   (порядок важен только в дни, когда срабатывают сразу несколько правил), и выключение каждого правила.
   Запуск: node app/liq_order.js <папка> */
const fs = require('fs');
const { lab, stable, report } = require('./lab.js');
const { injLiq } = require('./liq_inject.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const Q = JSON.parse(fs.readFileSync(__dirname + '/found/quiet-liq.json', 'utf8'));
const NAMES = ['капитуляция', 'ликвидации OI', 'паника стейблов', 'страх: продать 30%', 'страх: продать 16%', 'разворот BTC', 'фандинг: продать 5%', 'тихая вершина'];
const masks = (rules) => { const set = {}; for (const k of SETS.avg) { setup(k, true); for (let i = 0; i < N; i++) { let m = 0;
  rules.forEach((r, b) => { if (r.conds.every((cd) => { const v = IND[cd.ind] ? IND[cd.ind].v[i] : NaN; return cd.op === '<' ? v < cd.v : v > cd.v; })) m |= 1 << b; });
  if (m & (m - 1)) set[m] = (set[m] || 0) + 1; } } return set; };
const perms = (a) => (a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  for (const g in lb.pages) await lb.pages[g].evaluate(injLiq, LIQ);
  const M = {}; for (const g in lb.pages) for (const [m, n] of Object.entries(await lb.pages[g].evaluate(masks, Q.rules))) M[m] = (M[m] || 0) + n;
  const ms = Object.keys(M).map(Number).sort((a, b) => M[b] - M[a]);
  console.log(`дней, когда срабатывает больше одного правила: ${Object.values(M).reduce((a, b) => a + b, 0)}; сочетаний: ${ms.length}`);
  for (const m of ms.slice(0, 15)) console.log(`  ${NAMES.filter((n, b) => m & (1 << b)).join(' + ')}: ${M[m]} дн`);
  const uniq = new Map();
  for (const p of perms([0, 1, 2, 3, 4, 5, 6, 7])) { const sig = ms.map((m) => p.find((b) => m & (1 << b))).join(','); if (!uniq.has(sig)) uniq.set(sig, p); }
  const cur = [0, 1, 2, 3, 4, 5, 6, 7], curSig = ms.map((m) => cur.find((b) => m & (1 << b))).join(',');
  uniq.delete(curSig);
  console.log(`реально разных порядков: ${uniq.size + 1}`);
  const L = [{ tag: 'ТЕКУЩИЙ ПОРЯДОК', p: cur, S: Q }];
  for (const p of uniq.values()) L.push({ tag: p.map((b) => NAMES[b]).join(' › '), p, S: { base: 1, rules: p.map((b) => Q.rules[b]) } });
  for (let b = 0; b < 8; b++) L.push({ tag: `БЕЗ ПРАВИЛА: ${NAMES[b]}`, abl: 1, S: { base: 1, rules: Q.rules.filter((r, i) => i !== b) } });
  const rows = [];
  for (let i = 0; i < L.length; i += 150) { rows.push(...(await lb.run(L.slice(i, i + 150)))); console.error(`посчитано ${rows.length}/${L.length}`); }
  await lb.close();
  const base = rows[0];
  const ok = (r) => [stable(r, base, 'sel') && r.sel.med >= base.sel.med, stable(r, base, 'ex') && r.ex.med >= base.ex.med, r.rnd.pos >= base.rnd.pos && r.rnd.hpos >= base.rnd.hpos && r.rnd.med >= base.rnd.med];
  const line = (r) => `${r.sel.med.toFixed(0).padStart(5)}/${r.sel.hworst.toFixed(0).padStart(4)}/${r.sel.hpos} | ${r.ex.med.toFixed(0).padStart(4)}/${r.ex.hworst.toFixed(0).padStart(4)}/${r.ex.hpos} | ${r.rnd.med.toFixed(0).padStart(4)}/${r.rnd.pos}/${r.rnd.hpos} ${ok(r).map((x) => (x ? '✔' : '·')).join('')}  ${r.tag}`;
  console.log('\nотбор медиана/худш.пол./половин+ | экзамен то же | 50 случ. медиана/в плюсе/половин+');
  console.log(line(base));
  console.log('\n--- вклад каждого правила (если его убрать) ---'); rows.filter((r) => r.abl).forEach((r) => console.log(line(r)));
  const ord = rows.filter((r) => !r.abl && r !== base);
  const sc = (r) => Math.log1p(r.sel.med / 100) + Math.log1p(r.ex.med / 100) + 2 * Math.log1p(r.rnd.med / 100) + (r.sel.hworst + r.ex.hworst) / 100 + (r.sel.hpos + r.ex.hpos + r.rnd.hpos) / 50;
  console.log(`\n--- порядки: лучше текущего по всем трём выборкам ${ord.filter((r) => ok(r).every(Boolean)).length} из ${ord.length}; лучшие 20 по общей оценке ---`);
  [...ord].sort((a, b) => sc(b) - sc(a)).slice(0, 20).forEach((r) => console.log(line(r)));
  console.log('\n--- лучшие 10 из прошедших все три проверки ---');
  ord.filter((r) => ok(r).every(Boolean)).sort((a, b) => sc(b) - sc(a)).slice(0, 10).forEach((r) => console.log(line(r)));
  // какие пары «кто раньше» важны: средняя оценка при A раньше B против B раньше A
  console.log('\n--- что важно в порядке (средняя оценка, когда первое правило стоит раньше второго, против наоборот) ---');
  const res = [];
  for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) { const x = ord.filter((r) => r.p.indexOf(a) < r.p.indexOf(b)).map(sc), y = ord.filter((r) => r.p.indexOf(a) > r.p.indexOf(b)).map(sc);
    if (x.length && y.length) res.push([NAMES[a], NAMES[b], x.reduce((s, v) => s + v, 0) / x.length - y.reduce((s, v) => s + v, 0) / y.length]); }
  res.sort((p, q) => Math.abs(q[2]) - Math.abs(p[2])).slice(0, 10).forEach(([a, b, d]) => console.log(`  ${d > 0 ? a + ' раньше, чем ' + b : b + ' раньше, чем ' + a}: +${Math.abs(d).toFixed(3)}`));
  fs.writeFileSync(process.argv[2] + '/order.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, p: r.p, ok: ok(r), sc: sc(r), sel: r.sel, ex: r.ex, rnd: r.rnd }))));
})();
