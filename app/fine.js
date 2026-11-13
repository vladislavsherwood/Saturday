/* Размеры всех четырёх действий с шагом 0,5%: покупка из резерва, сильная продажа, слабая продажа, возврат резерва.
   Сначала каждая ручка отдельно по всему диапазону, потом две пары вместе (сильная × слабая продажа, покупка × возврат).
   Запуск: node app/fine.js <папка со страницами> <куда.json> */
const fs = require('fs');
const { lab, c, med, stable, sh, report } = require('./lab.js');
const mk = (b, ss, sw, r) => ({ base: 1, rules: [{ act: 1 + b / 100, conds: [c('usdt', '>', 1.07), c('othd', '<', 25)] }, { act: -ss / 100, conds: [c('fng', '<', 40), c('usdtd', '<', 7.6)] }, { act: -sw / 100, conds: [c('fng', '<', 52), c('usdtd', '<', 7.6)] }, { act: 1 + r / 100, conds: [c('btcr30', '>', 20)] }] });
const CUR = { b: 50, ss: 30, sw: 7.5, r: 25 }, rng = (a, b, st = 0.5) => { const o = []; for (let x = a; x <= b + 1e-9; x += st) o.push(+x.toFixed(1)); return o; };
const L = [{ ...CUR, kind: 'base', S: mk(50, 30, 7.5, 25) }];
const R1 = { b: rng(0, 100), ss: rng(0, 100), sw: rng(0, 30), r: rng(0, 100) };
for (const k in R1) for (const v of R1[k]) { const p = { ...CUR, [k]: v }; L.push({ ...p, kind: '1d:' + k, S: mk(p.b, p.ss, p.sw, p.r) }); }
for (const ss of rng(10, 60)) for (const sw of rng(0, 20)) L.push({ ...CUR, ss, sw, kind: '2d:sell', S: mk(50, ss, sw, 25) });
for (const b of rng(0, 100, 1)) for (const r of rng(0, 100, 1)) L.push({ ...CUR, b, r, kind: '2d:buy', S: mk(b, 30, 7.5, r) });
(async () => {
  const lb = await lab(process.argv[2]); let rows = [];
  for (let i = 0; i < L.length; i += 4000) { rows = rows.concat((await lb.run(L.slice(i, i + 4000))).map((r) => ({ ...r, S: undefined }))); console.error('посчитано', rows.length, 'из', L.length); }
  const base = rows[0], sc = (s) => s.worst + s.hworst + s.med / 5;
  console.log('вариантов', rows.length - 1); console.log('ТЕКУЩАЯ (покупка 50, сильная 30, слабая 7,5, возврат 25)\n' + report(base));
  const names = { b: 'ПОКУПКА, % резерва', ss: 'СИЛЬНАЯ ПРОДАЖА, % позиции', sw: 'СЛАБАЯ ПРОДАЖА, % позиции', r: 'ВОЗВРАТ, % резерва в день' };
  const out = {};
  for (const k in R1) {
    const pool = rows.filter((r) => r.kind === '1d:' + k);
    console.log(`\n=== ${names[k]} (остальное как сейчас), шаг 0,5% — ${pool.length} значений ===`);
    console.log('значение: медиана всех 31 / худшая монета / худшая половина / половин в плюсе | оценка на отборе');
    const show = k === 'sw' ? (v) => v % 2.5 === 0 : (v) => v % 10 === 0;
    console.log(pool.filter((r) => show(r[k])).map((r) => `${String(r[k]).padStart(5)}: ${r.all.med.toFixed(0).padStart(4)} / ${r.all.worst.toFixed(0).padStart(3)} / ${r.all.hworst.toFixed(0).padStart(4)} / ${r.all.hpos} | ${sc(r.sel).toFixed(0)}`).join('\n'));
    const ok = pool.filter((r) => stable(r, base, 'sel') && r.sel.med >= base.sel.med), ok2 = ok.filter((r) => stable(r, base, 'ex') && r.ex.med >= base.ex.med);
    const span = (a) => (a.length ? `${Math.min(...a.map((r) => r[k]))}…${Math.max(...a.map((r) => r[k]))} (${a.length} значений)` : 'нет');
    const best = [...pool].sort((x, y) => sc(y.sel) - sc(x.sel))[0];
    // шум соседних шагов: насколько в среднем отличается медиана у двух соседних значений
    const noise = med(pool.slice(1).map((r, i) => Math.abs(r.all.med - pool[i].all.med)));
    console.log(`не хуже текущей на отборе: ${span(ok)}; и на экзамене тоже: ${span(ok2)}`);
    console.log(`лучшее по отбору: ${best[k]} → все 31: ${sh(best.all)}; экзамен: ${sh(best.ex)}`);
    console.log(`типичная разница медианы между соседними шагами по 0,5%: ${noise.toFixed(1)} п.п.`);
    out[k] = pool.map((r) => [r[k], +r.all.med.toFixed(1), +r.all.worst.toFixed(1), +r.all.hworst.toFixed(1), r.all.hpos, +sc(r.sel).toFixed(1), +sc(r.ex).toFixed(1)]);
  }
  for (const [kind, a, b, title] of [['2d:sell', 'ss', 'sw', 'СИЛЬНАЯ × СЛАБАЯ ПРОДАЖА'], ['2d:buy', 'b', 'r', 'ПОКУПКА × ВОЗВРАТ']]) {
    const pool = rows.filter((r) => r.kind === kind), ok = pool.filter((r) => stable(r, base, 'sel') && r.sel.med >= base.sel.med), ok2 = ok.filter((r) => stable(r, base, 'ex') && r.ex.med >= base.ex.med);
    console.log(`\n=== ${title}: ${pool.length} сочетаний; не хуже текущей на отборе ${ok.length}; из них и на экзамене ${ok2.length} ===`);
    const top = [...pool].sort((x, y) => sc(y.sel) - sc(x.sel));
    console.log('лучшие по отбору:'); for (const r of top.slice(0, 5)) console.log(`  ${names[a].split(',')[0].toLowerCase()} ${r[a]}, ${names[b].split(',')[0].toLowerCase()} ${r[b]}: отбор ${sh(r.sel)} | экзамен ${sh(r.ex)} | все ${sh(r.all)}`);
    if (ok2.length) { const box = (k) => `${Math.min(...ok2.map((r) => r[k]))}…${Math.max(...ok2.map((r) => r[k]))}`; console.log(`область, прошедшая и отбор, и экзамен: ${names[a].split(',')[0].toLowerCase()} ${box(a)}, ${names[b].split(',')[0].toLowerCase()} ${box(b)}; медиана на всех 31 в ней: ${Math.min(...ok2.map((r) => r.all.med)).toFixed(0)}…${Math.max(...ok2.map((r) => r.all.med)).toFixed(0)}%, худшая половина ${Math.min(...ok2.map((r) => r.all.hworst)).toFixed(0)}…${Math.max(...ok2.map((r) => r.all.hworst)).toFixed(0)}%`);
      const ctr = [...ok2].sort((x, y) => sc(y.sel) + sc(y.ex) - sc(x.sel) - sc(x.ex))[0]; console.log(`  середина по оценке: ${r2(ctr, a, b)}`); }
    // корреляция отбор-экзамен
    const x = pool.map((r) => sc(r.sel)), y = pool.map((r) => sc(r.ex)), mx = x.reduce((s, v) => s + v) / x.length, my = y.reduce((s, v) => s + v) / y.length; let sxy = 0, sxx = 0, syy = 0; x.forEach((v, i) => { sxy += (v - mx) * (y[i] - my); sxx += (v - mx) ** 2; syy += (y[i] - my) ** 2; });
    console.log('корреляция оценки на отборе и на экзамене: ' + (sxy / Math.sqrt(sxx * syy)).toFixed(2));
    out[kind] = pool.map((r) => [r[a], r[b], +r.all.med.toFixed(0), +r.all.worst.toFixed(0), +r.all.hworst.toFixed(0), +sc(r.sel).toFixed(0), +sc(r.ex).toFixed(0)]);
  }
  function r2(r, a, b) { return `${a}=${r[a]}, ${b}=${r[b]}: все 31 ${sh(r.all)}`; }
  fs.writeFileSync(process.argv[3], JSON.stringify(out));
  await lb.close();
})();
