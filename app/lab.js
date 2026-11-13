/* Общая обвязка для проверки гипотез: открывает страницы с монетами, добавляет производные индикаторы,
   считает список стратегий на отборе (17 монет), экзамене (14) и металлах и сравнивает с эталоном. */
const { chromium } = require('playwright');
const { inPage, open } = require('./simple.js');
const c = (ind, op, v) => ({ ind, op, v });
// производные индикаторы, которых нет в конструкторе; считаются один раз на странице
const inject = (EX) => {
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW);
  for (const k of SETS.avg) {
    setup(k, true);
    if (IND.btcr14) continue;
    const add = (key, v) => { IND[key] = { v, step: 1, min: 0, max: 1, short: key, name: key }; };
    const diff = (a, n) => a.map((x, i) => (i >= n ? x - a[i - n] : NaN)), rel = (a, n) => a.map((x, i) => (i >= n ? (x / a[i - n] - 1) * 100 : NaN));
    const f = IND.fng.v, u = IND.usdtd.v, bd = IND.btcd.v;
    add('fngd7', diff(f, 7)); add('fngd30', diff(f, 30)); add('fngma', f.map((x, i) => { if (i < 29) return NaN; let s = 0; for (let j = i - 29; j <= i; j++) s += f[j]; return s / 30; }));
    add('usdm14', rel(u, 14)); add('usdm30', rel(u, 30)); add('btcdm30', diff(bd, 30));
    const btc = RAW.pair ? fill(RAW.pair) : RAW.c;                       // цена биткоина по дням этой монеты
    add('btc200', ratio(btc, 200).slice(SKIP)); add('btc50', ratio(btc, 50).slice(SKIP)); add('btcr90', change(btc, 90).slice(SKIP)); add('btcr30', change(btc, 30).slice(SKIP)); for (const n of [14, 21, 45, 60]) add('btcr' + n, change(btc, n).slice(SKIP));
    { let m = 0; add('btcath', btc.map((v) => { if (v > m) m = v; return (1 - v / m) * 100; }).slice(SKIP)); }
    // длительность сигналов: сколько дней подряд держится условие продажи / покупки и сколько дней прошло с последнего такого дня
    const sellOn = f.map((x, i) => x < 52 && u[i] < 7.6), buyOn = IND.usdt.v.map((x, i) => x > 1.07 && IND.othd.v[i] < 25);
    const run = (a) => { let n = 0; return a.map((x) => (n = x ? n + 1 : 0)); }, since = (a) => { let n = NaN; return a.map((x) => (n = x ? 0 : n + 1)); };
    add('selld', run(sellOn)); add('buyd', run(buyOn)); add('sells', since(sellOn)); add('buys', since(buyOn));
    // доля дней с сигналом продажи за последние 90 и 365 дней
    const share = (a, n) => { let s = 0; return a.map((x, i) => { s += x ? 1 : 0; if (i >= n) s -= a[i - n] ? 1 : 0; return i >= n - 1 ? (100 * s) / n : NaN; }); };
    add('sell90', share(sellOn, 90)); add('sell365', share(sellOn, 365));
    // волатильность: стандартное отклонение дневных изменений за 30 дней, %
    const r = H.c.map((x, i) => (i ? (x / H.c[i - 1] - 1) * 100 : 0));
    add('vol30', r.map((x, i) => { if (i < 30) return NaN; let m = 0, q = 0; for (let j = i - 29; j <= i; j++) m += r[j]; m /= 30; for (let j = i - 29; j <= i; j++) q += (r[j] - m) ** 2; return Math.sqrt(q / 30); }));
    // --- маркеры вершин и дна (markers.py): рыночные ряды приходят снаружи по номеру дня ---
    if (EX) {
      const at = {}; EX.t.forEach((t, i) => (at[t] = i));
      for (const key of ['breadth', 'btctx', 'btcaddr', 'tvldd', 'mvrv']) { let last = NaN; add(key, H.t.map((t) => { const i = at[t]; if (i != null && EX[key][i] != null) last = EX[key][i]; return last; })); }
      let m = 0; const bath = btc.map((v) => { if (v > m) m = v; return (1 - v / m) * 100; }).slice(SKIP);
      add('btcath2', bath); add('btcd90', diff(bd, 90));
      const c = H.c, hi = c.map((x, i) => { for (let j = Math.max(0, i - 6); j <= i; j++) { let top = j >= 60; for (let q = Math.max(0, j - 89); q < j && top; q++) if (c[q] > c[j]) top = false; if (top) return 1; } return 0; });
      const lo = c.map((x, i) => { for (let j = Math.max(0, i - 6); j <= i; j++) { let bot = j >= 60; for (let q = Math.max(0, j - 89); q < j && bot; q++) if (c[q] < c[j]) bot = false; if (bot) return 1; } return 0; });
      add('hi90', hi); add('lo90', lo);
      const g = (k) => IND[k].v, pr = IND.pair ? IND.pair.v : c.map(() => NaN);
      add('topn', c.map((x, i) => (g('othd')[i] > 27.7) + (g('breadth')[i] > 88.9) + (pr[i] > 1.38) + (g('btctx')[i] < 0.978) + (g('btcd90')[i] < -1.35) + (g('btcaddr')[i] < 1.1)));
      add('botn', c.map((x, i) => (g('tvldd')[i] > 59) + (g('usdtd')[i] > 6.52) + (bath[i] > 57.5) + (g('mvrv')[i] < 1.3) + (g('sma200')[i] < 0.532)));
      // те же счётчики без признаков самой монеты — чисто рыночные
      add('topm', c.map((x, i) => (g('othd')[i] > 27.7) + (g('breadth')[i] > 88.9) + (g('btctx')[i] < 0.978) + (g('btcd90')[i] < -1.35) + (g('btcaddr')[i] < 1.1)));
      add('botm', c.map((x, i) => (g('tvldd')[i] > 59) + (g('usdtd')[i] > 6.52) + (bath[i] > 57.5) + (g('mvrv')[i] < 1.3)));
    }
    add('age', H.c.map((x, i) => i));                                  // возраст истории монеты в днях
    add('dow', H.t.map((t) => (t + 4) % 7));                           // день недели: 0 — воскресенье
  }
  setup(cur, true);
  return true;
};
const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const stat = (full, halves) => ({ n: full.length, pos: full.filter((x) => x > 0).length, worst: Math.min(...full), med: med(full), hpos: halves.filter((x) => x > 0).length, hn: halves.length, hworst: Math.min(...halves) });
const sh = (s) => `в плюсе ${s.pos}/${s.n}, худшая ${s.worst.toFixed(0)}%, медиана ${s.med.toFixed(0)}%, половины ${s.hpos}/${s.hn}, худшая половина ${s.hworst.toFixed(0)}%`;
const P = { own: 'strategy-builder-sol', valid: 'valid', exam: 'exam', memes: 'memes6', metals: 'metals', r0: 'rnd0', r1: 'rnd1', r2: 'rnd2', r3: 'rnd3', r4: 'rnd4' }, SEL = ['own', 'valid'], EX = ['exam', 'memes'], ALL = [...SEL, ...EX], RND = ['r0', 'r1', 'r2', 'r3', 'r4'];

