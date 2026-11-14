/* Агент 4E, круг 9: СОБСТВЕННЫЙ фандинг монеты (found/agent4e_coinfund.json) — сигналы дна и вершины на уровне монеты.
   H9a (событийный разбор по всем монетам стенда с фьючерсом): 30-дн. сумма фандинга монеты < −1/−2/−3% (толпа в шортах — дно монеты?)
        и > 3/5/8% (толпа в лонгах — вершина монеты?). Доходность монеты через 90 дней против её же безусловной медианы за тот же период.
   Критерий (заранее): ≥ 30 эпизодов на ≥ 10 монетах, медиана избыточной доходности > +10% (дно) или < −10% (вершина), доля «в нужную сторону»
        ≥ 60%, на 3 соседних порогах и отдельно в 2020–2023 и 2024–2026 (два режима рынка).
   H9b (в стратегии): продажа 10/25% при фандинге монеты > y (в конце или после разворота BTC); покупка 25/50% резерва при фандинге < x
        (перед паникой). Критерий: доход > +0,05 на 2 соседних порогах и 2 размерах, строгая проверка, 100 новых не хуже W25,
        и доход не держится на одном эпизоде (правило «с даты» 2024-01 / 2025-01 не обнуляет доход).
   Запуск: node app/agent4e_loop9.js */
