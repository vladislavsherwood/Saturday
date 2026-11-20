/* hv, финал: кандидат «продажи у вершины ×2 у волатильной монеты» (hvv > 120, не крупная) поверх combo5 + отложенная паника + фитили.
   1) кандидат, соседи ±1 шаг по T / U / m, вклад частей; 2) по монетам; 3) монеты пользователя (вся история и только 2026 г. с нуля);
   4) PUMP в 2026: сделки, где кандидат расходится с combo5, состояние на последний день стенда и оценка по цене 0,0026; 5) запись found/hv-best.json. */
const fs = require('fs');
const H = require('./hv_lib.js'), { c, G, L1, P } = H;
const { build } = require('./hv_r7.js');
const O = { T: 120, U: 200, mp: 2, mw: 2, me: 2 };
// убрать пустые копии: противоречивые (vol180 < 90 при hvv > 120 — hvv и есть vol180; isbig > 0,5 при isbig < 0,5) и с той же долей, что у исходного правила (стоит сразу после копии)
function prune(S) {
  const T = H.L.clone(S); const has = (r, ind, op) => r.conds.find((x) => x.ind === ind && x.op === op);
  T.rules = S.rules.filter((r, k) => { if (!has(r, 'hvv', '>')) return true; const v = has(r, 'vol180', '<');
    if (v && v.v <= has(r, 'hvv', '>').v) return false; if (has(r, 'isbig', '>') && has(r, 'isbig', '<')) return false; return S.rules[k + 1].act !== r.act; });
  return T;
}
const SC = prune(build(O));
H.head();
H.ev('combo5', H.S5);
H.ev('кандидат до чистки пустых копий', build(O));
const R = H.ev('КАНДИДАТ T120 U200 ×2 (П+Ш+Э)', SC);
console.log('  ', H.diff(R, 12));
for (const [nm, o] of [['T115', { T: 115 }], ['T125', { T: 125 }], ['U150', { U: 150 }], ['U250', { U: 250 }], ['×1,5', { mp: 1.5, mw: 1.5, me: 1.5 }], ['×2,5', { mp: 2.5, mw: 2.5, me: 2.5 }],
  ['без пампа (П)', { mp: 1, U: 300 }], ['без широкой (Ш)', { mw: 1 }], ['без эйфории (Э)', { me: 1 }], ['только П', { mw: 1, me: 1 }]]) H.ev(`  сосед/часть: ${nm}`, build({ ...O, ...o }));
// монеты пользователя: вся история; только 2026 г. (стратегия стартует 2026-01-01 с нуля)
const cut = (X, from) => { const a = X.ind.t.findIndex((t) => t >= H.T(from)); const Y = { ...X, n: X.n - a, c: X.c.slice(a), h: X.h.slice(a), l: X.l.slice(a), ind: {} }; for (const k in X.ind) Y.ind[k] = X.ind[k].slice ? X.ind[k].slice(a) : X.ind[k]; return Y; };
console.log('\nМонеты пользователя (итог к DCA, %, худший из сдвигов 0/1): вся история | только 2026 (старт 01.01.2026)');
const mineRows = [];
for (const nm of H.MINE) { const X = H.BY[nm]; if (!X) { console.log(nm, 'нет в данных'); continue; } const Y = cut(X, '2026-01-01');
  const a = H.E(X, H.S5, H.polW), b = H.E(X, SC, H.polW), a6 = H.E(Y, H.S5, H.polW), b6 = H.E(Y, SC, H.polW);
  mineRows.push({ nm, hvv: Math.round(X.hvm), hvNow: Math.round(X.ind.hvv[X.n - 1]), full: [a, b], y2026: [a6, b6] });
  console.log(`${nm.padEnd(9)} hvv медиана ${Math.round(X.hvm)} сейчас ${Math.round(X.ind.hvv[X.n - 1])} | ${a.toFixed(0)} → ${b.toFixed(0)} (${H.sg(L1(b) - L1(a), 3)}) | 2026: ${a6.toFixed(1)} → ${b6.toFixed(1)}`); }
