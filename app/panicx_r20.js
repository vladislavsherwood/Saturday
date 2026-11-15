/* Круг 20: финал второй серии — 100 новых для кандидатов (k 0 × 2 — финалист, k 0, × 3), к panicx-best и к C3; метрика паники; запись found/panicx2-best.json.
   Запуск: node panicx_r20.js [save] */
const fs = require('fs');
const H = require('./panicx_p2.js'), P = H.P, Z = H.Z, f = P.f;
const FIN = { k: 0, m: 2, t: 0.98, rv: 0.965, A: 540, su: 1.2 };
const V = [['финалист k0 × 2', H.Boost(2, { k: 0 })], ['k0 × 3', H.Boost(3, { k: 0 })], ['k0 без надбавки', H.Pol2({ k: 0 })], ['panicx-best', H.Pol2()]];
const L1 = Z.L1;
const all = (pol) => P.evc(P.base, pol, ['sel', 'ex', 'rnd', 'n100']);
const C3R = all(null), PXR = all(H.Pol2());
const out = {};
for (const [nm, pol] of V) {
  const R = all(pol), S = Z.sum(R), cmp = (B) => { const BS = Z.sum(B); return { inc: Object.fromEntries(Z.SEGS.map((s) => [s, +(Z.inc(S, s) - Z.inc(BS, s)).toFixed(3)])), strict: Object.fromEntries(Z.SEGS.map((s) => [s, Z.strict(S, BS, s).join(',') || 'ok'])), n100: Z.mlog(R, B, 'all', ['n100']), n100s: Object.fromEntries(['alt', 'meme'].map((s) => [s, Z.mlog(R, B, s, ['n100'])])) }; };
  const a = cmp(C3R), b = cmp(PXR), M = P.metric(P.base, pol), M1 = P.metric(P.base, pol, ['n100']);
  console.log(`${nm.padEnd(20)} ${['sel', 'ex', 'rnd', 'n100'].map((g) => f(S[g].all)).join(' | ')}`);
  console.log(`   к C3: доход ${JSON.stringify(a.inc)} строгая ${JSON.stringify(a.strict)} | 100н лог ${a.n100.m.toFixed(4)} лучше/хуже ${a.n100.u}/${a.n100.d} (альты ${a.n100s.alt.m.toFixed(4)} ${a.n100s.alt.u}/${a.n100s.alt.d}, мемы ${a.n100s.meme.m.toFixed(4)} ${a.n100s.meme.u}/${a.n100s.meme.d})`);
  console.log(`   к panicx-best: доход ${JSON.stringify(b.inc)} строгая ${JSON.stringify(b.strict)} | 100н лог ${b.n100.m.toFixed(4)} лучше/хуже ${b.n100.u}/${b.n100.d}`);
  console.log(`   паника 81: ${M.fall.toFixed(1)}%/${M.days}д/${M.big.toFixed(0)}% монеты ${M.fallC.toFixed(1)}%/${M.daysC.toFixed(0)}д | 100н: ${M1.fall.toFixed(1)}%/${M1.days}д/${M1.big.toFixed(0)}% монеты ${M1.fallC.toFixed(1)}%/${M1.daysC.toFixed(0)}д`);
  out[nm] = { S, a, b, M, M1, R };
}
const C3S = Z.sum(C3R), M0 = P.metric(P.base, null), M01 = P.metric(P.base, null, ['n100']);
console.log(`C3: ${['sel', 'ex', 'rnd', 'n100'].map((g) => f(C3S[g].all)).join(' | ')} | паника 81 ${M0.fall.toFixed(1)}%/${M0.days}д/${M0.big.toFixed(0)}% монеты ${M0.fallC.toFixed(1)}% | 100н ${M01.fall.toFixed(1)}%/${M01.days}д монеты ${M01.fallC.toFixed(1)}%`);
// какие монеты 100 новых хуже всего к panicx-best
{ const R = out['финалист k0 × 2'].R.n100, d = R.map((x, i) => [x.name, L1(x.f) - L1(PXR.n100[i].f), PXR.n100[i].f, x.f]).sort((p, q) => p[1] - q[1]); console.log('100н хуже всех к panicx-best:', d.slice(0, 5).map((x) => `${x[0]} ${x[2].toFixed(0)}→${x[3].toFixed(0)}`).join(', '), '| лучше всех:', d.slice(-5).map((x) => `${x[0]} ${x[2].toFixed(0)}→${x[3].toFixed(0)}`).join(', '));
  for (const [g, B] of [['C3', C3R], ['panicx', PXR]]) R.forEach((x, i) => { for (const k of ['f', 'h1', 'h2']) if ((B.n100[i][k] > 0) !== (x[k] > 0)) console.log(`   знак к ${g}:`, x.name, k, B.n100[i][k].toFixed(1), '→', x[k].toFixed(1)); }); }
