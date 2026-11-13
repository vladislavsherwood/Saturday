/* Тонкая подстройка ВСЕХ чисел стратегии: четыре размера и шесть порогов, шаг 0,5% (у индекса страха — 1 пункт, у USDT.D — 0,1 п.п.).
   Покоординатный спуск: по очереди перебирается каждое число при остальных зафиксированных, берётся лучшее по монетам отбора,
   круги повторяются, пока что-то меняется. Экзаменационные монеты в выборе не участвуют.
   Запуск: node app/tune.js <папка со страницами> <куда.json> */
const fs = require('fs');
const { lab, c, sh, report, stable } = require('./lab.js');
const mk = (p) => ({ base: 1, rules: [{ act: 1 + p.b / 100, conds: [c('usdt', '>', p.usdt), c('othd', '<', p.othd)] }, { act: -p.ss / 100, conds: [c('fng', '<', p.fs), c('usdtd', '<', p.ud)] }, { act: -p.sw / 100, conds: [c('fng', '<', p.fw), c('usdtd', '<', p.ud)] }, { act: 1 + p.r / 100, conds: [c('btcr30', '>', p.bt)] }] });
const rng = (a, b, st) => { const o = []; for (let x = a; x <= b + 1e-9; x += st) o.push(+x.toFixed(3)); return o; };
const START = { b: 50, ss: 30, sw: 10, r: 100, usdt: 1.07, othd: 25, fs: 40, fw: 52, ud: 7.6, bt: 20 };
const GRID = { b: rng(0, 100, 0.5), ss: rng(0, 100, 0.5), sw: rng(0, 30, 0.5), r: rng(0, 100, 0.5), usdt: rng(0.98, 1.25, 0.005), othd: rng(18, 34, 0.5), fs: rng(20, 51, 1), fw: rng(41, 75, 1), ud: rng(4.5, 10.5, 0.1), bt: rng(0, 45, 0.5) };
const NAME = { b: 'покупка, % резерва', ss: 'сильная продажа, %', sw: 'слабая продажа, %', r: 'возврат, % резерва', usdt: 'порог USDT.D к средней', othd: 'порог доли альтов, %', fs: 'страх для сильной продажи', fw: 'страх для слабой продажи', ud: 'порог USDT.D, %', bt: 'рост биткоина за 30 дней, %' };
const sc = (s) => s.worst + s.hworst + s.med / 5;
(async () => {
  const lb = await lab(process.argv[2]);
  const mode = process.argv[4] || 'sel';                       // sel — выбор по монетам отбора; all — по всем 31 (без экзамена)
  let cur = { ...START }, hist = [], curves = {};
  const base = (await lb.run([{ S: mk(START) }]))[0];
  console.log('СТАРТ: ' + JSON.stringify(START) + '\n' + report(base));
  for (let round = 1; round <= 4; round++) {
    let changed = 0;
    for (const k of Object.keys(GRID)) {
      const vals = GRID[k].filter((v) => (k === 'fw' ? v > cur.fs : k === 'fs' ? v < cur.fw : true));
      const rows = await lb.run(vals.map((v) => ({ v, S: mk({ ...cur, [k]: v }) })));
      // лучшее значение: все монеты группы в плюсе и максимальная оценка
      const key = mode === 'all' ? 'all' : 'sel', ok = rows.filter((r) => r[key].pos === r[key].n), best = (ok.length ? ok : rows).reduce((a, r) => (sc(r[key]) > sc(a[key]) + 1e-9 ? r : a));
      const now = rows.find((r) => r.v === cur[k]);
      // ширина плато: значения, чья оценка не хуже лучшей больше чем на 2 пункта
      const plat = rows.filter((r) => sc(r[key]) >= sc(best[key]) - 2).map((r) => r.v);
      curves[k] = rows.map((r) => [r.v, +sc(r.sel).toFixed(1), +sc(r.ex).toFixed(1), +r.all.med.toFixed(0), +r.all.worst.toFixed(0), +r.all.hworst.toFixed(0)]);
      const line = `круг ${round}, ${NAME[k]}: ${cur[k]} → ${best.v} (оценка отбора ${now ? sc(now.sel).toFixed(1) : '?'} → ${sc(best.sel).toFixed(1)}; экзамена ${now ? sc(now.ex).toFixed(1) : '?'} → ${sc(best.ex).toFixed(1)}); плато ${Math.min(...plat)}…${Math.max(...plat)}`;
      console.log(line); hist.push(line);
      if (best.v !== cur[k]) { cur[k] = best.v; changed++; }
    }
    if (!changed) { console.log(`круг ${round}: ничего не изменилось — сошлось`); break; }
  }
  const fin = (await lb.run([{ S: mk(cur) }]))[0];
  console.log('\nИТОГ: ' + JSON.stringify(cur) + '\n' + report(fin));
  console.log('не менее устойчива, чем старт: на отборе ' + (stable(fin, base, 'sel') ? 'да' : 'нет') + ', на экзамене ' + (stable(fin, base, 'ex') ? 'да' : 'нет') + `; медиана экзамена ${base.ex.med.toFixed(0)}% → ${fin.ex.med.toFixed(0)}%`);
  fs.writeFileSync(process.argv[3], JSON.stringify({ start: START, final: cur, hist, curves, strategy: mk(cur) }));
  await lb.close();
})();