async function lab(dir, opt = {}) {
  const browser = await chromium.launch(), pages = {}, fs = require('fs');
  const extra = fs.existsSync(__dirname + '/found/market_extra.json') ? JSON.parse(fs.readFileSync(__dirname + '/found/market_extra.json', 'utf8')) : null;
  for (const g in P) { if (g[0] === 'r' && !opt.rnd) continue; pages[g] = await open(browser, `${dir}/${P[g]}.html`, 'lab'); await pages[g].evaluate(inject, extra); }
  async function run(list) {
    const R = {};
    for (const g in pages) { R[g] = {}; for (const part of ['full', 'h1', 'h2']) R[g][part] = await pages[g].evaluate(inPage, { seed: 1, unit: 10, evalMany: list.map((x) => x.S), part }); }
    const get = (i, g, part) => g.flatMap((k) => R[k][part][i].e), names = (part) => ALL.flatMap((k) => R[k][part][0].names.map((n) => n + (part === 'full' ? '' : part === 'h1' ? ' (1-я пол.)' : ' (2-я пол.)')));
    return list.map((x, i) => ({ ...x, i,
      sel: stat(get(i, SEL, 'full'), [...get(i, SEL, 'h1'), ...get(i, SEL, 'h2')]), ex: stat(get(i, EX, 'full'), [...get(i, EX, 'h1'), ...get(i, EX, 'h2')]),
      rnd: opt.rnd ? stat(get(i, RND, 'full'), [...get(i, RND, 'h1'), ...get(i, RND, 'h2')]) : null, rndE: opt.rnd ? get(i, RND, 'full') : null, rndNames: opt.rnd ? RND.flatMap((k) => R[k].full[0].names) : null,
      all: stat(get(i, ALL, 'full'), [...get(i, ALL, 'h1'), ...get(i, ALL, 'h2')]), h2: stat(get(i, ALL, 'h2'), get(i, ALL, 'h2')), met: R.metals.full[i].e.map((v) => Math.round(v)),
      neg: ['full', 'h1', 'h2'].flatMap((part) => { const e = get(i, ALL, part), n = names(part); return e.map((v, k) => (v < 0 ? `${n[k]} ${v.toFixed(0)}%` : null)).filter(Boolean); }) }));
  }
  return { run, pages, close: () => browser.close() };
}
// не менее устойчив, чем эталон, на группе k (отбор или экзамен)
const stable = (r, base, k) => r[k].pos >= base[k].pos && r[k].worst >= base[k].worst && r[k].hworst >= base[k].hworst && r[k].hpos >= base[k].hpos;
const report = (r) => `     отбор: ${sh(r.sel)}\n     экзамен: ${sh(r.ex)}\n     все 31: ${sh(r.all)} | 2-я пол. медиана ${r.h2.med.toFixed(0)}% | металлы ${r.met.join('/')}\n     в минусе: ${r.neg.join(', ') || 'нет'}` + (r.rnd ? `\n     50 случайных: ${sh(r.rnd)}` : '');
module.exports = { lab, c, med, stat, sh, stable, report };
