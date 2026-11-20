/* hv2, финал: две ступени по волатильности (hvv > 110 → вес ½: доля ×1,5, порог пампа +275%; hvv > 130 → вес 1: доля ×2, порог пампа +250%), крупные — по списку isbig.
   1) правила копиями (без крючков) = вариант на крючках; 2) combo5 / hv / hv2; 3) провалы добавочных продаж (+ основа: продажи combo5 тех же семей в том же режиме);
   4) эпохи, половины; 5) монеты пользователя; 6) PUMP 2026; 7) found/hv2-best.json и правила для проверки маржи (scratchpad/hv/margin_rules.json). */
const fs = require('fs');
const X = require('./hv2_lib.js'), { H, c, L1, P, G } = X;
const STEPS = [[110, 0.5], [130, 1]], M = 2, U = 250;
const O2 = { gf: X.steps(STEPS), U, M };
// правила копиями: перед каждым правилом семьи — копии от верхней ступени к нижней
function rulesOf() {
  const out = [];
  H.S5.rules.forEach((r0, k) => {
    const f = X.FAM(k), r = JSON.parse(JSON.stringify(r0));
    if (f && !r.conds.some((x) => (x.ind === 'vol180' && x.op === '<') || (x.ind === 'isbig' && x.op === '>'))) {
      for (const [t, w] of [...STEPS].reverse()) {
        const m = 1 + (M - 1) * w, act = Math.round(Math.max(-1, r.act * m) * 1e6) / 1e6; if (f !== 'p' && act === r.act) continue;
        const cp = { act, conds: r.conds.map((x) => ({ ...x, v: f === 'p' && x.ind === 'up90' ? 300 - (300 - U) * w : x.v })).concat([c('hvv', '>', t), c('isbig', '<', 0.5)]) };
        cp.hv2 = { family: f === 'w' ? 'широкая тихая вершина' : f === 'p' ? 'памп в медвежьем рынке' : 'эйфория в стейблах', before_rule: k + 1, step: `hvv > ${t}`, mult: m, act_was: r.act };
        out.push(cp);
      }
    }
    out.push(r);
  });
  return out;
}
const S2 = { ...H.L.clone(H.S5), rules: rulesOf() };
const { build } = require('./hv_r7.js');
const S1 = build({ T: 120, U: 200, mp: 2, mw: 2, me: 2 });
H.head();
H.ev('combo5', H.S5);
const R1 = H.ev('hv (двоично T120, U200, ×2)', S1);
const Rh = X.run('hv2 на крючках', O2, { quiet: true }); console.log(Rh.txt);
const R2 = H.ev('hv2 правилами (копии)', S2);
console.log(`совпадение крючки = правила: ${Math.abs(Rh.all - R2.all) < 1e-6 && Math.abs(Rh.hv81.m - R2.hv81.m) < 1e-6 && Math.abs(Rh.n.m - R2.n.m) < 1e-6 ? 'да' : 'НЕТ'}; копий ${S2.rules.length - 58}, всего правил ${S2.rules.length}`);
console.log('  hv2 по монетам:', H.diff(R2, 10));
// 100 новых по сегментам, крупные
const { BR, BN } = H.bases();
for (const [nm, R] of [['hv', R1], ['hv2', R2]]) console.log(`  ${nm} 100 новых по сегментам:`, ['big', 'alt', 'meme'].map((s) => { const q = H.Z.mlog(R.N, BN, s, ['n100']); return `${s} ${H.sg(q.m, 3)} ${q.u}/${q.d}`; }).join(', '),
  '| крупные:', R.R.sel.filter((x) => x.seg === 'big').map((x) => `${x.name} ${Math.round(x.f)}`).join(' '));
// провалы
const fh = X.fails(X.run('', {}, { quiet: true }).V), f2 = X.fails(Rh.V);
let n = 0, bad = 0, usd = 0, bu = 0;
for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const Y of G[g]) { const { tr } = P.edge(Y, H.S5, 0, 'full', true, H.polW);
  for (const t of tr) { const j = t.i - 1; if (t.s > 0 || !X.FAM(t.q) || !(Y.ind.hvv[j] > 110) || Y.ind.isbig[j] > 0.5) continue; n++; usd += t.amt; let mx = 0; for (let q = t.i + 1; q < Math.min(Y.n, t.i + 366); q++) mx = Math.max(mx, Y.c[q]); if (mx >= 3 * t.p) { bad++; bu += t.amt; } } }
