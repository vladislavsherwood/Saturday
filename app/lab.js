/* Общая обвязка для проверки гипотез: открывает страницы с монетами, добавляет производные индикаторы,
   считает список стратегий на отборе (17 монет), экзамене (14) и металлах и сравнивает с эталоном. */
const { chromium } = require('playwright');
const { inPage, open } = require('./simple.js');
const c = (ind, op, v) => ({ ind, op, v });
// производные индикаторы, которых нет в конструкторе; считаются один раз на странице
const inject = () => {
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
    add('age', H.c.map((x, i) => i));                                  // возраст истории монеты в днях
    add('dow', H.t.map((t) => (t + 4) % 7));                           // день недели: 0 — воскресенье
  }
  setup(cur, true);
  return true;
};
const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const stat = (full, halves) => ({ n: full.length, pos: full.filter((x) => x > 0).length, worst: Math.min(...full), med: med(full), hpos: halves.filter((x) => x > 0).length, hn: halves.length, hworst: Math.min(...halves) });
const sh = (s) => `в плюсе ${s.pos}/${s.n}, худшая ${s.worst.toFixed(0)}%, медиана ${s.med.toFixed(0)}%, половины ${s.hpos}/${s.hn}, худшая половина ${s.hworst.toFixed(0)}%`;
const P = { own: 'strategy-builder-sol', valid: 'valid', exam: 'exam', memes: 'memes6', metals: 'metals' }, SEL = ['own', 'valid'], EX = ['exam', 'memes'], ALL = [...SEL, ...EX];

async function lab(dir) {
  const browser = await chromium.launch(), pages = {};
  for (const g in P) { pages[g] = await open(browser, `${dir}/${P[g]}.html`, 'lab'); await pages[g].evaluate(inject); }
  async function run(list) {
    const R = {};
    for (const g in P) { R[g] = {}; for (const part of ['full', 'h1', 'h2']) R[g][part] = await pages[g].evaluate(inPage, { seed: 1, unit: 10, evalMany: list.map((x) => x.S), part }); }
    const get = (i, g, part) => g.flatMap((k) => R[k][part][i].e), names = (part) => ALL.flatMap((k) => R[k][part][0].names.map((n) => n + (part === 'full' ? '' : part === 'h1' ? ' (1-я пол.)' : ' (2-я пол.)')));
    return list.map((x, i) => ({ ...x, i,
      sel: stat(get(i, SEL, 'full'), [...get(i, SEL, 'h1'), ...get(i, SEL, 'h2')]), ex: stat(get(i, EX, 'full'), [...get(i, EX, 'h1'), ...get(i, EX, 'h2')]),
      all: stat(get(i, ALL, 'full'), [...get(i, ALL, 'h1'), ...get(i, ALL, 'h2')]), h2: stat(get(i, ALL, 'h2'), get(i, ALL, 'h2')), met: R.metals.full[i].e.map((v) => Math.round(v)),
      neg: ['full', 'h1', 'h2'].flatMap((part) => { const e = get(i, ALL, part), n = names(part); return e.map((v, k) => (v < 0 ? `${n[k]} ${v.toFixed(0)}%` : null)).filter(Boolean); }) }));
  }
  return { run, pages, close: () => browser.close() };
}
// не менее устойчив, чем эталон, на группе k (отбор или экзамен)
const stable = (r, base, k) => r[k].pos >= base[k].pos && r[k].worst >= base[k].worst && r[k].hworst >= base[k].hworst && r[k].hpos >= base[k].hpos;
const report = (r) => `     отбор: ${sh(r.sel)}\n     экзамен: ${sh(r.ex)}\n     все 31: ${sh(r.all)} | 2-я пол. медиана ${r.h2.med.toFixed(0)}% | металлы ${r.met.join('/')}\n     в минусе: ${r.neg.join(', ') || 'нет'}`;
module.exports = { lab, c, med, stat, sh, stable, report };