// PUMP 2026: сделки (сдвиг 0, вся история), где кандидат отличается от combo5
const X = H.BY.PUMP, I = X.ind;
const run = (S) => { const pol = { ...H.polW, trace: [] }; const r = P.edge(X, S, 0, 'full', true, pol); return { tr: r.tr, T: pol.trace, e: r.e }; };
const A = run(H.S5), B = run(SC);
const key = (t) => `${H.day(I.t[t.i])} ${t.s > 0 ? 'КУП ' : 'ПРОД'} $${Math.round(t.amt)} по ${X.c[t.i].toPrecision(3)}`;
const t26 = H.T('2026-01-01');
const ka = A.tr.filter((t) => I.t[t.i] >= t26).map(key), kb = B.tr.filter((t) => I.t[t.i] >= t26).map(key), sa = new Set(ka), sb = new Set(kb);
console.log('\nPUMP 2026 — сделки только у combo5:', ka.filter((k) => !sb.has(k)).join(' | '));
console.log('PUMP 2026 — сделки только у кандидата:', kb.filter((k) => !sa.has(k)).join(' | '));
const last = (T) => T[T.length - 1], px = X.c[X.n - 1];
let du = 0; for (let i = 0; i < X.n; i++) du += (10 * 0.999) / X.c[i];
const st = (T, p) => { const [, cash, u] = last(T); return { cash, coin: u * p, tot: cash + u * p }; };
for (const p of [px, 0.0026]) { const a = st(A.T, p), b = st(B.T, p); console.log(`PUMP по цене ${p}: combo5 кэш $${Math.round(a.cash)} + монеты $${Math.round(a.coin)} = $${Math.round(a.tot)} | кандидат кэш $${Math.round(b.cash)} + монеты $${Math.round(b.coin)} = $${Math.round(b.tot)} | DCA $${Math.round(du * p)} | вложено $${10 * X.n}`); }
// провалы новых продаж (сдвиг 0): продажа копией, затем монета ×3 за год
let n = 0, bad = 0; const ex = [];
for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const Y of G[g]) { const { tr } = P.edge(Y, SC, 0, 'full', true, H.polW);
  for (const t of tr) { if (t.s > 0 || !SC.rules[t.q].conds.some((x) => x.ind === 'hvv')) continue; n++; let mx = 0; for (let k = t.i; k < Math.min(Y.n, t.i + 365); k++) mx = Math.max(mx, Y.c[k]); if (mx >= 3 * t.p) { bad++; ex.push(Y.name); } } }
