/* Какие продажи оказываются плохими и можно ли их отфильтровать.
   1. Каждый день сильного сигнала продажи (страх < 40 и USDT.D < 7,6%) помечается исходом: что стало с ценой через 90 дней.
      По каждому признаку дни делятся на три равные группы — видно, при каких значениях продажа чаще ошибка.
      Границы групп считаются на 17 монетах отбора, потом те же границы проверяются на 14 экзаменационных.
   2. Фильтр в самой стратегии: крупная продажа только при выполнении признака, иначе мелкая. Отбор → экзамен.

   Запуск: node app/filter.js <папка со страницами> <куда.json> */
const { chromium } = require('playwright');
const fs = require('fs');
const { inPage, open } = require('./simple.js');
const c = (ind, op, v) => ({ ind, op, v });
const BC = [c('usdt', '>', 1.07), c('othd', '<', 25)], SC = [c('fng', '<', 52), c('usdtd', '<', 7.6)], STRONG = [...SC, c('fng', '<', 40)];
const BIG = 0.5, SMALL = 0.075;
const mk = (x, big = BIG, small = SMALL, mid = SMALL) => ({ base: 1, rules: [{ act: 1.5, conds: BC }, ...(x ? [{ act: -big, conds: [...STRONG, x] }] : []), { act: -(x ? mid : big), conds: STRONG }, { act: -small, conds: SC }] });

const collect = () => {          // дни сильного сигнала продажи со всеми признаками и исходом
  const out = [], cur = SETS.order.find((k) => SETS.sets[k] === RAW);
  for (const k of SETS.avg) {
    setup(k, true);
    const keys = Object.keys(IND);
    for (let i = 0; i < N; i++) {
      if (!(IND.fng.v[i] < 40 && IND.usdtd.v[i] < 7.6)) continue;
      const f = {}; for (const q of keys) f[q] = IND[q].v[i];
      out.push({ coin: RAW.ticker, t: H.t[i], f, r30: i + 30 < N ? (H.c[i + 30] / H.c[i] - 1) * 100 : null, r90: i + 90 < N ? (H.c[i + 90] / H.c[i] - 1) * 100 : null, r180: i + 180 < N ? (H.c[i + 180] / H.c[i] - 1) * 100 : null });
    }
  }
  setup(cur, true);
  return out;
};
const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const stat = (full, halves) => ({ pos: full.filter((x) => x > 0).length, worst: Math.min(...full), med: med(full), hpos: halves.filter((x) => x > 0).length, hworst: Math.min(...halves) });
const sh = (s) => `в плюсе ${s.pos}, худшая ${s.worst.toFixed(0)}%, медиана ${s.med.toFixed(0)}%, половины ${s.hpos}, худшая половина ${s.hworst.toFixed(0)}%`;

