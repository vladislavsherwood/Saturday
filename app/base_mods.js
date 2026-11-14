/* Обычный взнос не всегда одинаковый: в дни без сигналов взнос × множитель по признаку (0,5…1,5), недоложенное копится в резерве.
   Основа — основная стратегия B (found/main-crypto.json). Одиночные признаки, потом пары «больше на дешёвом / меньше на дорогом».
   Запуск: node app/base_mods.js <папка> */
const fs = require('fs');
const { lab, c, stable, report } = require('./lab.js');
const { injLiq } = require('./liq_inject.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const B = JSON.parse(fs.readFileSync(__dirname + '/found/main-crypto.json', 'utf8'));
const SIG = [ // [признак, знак, порог, подпись]
  ['fng', '<', 20, 'страх < 20'], ['fng', '<', 30, 'страх < 30'], ['fng', '>', 70, 'жадность > 70'], ['fng', '>', 80, 'жадность > 80'],
  ['sma200', '<', 0.7, 'монета ниже средней 200 на 30%+'], ['sma200', '<', 0.85, 'монета ниже средней 200 на 15%+'], ['sma200', '>', 1.5, 'монета выше средней 200 на 50%+'], ['sma200', '>', 2, 'монета выше средней 200 вдвое'],
  ['btcath', '>', 50, 'биткоин ниже максимума на 50%+'], ['btcath', '>', 30, 'биткоин ниже максимума на 30%+'], ['btcath', '<', 5, 'биткоин в 5% от максимума'], ['btcath', '<', 15, 'биткоин в 15% от максимума'],
  ['rsi', '<', 30, 'RSI монеты < 30'], ['rsi', '>', 70, 'RSI монеты > 70'], ['btc200', '<', 0.85, 'биткоин ниже средней 200 на 15%+'], ['btc200', '>', 1.3, 'биткоин выше средней 200 на 30%+'],
  ['mvrv', '<', 1.2, 'MVRV < 1,2'], ['mvrv', '>', 2.5, 'MVRV > 2,5'], ['usdt', '>', 1.03, 'USDT.D выше своей средней на 3%+'], ['usdt', '<', 0.95, 'USDT.D ниже своей средней на 5%+'],
  ['ret30', '<', -25, 'монета −25% за 30 дней'], ['ret30', '>', 50, 'монета +50% за 30 дней'], ['oidd30', '<', -15, 'OI ниже максимума на 15%+'], ['fund30', '>', 1.5, 'фандинг за 30 дней > 1,5%'],
  ['dd', '>', 0.6, 'монета ниже своего максимума на 60%+'], ['dd', '<', 0.15, 'монета в 15% от своего максимума']];
const L = [{ tag: 'B (взнос всегда ×1)', S: B }];
for (const [ind, op, v, t] of SIG) for (const m of [0.5, 0.75, 1.25, 1.5]) L.push({ kind: 'one', sig: t, m, tag: `${t} → взнос ×${m}`, S: { ...B, mods: [{ mult: m, conds: [c(ind, op, v)] }] } });
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  for (const g in lb.pages) await lb.pages[g].evaluate(injLiq, LIQ);
  // проверка: dd в странице — доля или проценты?
  console.log('dd пример:', await lb.pages.own.evaluate(() => { const v = IND.dd.v.filter((x) => !isNaN(x)); return [Math.min(...v), Math.max(...v)]; }));
  const rows = []; for (let i = 0; i < L.length; i += 120) rows.push(...(await lb.run(L.slice(i, i + 120))));
  const base = rows[0];
  const inc = (r) => Math.log1p(r.sel.med / 100) + Math.log1p(r.ex.med / 100) + Math.log1p(r.rnd.med / 100);
  const ok = (r) => [stable(r, base, 'sel') && r.sel.med >= base.sel.med, stable(r, base, 'ex') && r.ex.med >= base.ex.med, r.rnd.pos >= base.rnd.pos && r.rnd.hpos >= base.rnd.hpos && r.rnd.med >= base.rnd.med];
  const line = (r) => `${r.sel.med.toFixed(0).padStart(5)}/${r.sel.hworst.toFixed(0).padStart(4)}/${r.sel.hpos} | ${r.ex.med.toFixed(0).padStart(4)}/${r.ex.hworst.toFixed(0).padStart(4)}/${r.ex.hpos} | ${r.rnd.med.toFixed(0).padStart(4)}/${r.rnd.hpos} ${ok(r).map((x) => (x ? '✔' : '·')).join('')} ${(inc(r) - inc(base) >= 0 ? '+' : '') + (inc(r) - inc(base)).toFixed(3)}  ${r.tag}`;
  console.log('отбор медиана/худш.пол./половин+ | экзамен то же | 50 случ. медиана/половин+ | ✔ | доход к B\n' + line(base) + '\n');
  rows.slice(1).sort((a, b) => inc(b) - inc(a)).forEach((r) => console.log(line(r)));
  // пары: лучшее «больше» + лучшее «меньше»
  const good = rows.slice(1).filter((r) => ok(r).filter(Boolean).length >= 2);
  const up = good.filter((r) => r.m > 1).sort((a, b) => inc(b) - inc(a)).slice(0, 6), dn = good.filter((r) => r.m < 1).sort((a, b) => inc(b) - inc(a)).slice(0, 6);
  const L2 = [{ tag: 'B', S: B }];
  for (const u of up) for (const d of dn) if (u.sig !== d.sig) L2.push({ tag: `${u.tag}; ${d.tag}`, S: { ...B, mods: [...u.S.mods, ...d.S.mods] } }, { tag: `${d.tag}; ${u.tag}`, S: { ...B, mods: [...d.S.mods, ...u.S.mods] } });
  const R2 = await lb.run(L2); await lb.close();
  console.log('\n=== пары (больше + меньше) ===');
  R2.slice(1).sort((a, b) => inc(b) - inc(a)).slice(0, 15).forEach((r) => console.log(line(r)));
  fs.writeFileSync(process.argv[2] + '/base_mods.json', JSON.stringify([...rows, ...R2.slice(1)].map((r) => ({ tag: r.tag, S: r.S, ok: ok(r), inc: inc(r) - inc(base) }))));
})();