const exu = [...new Set(ex)];
console.log(`\nпровалы: продаж новыми копиями ${n}, монета потом ×3 и выше за год — ${bad} (${(100 * bad / n).toFixed(1)}%), монеты: ${exu.join(', ')}`);
// вставленные правила и их место в списке 58
const ins = []; let k0 = 0; for (let k = 0; k < SC.rules.length; k++) { const r = SC.rules[k]; if (r.conds.some((x) => x.ind === 'hvv')) ins.push({ before_rule: k0 + 1, before_index0: k0, act: r.act, conds: r.conds }); else k0++; }
const hum = { 39: 'широкая тихая вершина', 52: 'памп в медвежьем рынке', 56: 'эйфория в стейблах' };
const fam = (k) => (k >= 39 && k <= 50 ? 'широкая тихая вершина (40–51)' : k >= 52 && k <= 54 ? 'памп в медвежьем рынке (53–55)' : 'эйфория в стейблах (57–58)');
const out = {
  name: 'hv-best: combo5 + «продажи у вершины ×2 у волатильной монеты»',
  base: 'combo5-best.json (58 правил) + отложенная паника Boost(2, { k: 0, A: 0 }) + ловушка для фитилей (wick, без изменений)',
  idea: 'Если годовая волатильность монеты за 180 дней (vol180; пока её нет — vol90) > 120% и монета не крупная (isbig = 0, список крупных combo5), то продажи у вершины ×2 (не больше 100%): широкая тихая вершина, эйфория в стейблах; «памп в медвежьем рынке» — уже от +200% к 90-дн. минимуму (вместо +300%) и ×2. Остальные правила, покупки, паника и фитили — без изменений.',
  indicator: { hvv: 'vol180 монеты (годовая волатильность дневных лог-доходностей за 180 дн, %, как в combo2/B65); пока vol180 нет (первые ~145 дней) — vol90; до ~90 дней — нет, правило не срабатывает' },
  params: { hvv_gt: O.T, pump_up90_gt: O.U, mult: O.mp, exclude: 'isbig > 0.5' },
  insert: ins.map((x) => ({ ...x, family: fam(x.before_index0), act_was: H.S5.rules[x.before_index0].act })),
  insert_note: 'Каждая копия ставится непосредственно ПЕРЕД исходным правилом (before_rule — номер исходного правила в списке 58, с 1); у копии — условия исходного правила + hvv > 120 + isbig < 0,5, у копий «пампа» порог up90 300 → 200. Исходные правила не меняются. Итого 58 + ' + ins.length + ' = ' + SC.rules.length + ' правил.',
  rules: SC.rules,
  results: { combo5: { sel: 5392, ex: 2557, rnd: 965 }, candidate: { sel: Math.round(R.sel), ex: Math.round(R.ex), rnd: Math.round(R.rnd) },
    income: { all: +R.all.toFixed(3), big: +R.big.toFixed(3), alt: +R.alt.toFixed(3), meme: +R.meme.toFixed(3) }, strict: R.ok,
    segment_hv: { income: +R.hvInc.toFixed(3), mlog81: +R.hv81.m.toFixed(4), better_worse81: `${R.hv81.u}/${R.hv81.d}`, mlog100: +R.nhv.m.toFixed(4), better_worse100: `${R.nhv.u}/${R.nhv.d}`, halves_mlog: [+R.hvh1.toFixed(3), +R.hvh2.toFixed(3)] },
    all81_mlog: +R.m81.m.toFixed(4), n100_mlog: +R.n.m.toFixed(4), n100_better_worse: `${R.n.u}/${R.n.d}`, halves_income: [+R.h1.toFixed(3), +R.h2.toFixed(3)], big_worst_coin_log: R.bigWorst },
  user_coins: mineRows,
  warnings: [
    'Обрыв по порогу волатильности: при hvv > 110 и ниже строгая ✗ из-за одной монеты — PUMP (продажи начинаются в середине второй волны роста 19.09.2026 вместо вершины 28.09–08.10); при 115–130 ✔ во всех 18 клетках карты. Выбрана середина плато 120.',
    'Прибавка сегмента держится в обеих эпохах (правила только до 2025 / только с 2025), но до 2023 почти нулевая: выигрыш — от циклов 2023–2026.',
    'На 100 новых выигрыш — у альтов (мемы 100 новых почти не меняются: +0,001).',
    'Доля новых продаж, после которых монета за год выросла ×3 и выше, выше, чем у исходных правил тех же семей (см. журнал): правило продаёт пампы, которые иногда продолжаются (PEPE 12.2023–01.2024, LINK 2019).',
    'Исключение крупных — по списку (флаг isbig combo5, как в B65); без него страдают SOL/BCH/ADA (−0,01…−0,05 лога) в их бурные фазы.',
    'Маржа ×1,45 не проверялась: кандидат меняет только размер продаж (продажи уменьшают позицию), покупки по правилам не меняются, но резерв после продаж больше — последующие покупки из резерва крупнее.' ],
  from: 'research/hv_journal.md, hv_r2.js, hv_r4.js, hv_r7.js … hv_final.js (2026-11-20)',
};
fs.writeFileSync(__dirname + '/found/hv-best.json', JSON.stringify(out, null, 1));
console.log(`\nзаписано found/hv-best.json: ${ins.length} копий, всего ${SC.rules.length} правил`);
for (const x of out.insert) console.log(`  перед правилом ${x.before_rule} (${x.family}): ${x.conds.map((q) => q.ind + q.op + q.v).join(' & ')} → ${x.act} (было ${x.act_was})`);
