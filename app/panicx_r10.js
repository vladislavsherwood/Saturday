/* Круг 10: финал — 100 новых для лучшего варианта и соседей; сегменты; метрика точности паники на 100 новых; запись found/panicx-best.json.
   Запуск: node panicx_r10.js [save] */
const fs = require('fs');
const P = require('./panicx_sim.js'), Z = P.Z;
const { Pol } = require('./panicx_r8.js');
const BEST = { A: 540, t: 0.98, k: 0.25, rv: 0.965, strong: true, su: 1.2 };
const V = [['лучший A540 t0.98 k0.25 rv0.965', BEST], ['сосед rv0.96', { ...BEST, rv: 0.96 }], ['сосед A730', { ...BEST, A: 730 }], ['сосед k0.5', { ...BEST, k: 0.5 }], ['сосед t0.97', { ...BEST, t: 0.97 }]];
const f = P.f;
P.report('основа', P.base, null, { n100: true });
const res = {};
for (const [nm, o] of V) {
  const r = P.report(nm, P.base, Pol(o), { n100: true });
  const m100 = P.metric(P.base, Pol(o), ['n100']);
  console.log('   100н метрика паники', `${m100.fall.toFixed(1)}%/${m100.days}д/${m100.big.toFixed(0)}% монеты ${m100.fallC.toFixed(1)}%/${m100.daysC.toFixed(0)}д`);
  res[nm] = { r, m100 };
}
const mb = P.metric(P.base, null, ['n100']); console.log('основа 100н метрика паники', `${mb.fall.toFixed(1)}%/${mb.days}д/${mb.big.toFixed(0)}% монеты ${mb.fallC.toFixed(1)}%/${mb.daysC.toFixed(0)}д`);
if (process.argv[2] === 'save') {
  const { r, m100 } = res[V[0][0]], { BS, BM } = P.baseline(), s1 = r.N.s1.n100.all, b1 = r.N.b1.n100.all;
  const seg = (S, s) => Object.fromEntries(['sel', 'ex', 'rnd'].filter((g) => S[g][s]).map((g) => [g, { med: +S[g][s].med.toFixed(1), pos: S[g][s].pos, n: S[g][s].n, hpos: S[g][s].hpos, hworst: +S[g][s].hworst.toFixed(2), worst: +S[g][s].worst.toFixed(2) }]));
  const out = {
    name: 'panicx-best: combo3 без tune1 + отложенная паника (долг при росте usdt, выдача на развороте usdt)',
    base_file: 'found/combo3-best.json (= combo3_sim.make({ simp: 1, t2: 1, t3: 1 }))',
    base: P.base.base, rules: P.base.rules,
    panic_defer: {
      what: 'Новое состояние движка для правил паники (правила, где есть условие usdt и доля > взноса; #3–#8 combo3-best). Сами правила и доли не меняются.',
      rule: [
        `Если накануне монета старше ${BEST.A} дней (age > ${BEST.A}), usdt ≤ ${BEST.su} (не сильная паника) и usdt у своего 10-дн. максимума (upk10 = usdt / max(usdt за 10 дней) ≥ ${BEST.t}),`,
        `правило паники покупает долю × ${BEST.k} (вместо полной доли резерва), а остаток (доля × ${1 - BEST.k} × резерв накануне) записывается в долг паники, $ (долг не больше остатка резерва).`,
        `Долг тратится целиком (сверх обычной покупки дня, в пределах резерва) в первый день покупки/взноса, когда накануне upk10 < ${BEST.rv} (usdt развернулся вниз от 10-дн. пика), или когда эпизод паники закончился (10 дней без паники).`,
        'В день продажи долг не тратится. Новый эпизод паники (первый день паники после ≥ 10 дней без неё) обнуляет долг (неистраченное остаётся в резерве).',
      ],
      params: BEST,
      indicators: { upk10: 'usdt[i] / max(usdt[i−9..i]) — usdt — индикатор USDT.D к средней 200 дн. (как в правилах паники)', age: 'дней с начала истории монеты (уже есть в данных)', panic_day: 'паника = usdt > 1,07 и othd < 25; эпизод — дни паники с разрывами ≤ 10 дней' },
      code: 'app/panicx_sim.js (edge с pol), app/panicx_r8.js (Pol)',
    },
    results_fast: {
      base: { sel: f(BS.sel.all), ex: f(BS.ex.all), rnd: f(BS.rnd.all), n100: f(b1), format: 'медиана/в плюсе/половин в плюсе/худшая половина' },
      best: { sel: f(r.RS.sel.all), ex: f(r.RS.ex.all), rnd: f(r.RS.rnd.all), n100: f(s1) },
      income_vs_base: Object.fromEntries(Z.SEGS.map((s) => [s, +(Z.inc(r.RS, s) - Z.inc(BS, s)).toFixed(3)])),
      strict_vs_base: Object.fromEntries(Z.SEGS.map((s) => [s, Z.strict(r.RS, BS, s).length ? Z.strict(r.RS, BS, s) : 'ok'])),
      n100_mean_log_per_coin: +r.N.m.m.toFixed(4), n100_better_worse: `${r.N.m.u}/${r.N.m.d}`,
      segments_best: { big: seg(r.RS, 'big'), alt: seg(r.RS, 'alt'), meme: seg(r.RS, 'meme') },
      panic_precision: {
        definition: 'покупки правил паники и выдачи долга: падение цены после покупки до минимума следующих 120 дней (взвешено по деньгам), взвеш. медиана дней до дна, доля денег при падении > 30%; «по монетам» — среднее по монетам',
        base_81: { fall: +BM.fall.toFixed(1), days: BM.days, big30: +BM.big.toFixed(0), fallC: +BM.fallC.toFixed(1), daysC: +BM.daysC.toFixed(0) },
        best_81: { fall: +r.M.fall.toFixed(1), days: r.M.days, big30: +r.M.big.toFixed(0), fallC: +r.M.fallC.toFixed(1), daysC: +r.M.daysC.toFixed(0) },
        base_n100: { fall: +mb.fall.toFixed(1), days: mb.days, fallC: +mb.fallC.toFixed(1), daysC: +mb.daysC.toFixed(0) },
        best_n100: { fall: +m100.fall.toFixed(1), days: m100.days, fallC: +m100.fallC.toFixed(1), daysC: +m100.daysC.toFixed(0) },
      },
    },
    honest_notes: [
      'Фильтр возраста (age > 540) подобран под молодые монеты отбора HYPE и PUMP: при age > 365/450 строгая ломается на HYPE. Плато: A 540–730 проходит.',
      'Порог выдачи долга: rv 0,96–0,975 ✔, rv 0,955 ✗ (TON 1-я половина −2,7 → −3,1%).',
      'Механизм с состоянием (долг) — в движке (engine.py / web) его пока нет; вариант только на правилах (без долга) слабее: +0,17 при × 4 на развороте.',
      'Только спот, быстрый оценщик. Маржу (схемы combo3) надо перепроверить: правила паники теперь тратят резерв в другие дни.',
    ],
  };
  fs.writeFileSync(__dirname + '/found/panicx-best.json', JSON.stringify(out, null, 1));
  console.log('записано found/panicx-best.json');
}