if (process.argv[2] === 'save') {
  const o = out['финалист k0 × 2'], seg = (S, s) => Object.fromEntries(['sel', 'ex', 'rnd', 'n100'].filter((g) => S[g][s]).map((g) => [g, f(S[g][s])]));
  const j = {
    name: 'panicx2-best: combo3 без tune1 + отложенная паника k 0 с выдачей × 2 на развороте usdt',
    base_file: 'found/combo3-best.json (= combo3_sim.make({ simp: 1, t2: 1, t3: 1 })); предыдущий шаг — found/panicx-best.json',
    base: P.base.base, rules: P.base.rules,
    panic_defer: {
      what: 'Состояние движка для правил паники (#3–#8 combo3-best: есть условие usdt и доля > взноса). Правила и доли не меняются.',
      rule: [
        `Если накануне монета старше ${FIN.A} дней, usdt ≤ ${FIN.su} (не сильная паника) и usdt у 10-дн. максимума (upk10 = usdt / max(usdt за 10 дней) ≥ ${FIN.t}), правило паники ничего не покупает сверх взноса (k = ${FIN.k}),`,
        'а всю свою долю (доля × резерв накануне) записывает в долг паники, $ (не больше остатка резерва).',
        `Когда накануне upk10 < ${FIN.rv} (usdt развернулся вниз от 10-дн. пика), долг тратится в первый же день покупки/взноса с надбавкой: покупка = долг × ${FIN.m} (надбавка из резерва, в пределах резерва); долг обнуляется.`,
        'Если эпизод паники кончился (10 дней без паники) раньше разворота — долг тратится без надбавки. В день продажи не тратится. Новый эпизод обнуляет неистраченный долг (он остаётся в резерве).',
      ],
      params: FIN,
      indicators: { upk10: 'usdt[i] / max(usdt[i−9..i]); usdt — USDT.D к средней 200 дн. (как в правилах паники)', age: 'дней с начала истории монеты', panic: 'usdt > 1,07 и othd < 25; эпизод — дни паники с разрывами ≤ 10 дней' },
      code: 'app/panicx_sim.js (edge: pol.buy/release/extra), app/panicx_p2.js (Pol2, Boost)',
    },
    results_fast: {
      format: 'медиана / в плюсе / половин в плюсе / худшая половина',
      c3: Object.fromEntries(['sel', 'ex', 'rnd', 'n100'].map((g) => [g, f(C3S[g].all)])),
      panicx_best: Object.fromEntries(['sel', 'ex', 'rnd', 'n100'].map((g) => [g, f(out['panicx-best'].S[g].all)])),
      best: Object.fromEntries(['sel', 'ex', 'rnd', 'n100'].map((g) => [g, f(o.S[g].all)])),
      vs_c3: { income: o.a.inc, strict: o.a.strict, n100_mean_log: +o.a.n100.m.toFixed(4), n100_better_worse: `${o.a.n100.u}/${o.a.n100.d}` },
      vs_panicx_best: { income: o.b.inc, strict: o.b.strict, n100_mean_log: +o.b.n100.m.toFixed(4), n100_better_worse: `${o.b.n100.u}/${o.b.n100.d}` },
      segments_best: { big: seg(o.S, 'big'), alt: seg(o.S, 'alt'), meme: seg(o.S, 'meme') },
      panic_precision: {
        definition: 'покупки правил паники и выдачи долга (с надбавкой): падение цены после покупки до минимума 120 дней, по деньгам / взвеш. медиана дней до дна / доля денег при падении > 30%; по монетам — среднее',
        c3_81: [+M0.fall.toFixed(1), M0.days, +M0.big.toFixed(0), +M0.fallC.toFixed(1)], panicx_81: [+out['panicx-best'].M.fall.toFixed(1), out['panicx-best'].M.days, +out['panicx-best'].M.big.toFixed(0), +out['panicx-best'].M.fallC.toFixed(1)], best_81: [+o.M.fall.toFixed(1), o.M.days, +o.M.big.toFixed(0), +o.M.fallC.toFixed(1)],
        c3_n100: [+M01.fall.toFixed(1), M01.days, +M01.big.toFixed(0), +M01.fallC.toFixed(1)], panicx_n100: [+out['panicx-best'].M1.fall.toFixed(1), out['panicx-best'].M1.days, +out['panicx-best'].M1.big.toFixed(0), +out['panicx-best'].M1.fallC.toFixed(1)], best_n100: [+o.M1.fall.toFixed(1), o.M1.days, +o.M1.big.toFixed(0), +o.M1.fallC.toFixed(1)],
      },
    },
    honest_notes: [
      'Строгая к panicx-best проходит только при rv 0,965 и A 540 (соседи rv 0,96/0,97, A 730, k 0,1 — ✗ на одной половине альта экзамена или PEPE); к C3 — широкое плато (107 из 144 вариантов круга 18).',
      'Фильтр возраста > 540 дн. заменить не удалось (круг 14): без него страдают молодые монеты (HYPE, PUMP, TIBBIR, WFI, SYRUP…); порог выбран по HYPE.',
      'При k 0 порог «сильной паники» 1,2 — узкий: 1,25 и 1,3 ✗.',
      'Хвост тяжелее: денег перед падением > 50% 13% (C3) → 17%, крупных дневных покупок (> 25% капитала) больше на ~19% (круг 19). Маржу перепроверить на эпизодах 2018/2022/2025–26.',
      'Механизм с состоянием — в engine.py / web и в браузерном стенде его нет; проверено только быстрым оценщиком (спот).',
    ],
  };
  fs.writeFileSync(__dirname + '/found/panicx2-best.json', JSON.stringify(j, null, 1));
  console.log('записано found/panicx2-best.json');
}