console.log(`провалы: hv — ${X.ftxt(fh)}; hv2 — ${X.ftxt(f2)}; основа — продажи combo5 тех же семей в дни hvv > 110 (не крупные): ${n}, провалов ${(100 * bad / n).toFixed(1)}% по числу, ${(100 * bu / usd).toFixed(1)}% по деньгам`);
// эпохи
console.log('эпохи hv2:'); const EPS = X.epochs('hv2', O2);
// монеты пользователя
const cut = (Y, from) => { const a = Y.ind.t.findIndex((t) => t >= H.T(from)); const Z = { ...Y, n: Y.n - a, c: Y.c.slice(a), h: Y.h.slice(a), l: Y.l.slice(a), ind: {} }; for (const k in Y.ind) Z.ind[k] = Y.ind[k].slice ? Y.ind[k].slice(a) : Y.ind[k]; return Z; };
const mine = [];
console.log('\nМонеты пользователя: вся история combo5 / hv / hv2 | 2026 с нуля combo5 / hv / hv2');
for (const nm of H.MINE) { const Y = H.BY[nm]; if (!Y) continue; const Z = cut(Y, '2026-01-01');
  const v = [H.S5, S1, S2].map((S) => H.E(Y, S, H.polW)), w = [H.S5, S1, S2].map((S) => H.E(Z, S, H.polW));
  mine.push({ nm, hvv_med: Math.round(Y.hvm), hvv_now: Math.round(Y.ind.hvv[Y.n - 1]), full: v.map((x) => +x.toFixed(1)), y2026: w.map((x) => +x.toFixed(1)) });
  console.log(`${nm.padEnd(9)} hvv ${Math.round(Y.hvm)}/${Math.round(Y.ind.hvv[Y.n - 1])} | ${v.map((x) => x.toFixed(0)).join(' / ')} | ${w.map((x) => x.toFixed(1)).join(' / ')}`); }
// PUMP 2026
const Y = H.BY.PUMP, I = Y.ind, t26 = H.T('2026-01-01');
const runP = (S) => { const pol = { ...H.polW, trace: [] }; const r = P.edge(Y, S, 0, 'full', true, pol); return { tr: r.tr.filter((t) => I.t[t.i] >= t26), T: pol.trace }; };
const A = runP(H.S5), B1 = runP(S1), B2 = runP(S2);
const key = (t) => `${H.day(I.t[t.i])} ${t.s > 0 ? 'КУП' : 'ПРОД'} $${Math.round(t.amt)} по ${Y.c[t.i].toPrecision(3)}`;
const sa = new Set(A.tr.map(key)); console.log('\nPUMP 2026 — сделки hv2, которых нет у combo5:', B2.tr.map(key).filter((k) => !sa.has(k)).join(' | '));
let du = 0; for (let i = 0; i < Y.n; i++) du += (10 * 0.999) / Y.c[i];
const pumpV = {}; for (const p of [Y.c[Y.n - 1], 0.0026]) { const v = (T) => { const [, cash, u] = T[T.length - 1]; return cash + u * p; }; pumpV[p] = { combo5: Math.round(v(A.T)), hv: Math.round(v(B1.T)), hv2: Math.round(v(B2.T)), dca: Math.round(du * p) };
  console.log(`PUMP по цене ${p}: combo5 $${pumpV[p].combo5} | hv $${pumpV[p].hv} | hv2 $${pumpV[p].hv2} | DCA $${pumpV[p].dca} | вложено $${10 * Y.n}`); }
// файлы
fs.writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/hv/margin_rules.json', JSON.stringify({ combo5: H.S5.rules, hv: S1.rules, hv2: S2.rules.map(({ act, conds }) => ({ act, conds })) }));
const res = (R) => ({ sel: Math.round(R.sel), ex: Math.round(R.ex), rnd: Math.round(R.rnd), income: { all: +R.all.toFixed(3), big: +R.big.toFixed(3), alt: +R.alt.toFixed(3), meme: +R.meme.toFixed(3) }, strict: R.ok,
  segment_hv: { income: +R.hvInc.toFixed(3), mlog81: +R.hv81.m.toFixed(4), better_worse81: `${R.hv81.u}/${R.hv81.d}`, mlog100: +R.nhv.m.toFixed(4), better_worse100: `${R.nhv.u}/${R.nhv.d}` },
  all81_mlog: +R.m81.m.toFixed(4), n100_mlog: +R.n.m.toFixed(4), n100_better_worse: `${R.n.u}/${R.n.d}`, halves_income: [+R.h1.toFixed(3), +R.h2.toFixed(3)], halves_hv_mlog: [+R.hvh1.toFixed(3), +R.hvh2.toFixed(3)], big_worst_coin_log: R.bigWorst });
