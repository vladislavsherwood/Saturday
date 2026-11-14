/* Кандидаты прошлых кругов в JSON с группами правил для портфеля с маржой (grp: 0 взнос, 1 дно, 2 паника, 3 разворот, 4 продажа, 5 паника без подтверждения — без плеча).
   Запуск: node app/agent_cands.js <куда.json> */
const S = require('./agent_sim.js');
const { B, c } = S;
const GRP = [1, 1, 2, 2, 0, 3, 2, 4, 4, 3, 4, 4];
const Bg = { base: 1, rules: B.rules.map((r, i) => ({ ...r, grp: GRP[i] })) };
const scalePanic = (S0, f) => ({ base: 1, rules: S0.rules.map((r) => (r.grp === 2 ? { ...r, act: +(1 + (r.act - 1) * f).toFixed(4) } : r)) });
const confOI = (oi, lo) => { const rules = []; Bg.rules.forEach((r, i) => { if ([2, 3, 6].includes(i)) rules.push({ ...r, conds: [...r.conds, c('oidd30', '<', oi)] }, { ...r, act: Math.min(r.act, lo), grp: 5 }); else rules.push(r); }); return { base: 1, rules }; };
const add = (S0, rule) => ({ base: 1, rules: [...S0.rules, { ...rule, grp: 4 }] });
const C = {
  B: Bg,
  'паника ×0,6': scalePanic(Bg, 0.6),
  'подтверждение OI<-8%, иначе 10%': confOI(-8, 1.1),
  'подтверждение OI<-10%, иначе 10%': confOI(-10, 1.1),
  'жадность>70 → продать 2%': add(Bg, { act: -0.02, conds: [c('fng', '>', 70)] }),
  'OI<-8% иначе 10% + жадность>70 2%': add(confOI(-8, 1.1), { act: -0.02, conds: [c('fng', '>', 70)] }),
};
require('fs').writeFileSync(process.argv[2], JSON.stringify(C, null, 0));
const G = S.groups(['sel', 'ex', 'rnd', 'n100']);
for (const k in C) { const r = S.evalAll(G, C[k], true); console.log(`${S.line(r)} | ${r.n100.med.toFixed(0)}/${r.n100.pos}/${r.n100.hpos} | ${k}`); }
