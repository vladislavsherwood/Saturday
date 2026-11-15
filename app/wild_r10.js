/* Круг 10. Объединение и финал: «эйфория в стейблах» для зелёных монет (круг 9) + сочетания с островом круга 5 (память рынка, только ослабление продаж)
   и антиподом круга 1; 100 новых для финалиста и соседей. Сравнение — к combo4 (и для сочетаний — к финалисту круга 9).
   Запуск: node wild_r10.js [save] > scratchpad/wild/r10.log */
const fs = require('fs');
const W = require('./wild_sim.js'), Z = W.Z, f = W.f;
const { S9 } = require('./wild_r9.js'), { mkt } = require('./wild_r5.js');
const FIN = { L: 0.9, x: 0.05, A: 540, fit: ['beta180', 0.9], nomeme: true };
const V = [
  ['ФИНАЛИСТ β>0,9 не мем A540 usdt<0,9 −5%', S9(FIN)],
  ['сосед usdt<0,88', S9({ ...FIN, L: 0.88 })],
  ['сосед usdt<0,92', S9({ ...FIN, L: 0.92 })],
  ['сосед −3%', S9({ ...FIN, x: 0.03 })],
  ['сосед −8%', S9({ ...FIN, x: 0.08 })],
  ['сосед β>1,0', S9({ ...FIN, fit: ['beta180', 1.0] })],
  ['сосед A730', S9({ ...FIN, A: 730 })],
  ['вариант с мемами: β>0,9 и corr180>0,5', S9({ L: 0.9, x: 0.05, A: 540, fit: ['beta180', 0.9], fit2: ['corr180', 0.5] })],
];
// сочетание с кругом 5: память рынка (H90, γ4, lo 0,25, только ослабление) поверх финалиста
const R5 = mkt({ H: 90, g: 4, lo: 0.25, hi: 1 });
// сочетание с кругом 1 (антипод): продажи вершин × 1,25, когда монета у 10-дн. максимума (ck10 ≥ 0,99)
for (const g in W.G) for (const X of W.G[g]) if (!X.ind.ck10) { const c = X.c, a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { let m = -Infinity; for (let k = Math.max(0, i - 9); k <= i; k++) m = Math.max(m, c[k]); a[i] = c[i] / m; } X.ind.ck10 = a; }
const TOP = ['qt', 'wide', 'pump', 'as', 'fund'];
const R1 = { act: ({ X, j, q, a, R }) => (q >= 0 && a < 0 && TOP.includes(W.cls(R[q].r)) && X.ind.ck10[j] >= 0.99 ? Math.max(-1, a * 1.25) : a) };
const n100 = process.argv[2] !== 'quick';
W.report('combo4', W.BASE, W.POL, null, { n100 });
const res = {};
for (const [nm, S] of V) res[nm] = W.report(nm, S, W.POL, null, { n100 });
res.c5 = W.report('финалист + круг 5 (память рынка)', V[0][1], W.POL, R5, { n100 });
res.c1 = W.report('финалист + круг 1 (антипод ×1,25)', V[0][1], W.POL, R1, { n100 });
// строгая сочетаний к финалисту
const F = res[V[0][0]];
for (const k of ['c5', 'c1']) { const r = res[k]; console.log(`   ${r.nm} к финалисту: доход ${Z.SEGS.map((s) => (Z.inc(r.RS, s) - Z.inc(F.RS, s)).toFixed(3)).join(' / ')} строгая ${Z.SEGS.map((s) => Z.strict(r.RS, F.RS, s).length ? '✗' : '✔').join('')} ${W.why(r.RS, F.RS).slice(0, 160)}`); }
// сегменты финалиста и 100 новых по монетам
if (n100) {
  const B1 = W.base100(), R1n = F.N.R1.n100, d = R1n.map((x, i) => [x.name, Z.L1(x.f) - Z.L1(B1.n100[i].f), B1.n100[i].f, x.f, x.seg]).sort((p, q) => p[1] - q[1]);
  console.log('100н хуже всех:', d.slice(0, 6).map((x) => `${x[0]} ${x[2].toFixed(0)}→${x[3].toFixed(0)}`).join(', '));
  console.log('100н лучше всех:', d.slice(-6).map((x) => `${x[0]} ${x[2].toFixed(0)}→${x[3].toFixed(0)}`).join(', '));
  R1n.forEach((x, i) => { for (const k of ['f', 'h1', 'h2']) if ((B1.n100[i][k] > 0) !== (x[k] > 0)) console.log(`   знак: ${x.name} ${k} ${B1.n100[i][k].toFixed(1)} → ${x[k].toFixed(1)}`); });
  const S1 = F.N.s1, BS1 = Z.sum(B1);
  console.log('сегменты финалиста (медиана/в плюсе/половин/худшая половина):');
  for (const s of ['big', 'alt', 'meme']) console.log(`   ${s}: ${['sel', 'ex', 'rnd'].filter((g) => F.RS[g][s]).map((g) => `${g} ${f(F.RS[g][s])} (осн ${f(W.base().S[g][s])})`).join(' | ')} | 100н ${S1.n100[s] ? f(S1.n100[s]) : '-'} (осн ${BS1.n100[s] ? f(BS1.n100[s]) : '-'})`);
  // сколько продаёт правило: доля дней и денег (по 81 монете, сдвиг 0)
  let days = 0, money = 0, allm = 0;
  for (const g of ['sel', 'ex', 'rnd']) for (const X of W.G[g]) { const S = V[0][1], R = W.compile(X, S.rules), { tr } = W.edge(X, S, 0, 'full', true); const last = R.length - 1; for (const t of tr) if (t.s < 0) { allm += t.amt; if (t.q === last) { days++; money += t.amt; } } }
  console.log(`правило эйфории: дней продаж ${days}, денег ${(100 * money / allm).toFixed(1)}% всех продаж (81 монета, сдвиг 0)`);
}
if (process.argv[2] === 'save') {
  const r = F, S = V[0][1], B = W.base();
  const j = {
    name: 'wild-best: combo4 + «эйфория в стейблах» для зелёных монет (антипод паники с фильтром светофора по бете)',
    base_file: 'found/combo4-best.json (55 правил combo3 без tune1 + отложенная паника panic_defer, без изменений)',
    new_rule: {
      human: 'Последним правилом (только если ни одно правило выше не сработало): USDT.D к своей 200-дн. средней < 0,9 (стейблы массово тратятся на покупки — эйфория), бета монеты к BTC за 180 дней > 0,9 («зелёный» светофор), монета не мем и старше 540 дней → продать 5% монеты (взнос идёт в резерв). Решение по вчерашнему дню.',
      rule: S.rules[S.rules.length - 1],
      position: 'в конце списка правил (после «альтсезона»)',
      indicators: { usdt: 'USDT.D / SMA200(USDT.D) — тот же, что в правилах паники', beta180: 'бета дневных лог-доходностей монеты к BTC за 180 дней (= corr180 × vol180 / vol BTC), как в светофоре fit_module', age: 'дней с начала истории монеты', meme: '1 для 18 мемов' },
    },
    base: S.base, rules: S.rules, panic_defer: 'как в combo4-best.json (Boost(2, k 0), A 540, t 0,98, rv 0,965, su 1,2)',
    results_fast: {
      format: 'медиана / в плюсе / половин в плюсе / худшая половина',
      combo4: Object.fromEntries(['sel', 'ex', 'rnd'].map((g) => [g, f(B.S[g].all)]).concat([['n100', f(Z.sum(W.base100()).n100.all)]])),
      best: Object.fromEntries(['sel', 'ex', 'rnd'].map((g) => [g, f(r.RS[g].all)]).concat([['n100', f(r.N.s1.n100.all)]])),
      vs_combo4: { income: Object.fromEntries(Z.SEGS.map((s) => [s, +r.inc[s].toFixed(3)])), strict: Object.fromEntries(Z.SEGS.map((s) => [s, r.ok[s] ? 'ok' : Z.strict(r.RS, B.S, s).join(',')])), n100_mean_log: +r.N.m.m.toFixed(4), n100_better_worse: `${r.N.m.u}/${r.N.m.d}` },
      neighbors: Object.fromEntries(V.slice(1).map(([nm]) => [nm, { sel_ex_rnd: ['sel', 'ex', 'rnd'].map((g) => Math.round(res[nm].RS[g].all.med)).join(' / '), income: +res[nm].d.toFixed(3), strict: res[nm].all ? 'ok' : res[nm].w, n100: res[nm].N ? `${f(res[nm].N.s1.n100.all)}, лог ${res[nm].N.m.m.toFixed(4)} ${res[nm].N.m.u}/${res[nm].N.m.d}` : null }])),
    },
    honest_notes: [
      'Порог беты 0,9 — левый край плато: при бете > 0,8 строгая ✗ (TON, отбор 1-я половина); плато 0,9–1,0 (32 из 32 вариантов ✔).',
      'Мемы исключены из-за PEPE (экзамен, 2-я половина 30,3 → 25,3 при бете > 0,9); альтернатива — бета > 0,9 и corr180 > 0,5 (с мемами, доход +0,20, ✔).',
      'Возраст > 540 дн. — тот же фильтр, что у отложенной паники; без него ✗ на сотых (худшая монета альтов экзамена) и ARIA на 50 случайных.',
      'Эпизодов usdt < 0,9 с 2015 г. ~15, вершин циклов 3–4: сигнал редкий, оценка опирается на немного циклов.',
      'Механизм — новое правило в JSON (без состояния), его можно добавить в engine/web без изменений движка; маржа — грубая проверка (wild_margin.py), полную — перепроверить.',
    ],
    code: 'app/wild_r9.js (S9), app/wild_r10.js, app/wild_sim.js',
  };
  fs.writeFileSync(__dirname + '/found/wild-best.json', JSON.stringify(j, null, 1));
  console.log('записано found/wild-best.json');
}