const out = {
  name: 'hv2-best: combo5 + «продажи у вершины крупнее у волатильной монеты» — две ступени по волатильности',
  base: 'combo5-best.json (58 правил) + отложенная паника Boost(2, { k: 0, A: 0 }) + ловушка для фитилей (без изменений)',
  idea: 'Если vol180 монеты (пока его нет — vol90) > 110% и монета не крупная (isbig = 0): продажи у вершины ×1,5 — широкая тихая вершина, эйфория в стейблах, «памп в медвежьем рынке» (и он уже от +275% к 90-дн. минимуму вместо +300%). Если > 130%: ×2 и памп от +250%. Доли не больше 100%. Остальное без изменений.',
  replaces: 'found/hv-best.json (двоичный порог 120, памп от +200%, ×2): обрыв по порогу (PUMP) убран, порог пампа понижен мягче, доля провальных добавочных продаж ниже',
  formula_alt: 'Плавная форма (для движка с формулой): вес g = clamp((hvv − 100) / 40, 0, 1); доля × (1 + g); порог пампа 300 − 50·g. Результат на 81 / 100н тот же (см. журнал hv2, круг 5).',
  indicator: { hvv: 'vol180 (годовая волатильность дневных лог-доходностей за 180 дн, %, как в combo2/B65); пока vol180 нет — vol90; до ~90 дней — нет (правила не срабатывают)' },
  params: { steps: STEPS.map(([t, w]) => ({ hvv_gt: t, mult: 1 + (M - 1) * w, pump_up90_gt: 300 - (300 - U) * w })), exclude: 'isbig > 0.5 (список крупных combo5)' },
  insert: S2.rules.map((r, i) => (r.hv2 ? { index0: i, ...r.hv2, act: r.act, conds: r.conds } : null)).filter(Boolean),
  insert_note: 'Копии стоят непосредственно перед исходным правилом (before_rule — номер в списке 58, с 1), сначала ступень hvv > 130, затем hvv > 110. Исходные правила не меняются.',
  rules: S2.rules.map(({ act, conds }) => ({ act, conds })),
  results: { combo5: { sel: 5392, ex: 2557, rnd: 965 }, hv: res(R1), hv2: res(R2) },
  failures: { hv: fh, hv2: f2, combo5_same_regime: { n, pc: +(100 * bad / n).toFixed(1), pcUsd: +(100 * bu / usd).toFixed(1) } },
  epochs: EPS.map((e) => ({ epoch: e.ep, only: { all: +e.only.all.toFixed(3), hv81: +e.only.hv81.m.toFixed(4), hv100: +e.only.nhv.m.toFixed(4), m81: +e.only.m81.m.toFixed(4), n100: +e.only.n.m.toFixed(4) }, without: { hv81: +e.wo.hv81.m.toFixed(4), hv100: +e.wo.nhv.m.toFixed(4) } })),
  user_coins: mine, pump_2026: pumpV,
  warnings: [
    'Выигрыш почти целиком из 2023–2026 (подъём 2023–25 и медведь 2025–26); в 2017–2022 правила у волатильных монет почти не срабатывают — ни подтверждения, ни опровержения.',
    'Исключение крупных — по списку isbig: признаки (corr180, beta180, возраст, «ведёт себя как крупная») либо ломают строгую по крупным, либо теряют до 70% выигрыша на 100 новых. Без исключения вовсе — крупные в среднем в плюсе (BTC +0,06, LTC +0,20), но строгая по крупным ✗ на волоске (TRX −0,07%).',
    'Провальные добавочные продажи (монета потом ×3 за год) — ~13–14%, на уровне собственных продаж combo5 у тех же монет в том же режиме; «продавать добавку на первой слабости» не снижает их и съедает выигрыш.',
    'Край карты: при начале рампы ≤ 85 (ступень > 100 и ниже с весом > 0) — строгая ✗ на сотые (худшая половина альта экзамена).',
    'Маржа ×1,45 — см. журнал hv2 (hv2_margin.py).' ],
  from: 'research/hv_journal.md (hv2), hv2_lib.js, hv2_r0 … hv2_r5b.js, hv2_final.js, hv2_margin.py (2026-11-20)',
};
fs.writeFileSync(__dirname + '/found/hv2-best.json', JSON.stringify(out, null, 1));
console.log(`\nзаписано found/hv2-best.json (${S2.rules.length} правил)`);
for (const x of out.insert) console.log(`  перед правилом ${x.before_rule} (${x.family}, ${x.step}): ${x.conds.map((q) => q.ind + q.op + q.v).join(' & ')} → ${x.act} (было ${x.act_was})`);