const E = require('./agent4e_sim.js');
const { c } = E;
const fs = require('fs');
const CF = JSON.parse(fs.readFileSync(__dirname + '/found/agent4e_coinfund.json', 'utf8'));
E.EXTRA4.push((X) => {
  const f = CF.c[X.name], n = X.n, a30 = new Float64Array(n).fill(NaN), a7 = new Float64Array(n).fill(NaN);
  if (f) for (let i = 0; i < n; i++) { const d = X.t[i] - CF.t0; let s = 0, k = 0, s7 = 0, k7 = 0; for (let j = d - 29; j <= d; j++) { const v = j >= 0 && j < f.length ? f[j] : null; if (v != null) { s += v; k++; if (j > d - 7) { s7 += v; k7++; } } } if (k >= 25) a30[i] = s * 30 / k; if (k7 >= 6) a7[i] = s7 * 7 / k7; }
  X.ind.cf30 = a30; X.ind.cf7 = a7;
});
const G = E.groups(['sel', 'ex', 'rnd', 'n100']), ALL = [...G.sel, ...G.ex, ...G.rnd], NEW = G.n100;
const withF = ALL.filter((X) => CF.c[X.name]);
console.log(`монет с собственным фандингом: отбор+экзамен+50 случ. ${withF.length} из ${ALL.length}, 100 новых ${NEW.filter((X) => CF.c[X.name]).length}`);
// событийный разбор
const T24 = E.dayOf('2024-01-01') + E.T0;
function evScreen(tag, cond, sign) {
  const per = { a: [], b: [] }; let coins = new Set();
  for (const X of withF) {
    const cc = X.c, n = X.n, base = []; for (let i = 0; i + 90 < n; i++) if (!isNaN(X.ind.cf30[i])) base.push(cc[i + 90] / cc[i] - 1);
    const bm = E.med(base); let last = -1e9;
    for (let i = 0; i + 90 < n; i++) { if (!cond(X.ind, i)) continue; if (i - last >= 30) { const r = (cc[i + 90] / cc[i] - 1 - bm) * 100; (X.t[i] < T24 ? per.a : per.b).push(r); coins.add(X.name); } last = i; }
  }
  const s = (v) => `${String(v.length).padStart(3)} эп., мед ${E.med(v) >= 0 ? '+' : ''}${E.med(v).toFixed(0)}%, в нужную сторону ${v.length ? Math.round((100 * v.filter((x) => sign * x > 0).length) / v.length) : 0}%`;
  console.log(`  ${tag.padEnd(28)} монет ${String(coins.size).padStart(3)} | 2020–23: ${s(per.a)} | 2024–26: ${s(per.b)} | всего: ${s([...per.a, ...per.b])}`);
}
console.log('\nH9a: избыточная доходность монеты через 90 дней (к её же медиане), первый день эпизода (разрыв ≥ 30 дней)');
for (const x of [-0.5, -1, -2, -3]) evScreen(`фандинг монеты 30д < ${x}%`, (I, i) => I.cf30[i] < x, 1);
for (const y of [2, 3, 5, 8]) evScreen(`фандинг монеты 30д > ${y}%`, (I, i) => I.cf30[i] > y, -1);
for (const y of [1, 2, 3]) evScreen(`фандинг монеты 7д > ${y}%`, (I, i) => I.cf7[i] > y, -1);
for (const x of [-0.5, -1, -2]) evScreen(`фандинг монеты 7д < ${x}%`, (I, i) => I.cf7[i] < x, 1);
// в стратегии
const base = E.ev(G, E.W25, false);
const R = E.W25.rules, i13 = R.findIndex((r) => r.act === 2 && r.conds.length === 1 && r.conds[0].ind === 'btcr30'), iPanic = R.findIndex((r) => r.conds.some((cd) => cd.ind === 'usdt'));
const PL = { 'после разворота': (rule) => [...R.slice(0, i13 + 1), rule, ...R.slice(i13 + 1)], 'в конце': (rule) => [...R, rule], 'перед паникой': (rule) => [...R.slice(0, iPanic), rule, ...R.slice(iPanic)] };
console.log('\nH9b: в стратегии — доход к W25 / 100 новых (✔ строгая, ~ 1 пункт)');
const rows = [];
const run = (tag, S) => { const r = E.ev(G, S, false), d = E.d(r, base), w = E.why(r, base), nf = w ? w.split('; ').length : 0; rows.push({ tag, d, why: w, n100: r.n100.med, n100pos: r.n100.pos, n100h: r.n100.hpos, S }); return `${d >= 0 ? '+' : ''}${d.toFixed(3)}${nf === 0 ? '✔' : nf === 1 ? '~' : ' '}/${r.n100.med.toFixed(0)}`; };
for (const pl of ['после разворота', 'в конце']) for (const a of [0.1, 0.25]) console.log(`  продажа ${a * 100}% ${pl.padEnd(16)} | ${[2, 3, 5, 8].map((y) => `> ${y}%: ${run(`продажа ${a * 100}% ${pl}, фандинг монеты 30д > ${y}%`, { ...E.W25, rules: PL[pl]({ act: -a, conds: [c('cf30', '>', y)] }) })}`).join('  ')}`);
for (const pl of ['перед паникой', 'в конце']) for (const a of [1.25, 1.5]) console.log(`  покупка ${Math.round((a - 1) * 100)}% ${pl.padEnd(14)} | ${[-0.5, -1, -2, -3].map((x) => `< ${x}%: ${run(`покупка ${Math.round((a - 1) * 100)}% ${pl}, фандинг монеты 30д < ${x}%`, { ...E.W25, rules: PL[pl]({ act: a, conds: [c('cf30', '<', x)] }) })}`).join('  ')}`);
const top = rows.filter((r) => r.d > 0.03).sort((x, y) => (x.why.split(';').filter(Boolean).length - y.why.split(';').filter(Boolean).length) || y.d - x.d).slice(0, 6);
console.log('\nлучшие:'); for (const t of top) console.log(`  ${t.tag}: ${t.d.toFixed(3)} | 100н ${t.n100.toFixed(0)}/${t.n100pos}/${t.n100h} | ${t.why || '✔'}`);
// устойчивость к эпизодам: правило разрешено только с даты
if (top.length) { console.log('\nлучшие, правило разрешено только с даты (доход к W25):');
  for (const t of top.slice(0, 3)) { const line = [];
    for (const from of ['2019-09-01', '2022-01-01', '2024-01-01', '2025-01-01']) { const t0 = E.dayOf(from) + E.T0; for (const X of [...ALL, ...NEW]) { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) a[i] = X.t[i] >= t0 ? X.ind.cf30[i] : NaN; X.ind.cfF = a; }
      const S = { ...t.S, rules: t.S.rules.map((r) => (r.conds.some((cd) => cd.ind === 'cf30') ? { ...r, conds: r.conds.map((cd) => (cd.ind === 'cf30' ? { ...cd, ind: 'cfF' } : cd)) } : r)) }, r = E.ev(G, S, false);
      line.push(`с ${from}: ${E.d(r, base).toFixed(3)}`); }
    console.log(`  ${t.tag} | ${line.join(' | ')}`); } }
fs.writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent4e_loop9.json', JSON.stringify(rows.map(({ S, ...r }) => r)));