(async () => {
  const [dir, outPath] = process.argv.slice(2), browser = await chromium.launch();
  const P = { own: 'strategy-builder-sol', valid: 'valid', exam: 'exam', memes: 'memes6' }, SEL = ['own', 'valid'], EX = ['exam', 'memes'], ALL = [...SEL, ...EX];
  const pages = {}; for (const g in P) pages[g] = await open(browser, `${dir}/${P[g]}.html`, 'fl');
  // ---------- 1. исходы ----------
  const D = {}; for (const g in P) D[g] = await pages[g].evaluate(collect);
  const dsel = SEL.flatMap((g) => D[g]).filter((d) => d.r90 != null), dex = EX.flatMap((g) => D[g]).filter((d) => d.r90 != null);
  const bad = (a) => (100 * a.filter((d) => d.r90 > 0).length / a.length);
  console.log(`дней сильного сигнала продажи: отбор ${dsel.length} (${new Set(dsel.map((d) => d.coin)).size} монет), экзамен ${dex.length}`);
  console.log(`в целом: через 90 дней цена ВЫШЕ (продажа — ошибка) в ${bad(dsel).toFixed(0)}% дней на отборе и ${bad(dex).toFixed(0)}% на экзамене; медиана изменения ${med(dsel.map((d) => d.r90)).toFixed(0)}% / ${med(dex.map((d) => d.r90)).toFixed(0)}%`);
  const feats = Object.keys(dsel[0].f), T = [];
  for (const k of feats) {
    const v = dsel.map((d) => d.f[k]).filter((x) => x != null && !isNaN(x)).sort((x, y) => x - y); if (v.length < dsel.length * 0.8) continue;
    const q1 = v[Math.floor(v.length / 3)], q2 = v[Math.floor(2 * v.length / 3)]; if (q1 === q2) continue;
    const grp = (a) => [a.filter((d) => d.f[k] <= q1), a.filter((d) => d.f[k] > q1 && d.f[k] <= q2), a.filter((d) => d.f[k] > q2)];
    const gs = grp(dsel), ge = grp(dex);
    T.push({ k, q1, q2, sel: gs.map(bad), selMed: gs.map((a) => med(a.map((d) => d.r90))), ex: ge.map((a) => (a.length > 30 ? bad(a) : NaN)), spread: Math.abs(bad(gs[0]) - bad(gs[2])) });
  }
  T.sort((x, y) => y.spread - x.spread);
  console.log('\nДОЛЯ ОШИБОЧНЫХ ПРОДАЖ (цена через 90 дней выше) по третям признака: низкие / средние / высокие значения');
  for (const r of T) console.log(`  ${r.k.padEnd(7)} границы ${String(+r.q1.toFixed(2)).padStart(7)} / ${String(+r.q2.toFixed(2)).padEnd(7)} отбор: ${r.sel.map((x) => x.toFixed(0).padStart(3) + '%').join(' ')}   экзамен: ${r.ex.map((x) => (isNaN(x) ? '  –' : x.toFixed(0).padStart(3) + '%')).join(' ')}   медиана цены через 90 дн.: ${r.selMed.map((x) => x.toFixed(0)).join(' / ')}`);

  // ---------- 2. фильтр в стратегии ----------
  const grid = { usdt: [0.8, 0.9, 1, 1.1], usdtd: [3, 4, 5, 6], fng: [20, 25, 30, 35], dd: [20, 35, 50, 65, 80], ath: [20, 40, 60, 80], sma200: [0.6, 0.75, 0.9, 1, 1.15], sma50: [0.85, 0.95, 1.05],
    rsi: [30, 40, 50], ret1: [-3, 0, 3], ret30: [-30, -20, -10, 0], ret90: [-40, -20, 0, 30], bbz: [-1.5, -0.5, 0.5], btcd: [45, 50, 55, 60], ethd: [10, 13, 16], othd: [22, 26, 30, 34],
    vol: [0.8, 1.3, 2], pair: [0.8, 0.9, 1, 1.1, 1.2], red: [1.5, 2.5], green: [1.5, 2.5] };
  const L = [{ tag: 'середина плато 30 / 7,5', S: mk(null, 0.3) }, { tag: 'крупная 50 / 7,5 без фильтра', S: mk(null) }, { tag: 'крупная 100 / 7,5 без фильтра', S: mk(null, 1) }];
  for (const ind in grid) for (const v of grid[ind]) for (const op of ['<', '>']) for (const big of [0.5, 1]) for (const mid of [0, SMALL]) L.push({ tag: `продать ${big * 100}% только если ${ind} ${op} ${v}, иначе ${mid * 100}%`, x: `${ind} ${op} ${v}`, big, mid, S: mk(c(ind, op, v), big, SMALL, mid) });
  const R = {}; for (const g in P) { R[g] = {}; for (const part of ['full', 'h1', 'h2']) R[g][part] = await pages[g].evaluate(inPage, { seed: 1, unit: 10, evalMany: L.map((x) => x.S), part }); }
  const get = (i, g, part) => g.flatMap((k) => R[k][part][i].e), nm = (g, part) => g.flatMap((k) => R[k][part][0].names.map((n) => n + (part === 'full' ? '' : part === 'h1' ? ' (1-я пол.)' : ' (2-я пол.)')));
  const rows = L.map((x, i) => ({ ...x, i, sel: stat(get(i, SEL, 'full'), [...get(i, SEL, 'h1'), ...get(i, SEL, 'h2')]), ex: stat(get(i, EX, 'full'), [...get(i, EX, 'h1'), ...get(i, EX, 'h2')]), all: stat(get(i, ALL, 'full'), [...get(i, ALL, 'h1'), ...get(i, ALL, 'h2')]) }));
  const neg = (i) => { const out = []; for (const part of ['full', 'h1', 'h2']) { const e = get(i, ALL, part), n = nm(ALL, part); e.forEach((v, k) => { if (v < 0) out.push(`${n[k]} ${v.toFixed(0)}%`); }); } return out.join(', '); };
  console.log('\nБЕЗ ФИЛЬТРА, все 31:');
  for (const r of rows.slice(0, 3)) { console.log(`  ${r.tag}: ${sh(r.all)}`); console.log('     в минусе: ' + neg(r.i)); }
  for (const big of [0.5, 1]) {
    const base = rows[big === 1 ? 2 : 1], pool = rows.filter((r) => r.big === big);
    const sc = (s) => s.worst + s.hworst + s.med / 5;
    const ok = pool.filter((r) => r.sel.worst >= base.sel.worst && r.sel.hworst >= base.sel.hworst && r.sel.hpos >= base.sel.hpos && r.sel.med >= base.sel.med * 0.9).sort((x, y) => sc(y.sel) - sc(x.sel));
    console.log(`\nФИЛЬТР ДЛЯ ПРОДАЖИ ${big * 100}%: вариантов ${pool.length}; на отборе устойчивее базы без потери прибыли: ${ok.length}; из них и на экзамене лучше базы по худшей монете и худшей половине: ${ok.filter((r) => r.ex.worst >= base.ex.worst && r.ex.hworst >= base.ex.hworst).length}`);
    console.log(`  база: отбор ${sh(base.sel)} | экзамен ${sh(base.ex)}`);
    for (const r of ok.slice(0, 7)) { const good = r.ex.worst >= base.ex.worst && r.ex.hworst >= base.ex.hworst; console.log(`  ${r.tag}\n     отбор: ${sh(r.sel)}\n     экзамен: ${sh(r.ex)} ${good ? '✔' : '✘'}\n     все 31: ${sh(r.all)}\n     в минусе: ${neg(r.i)}`); }
    const byX = {}; for (const r of ok) (byX[r.x] = byX[r.x] || []).push(r);
    console.log('  признаки, прошедшие отбор: ' + Object.keys(byX).join(' ; '));
  }
  fs.writeFileSync(outPath, JSON.stringify({ T, rows: rows.map((r) => ({ ...r, S: undefined })) }));
  await browser.close();
})();
