/* Круг 9: сочетания находок. Основа K1 = B + тихая вершина 40% (круг 8). Добавки: продажа на жадности > 70 по 2% (круг 3),
   подтверждение паники выносом плеч OI < −8%, иначе 10% (круг 2), мягкие доли паники ×0,6 (круг 1).
   Проверка на отборе, экзамене, 50 случайных, 100 новых + метрики; кандидаты с группами правил сохраняются для портфеля с маржой.
   Запуск: node app/agent_loop9.js <куда.json> */
const S = require('./agent_sim.js');
const { B, c } = S;
const G = S.groups(['sel', 'ex', 'rnd', 'n100']);
const GRP = [1, 1, 2, 2, 0, 3, 2, 4, 4, 3, 4, 4];
const Bg = { base: 1, rules: B.rules.map((r, i) => ({ ...r, grp: GRP[i] })) };
const qt = (S0, q) => ({ base: 1, rules: S0.rules.map((r) => (r.conds.length === 1 && r.conds[0].ind === 'qt' ? { ...r, act: -q } : r)) });
const greed = (S0, g = 70, a = 0.02) => ({ base: 1, rules: [...S0.rules, { act: -a, conds: [c('fng', '>', g)], grp: 4 }] });
const oi = (S0, v = -8, lo = 1.1) => { const rules = []; S0.rules.forEach((r, i) => { if (r.grp === 2) rules.push({ ...r, conds: [...r.conds, c('oidd30', '<', v)] }, { ...r, act: Math.min(r.act, lo), grp: 5 }); else rules.push(r); }); return { base: 1, rules }; };
const soft = (S0, f = 0.6) => ({ base: 1, rules: S0.rules.map((r) => (r.grp === 2 ? { ...r, act: +(1 + (r.act - 1) * f).toFixed(4) } : r)) });
const K1 = qt(Bg, 0.4);
const C = { B: Bg, 'K1: B + тихая вершина 40%': K1, 'K1 + тихая вершина 30%': qt(Bg, 0.3), 'K1 + тихая вершина 50%': qt(Bg, 0.5),
  'K2: K1 + жадность>70 2%': greed(K1), 'K3: K1 + подтверждение OI': oi(K1), 'K4: K1 + жадность + OI': greed(oi(K1)), 'K5: K1 + паника ×0,6': soft(K1), 'K6: K1 + жадность>72 2%': greed(K1, 72) };
const R = Object.entries(C).map(([tag, St]) => ({ tag, S: St, ...S.evalAll(G, St, true) })), b = R[0];
const d = (r) => (S.inc(r) - S.inc(b) >= 0 ? '+' : '') + (S.inc(r) - S.inc(b)).toFixed(3);
console.log(S.HDR + ' | 100 новых мед/плюс/пол+ | доход | ✔\n');
for (const r of R) console.log(`${S.line(r)} | ${r.n100.med.toFixed(0)}/${r.n100.pos}/${r.n100.hpos} | ${d(r)} ${S.passes(r, b) ? '✔' : '·'} | ${r.tag}\n      ${S.fmtM(r.m)}`);
require('fs').writeFileSync(process.argv[2], JSON.stringify(C));
