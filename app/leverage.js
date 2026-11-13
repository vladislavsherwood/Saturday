/* Плечо на самых сильных сигналах объединённой стратегии.
   Обычная часть считается как раньше (спот). Плечо — отдельный «рукав» на фьючерсах с изолированной маржой:
   - лонг с плечом: в день сильного сигнала покупки та же сумма идёт не в спот, а в маржу, позиция в L раз больше;
     заём стоит 10% годовых; если минимум дня достаёт цену ликвидации (стоимость позиции ≤ долг + 5%) — маржа рукава сгорает;
     рукав продаётся теми же правилами продажи, что и спот;
   - шорт: в первый день сигнала вершины доля резерва идёт в маржу шорта 1×; закрывается по сигналу страха, через 180 дней
     или ликвидацией, если максимум дня выше цены входа на 90%.
   Комиссия 0,1%, сделка на следующий день после сигнала.
   Запуск: node app/leverage.js <папка со страницами> <куда.json> */
const fs = require('fs');
const { chromium } = require('playwright');
const { open } = require('./simple.js');
const inPage = ({ rules, variants, unit }) => {
  const FEE = 0.001, RATE = 0.10 / 365, MM = 0.05, cur = SETS.order.find((k) => SETS.sets[k] === RAW), out = [];
  for (const k of SETS.avg) {
    setup(k, true);
    const ind = {}; for (const key in IND) ind[key] = IND[key].v;
    // какое правило сработало в каждый день (−1 — ни одно)
    const fired = new Int8Array(N).fill(-1);
    for (let i = 0; i < N; i++) for (let r = 0; r < rules.length; r++) { let ok = true; for (const cd of rules[r].conds) { const v = ind[cd.ind] ? ind[cd.ind][i] : NaN; if (!(cd.op === '<' ? v < cd.v : v > cd.v)) { ok = false; break; } } if (ok) { fired[i] = r; break; } }
    let du = 0; for (let i = 0; i < N; i++) du += (unit * (1 - FEE)) / H.c[i];
    const dca = du * H.c[N - 1], row = { name: RAW.ticker, e: [], liq: [], shortPnl: [], levDays: [] };
    for (const V of variants) {
      let cash = 0, units = 0, lu = 0, debt = 0, liq = 0, levDays = 0, sU = 0, sEntry = 0, sMargin = 0, sAge = 0, sPnl = 0;
      for (let i = 0; i < N; i++) {
        const p = H.c[i], j = i - 1, r = j >= 0 ? fired[j] : -1, a = r >= 0 ? rules[r].act : 1, before = cash;
        cash += unit;
        // рукав с плечом: проценты и ликвидация
        if (lu > 0) { debt *= 1 + RATE; levDays++; if (lu * H.l[i] <= debt * (1 + MM)) { lu = 0; debt = 0; liq++; } }
        // шорт: ликвидация, срок, закрытие
        if (sU > 0) {
          sAge++;
          if (H.h[i] >= sEntry * 1.9) { sPnl -= sMargin; sU = 0; sMargin = 0; liq++; }
          else if ((r >= 0 && V.shortClose.includes(r)) || sAge >= 180) { const pnl = sU * (sEntry - p) - sU * p * FEE; cash += sMargin + pnl; sPnl += pnl; sU = 0; sMargin = 0; }
        }
        if (a < 0) {
          const f = -a;
          if (units > 0) { const amt = f * units * p; units -= f * units; cash += amt * (1 - FEE); }
          if (lu > 0) { const net = f * (lu * p * (1 - FEE) - debt); lu -= f * lu; debt -= f * debt; cash += Math.max(0, net); }
          if (V.short > 0 && r === V.topRule && sU === 0 && cash > 0) { sMargin = V.short * cash; cash -= sMargin; sU = (sMargin * (1 - FEE)) / p; sEntry = p; sAge = 0; }
        } else if (a > 0) {
          const amt = Math.min(cash, unit + (a - 1) * before), L = r >= 0 && V.lev[r] ? V.lev[r] : 1;
          if (L > 1) { lu += (amt * L * (1 - FEE)) / p; debt += amt * (L - 1); } else units += (amt * (1 - FEE)) / p;
          cash -= amt;
        }
      }
      const pe = H.c[N - 1], wealth = cash + units * pe + Math.max(0, lu * pe - debt) + (sU > 0 ? sMargin + sU * (sEntry - pe) : 0);
      row.e.push((wealth / dca - 1) * 100); row.liq.push(liq); row.shortPnl.push(sPnl); row.levDays.push(levDays);
    }
    out.push(row);
  }
  setup(cur, true);
  return out;
};
const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
(async () => {
  const [dir, outPath] = process.argv.slice(2), S = JSON.parse(fs.readFileSync(__dirname + '/found/merged.json', 'utf8')), rules = S.rules;
  // правила объединённой: 0 — дно, 1 — паника в стейблах, 2 — вершина, 3 — сильный страх, 4 — слабый страх, 5 — импульс биткоина
  const V = [{ name: 'без плеча', lev: {}, short: 0 }];
  for (const L of [1.5, 2, 3, 5]) V.push({ name: `покупка у дна (4 маркера) с плечом ${L}×`, lev: { 0: L }, short: 0 });
  for (const L of [1.5, 2, 3]) V.push({ name: `покупка на панике в стейблах с плечом ${L}×`, lev: { 1: L }, short: 0 });
  for (const L of [1.5, 2, 3]) V.push({ name: `возврат на импульсе биткоина с плечом ${L}×`, lev: { 5: L }, short: 0 });
  for (const L of [1.5, 2, 3]) V.push({ name: `все три покупки с плечом ${L}×`, lev: { 0: L, 1: L, 5: L }, short: 0 });
  for (const s of [0.1, 0.25, 0.5, 1]) { V.push({ name: `шорт у вершины на ${s * 100}% резерва, закрытие на сильном страхе`, lev: {}, short: s, close: [3, 0] }); V.push({ name: `шорт у вершины на ${s * 100}% резерва, закрытие на любом страхе`, lev: {}, short: s, close: [3, 4, 0] }); }
  V.push({ name: 'дно 2× + шорт 25% (закрытие на сильном страхе)', lev: { 0: 2 }, short: 0.25, close: [3, 0] });
  V.push({ name: 'дно 1,5× + импульс 1,5× + шорт 25%', lev: { 0: 1.5, 5: 1.5 }, short: 0.25, close: [3, 0] });
  const variants = V.map((v) => ({ lev: v.lev, short: v.short, shortClose: v.close || [], topRule: 2 }));
  const browser = await chromium.launch(), G = { known: ['strategy-builder-sol', 'valid', 'exam', 'memes6'], rnd: ['rnd0', 'rnd1', 'rnd2', 'rnd3', 'rnd4'] }, R = {};
  for (const g in G) { R[g] = []; for (const f of G[g]) { const p = await open(browser, `${dir}/${f}.html`, 'lev'); R[g] = R[g].concat(await p.evaluate(inPage, { rules, variants, unit: 10 })); await p.close(); } }
  console.log(`знакомых монет ${R.known.length}, случайных ${R.rnd.length}`);
  console.log(`${'вариант'.padEnd(62)} | знакомые: в плюсе / медиана / худшая / хуже чем без плеча | случайные: в плюсе / медиана / худшая / хуже чем без плеча | ликвидаций`);
  const res = [];
  V.forEach((v, i) => {
    const line = [v.name.padEnd(62)]; const rec = { name: v.name };
    for (const g of ['known', 'rnd']) {
      const e = R[g].map((r) => r.e[i]), b = R[g].map((r) => r.e[0]), worse = e.filter((x, k) => x < b[k] - 0.5).length, liq = R[g].reduce((s, r) => s + r.liq[i], 0);
      rec[g] = { pos: e.filter((x) => x > 0).length, n: e.length, med: med(e), worst: Math.min(...e), worse, liq, hit: R[g].filter((r) => r.liq[i] > 0).length };
      line.push(`${rec[g].pos}/${e.length} / ${med(e).toFixed(0).padStart(5)}% / ${Math.min(...e).toFixed(0).padStart(4)}% / ${String(worse).padStart(2)}`);
    }
    line.push(`${rec.known.liq + rec.rnd.liq} (монет: ${rec.known.hit + rec.rnd.hit})`);
    console.log(line.join(' | ')); res.push(rec);
  });
  // кто пострадал при плече 2× у дна и кто выиграл
  const idx = V.findIndex((v) => v.name.startsWith('покупка у дна') && v.lev[0] === 2), all = [...R.known, ...R.rnd];
  const d = all.map((r) => [r.name, r.e[idx] - r.e[0], r.liq[idx]]).sort((x, y) => x[1] - y[1]);
  console.log('\nпокупка у дна с плечом 2×: изменение итога против «без плеча», п.п. (в скобках ликвидации)');
  console.log('  хуже всего: ' + d.slice(0, 8).map((x) => `${x[0]} ${x[1].toFixed(0)}${x[2] ? ' (' + x[2] + ')' : ''}`).join(', '));
  console.log('  лучше всего: ' + d.slice(-8).reverse().map((x) => `${x[0]} +${x[1].toFixed(0)}`).join(', '));
  const si = V.findIndex((v) => v.short === 0.25 && v.close.length === 2);
  console.log('шорт 25% у вершины: результат шорта в долларах по монетам, где он открывался: ' + all.filter((r) => r.shortPnl[si] !== 0).map((r) => `${r.name} ${r.shortPnl[si] > 0 ? '+' : ''}${Math.round(r.shortPnl[si])}`).join(', '));
  fs.writeFileSync(outPath, JSON.stringify(res));
  await browser.close();
})();
