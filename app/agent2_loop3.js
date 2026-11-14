/* Агент 2, круг 3: покупки ближе к дну и «размазаннее» по дну.
   H3a: лесенка капитуляции по страху: кроме «страх < 10 → 25%», «страх < 12/15/20 → 10/25%» (сразу после капитуляции или перед продажами).
   H3b: отложенная покупка после капитуляции (как удачная отложенная после выноса): за последние 20/40 дней был страх < 10,
        сегодня первый день, когда страх поднялся выше 20/25/30 → 25/50% резерва.
   H3c: отложенная после подтверждённой паники: за 20/40 дней была паника в стейблах с выносом OI (< −8%), сегодня паника кончилась
        (usdt < 1,07 / < 1,03) — первый день → 25/50%.
   H3d: второй уровень выноса плеч: OI < −20/−24% → 10/25% (после правила −28%).
   Запуск: node app/agent2_loop3.js */
const A = require('./agent2_sim.js');
const { c } = A;
// индикаторы «после бури» (только прошлое): была ли причина за w дней и первый день условия выхода
A.EXTRA.push((X) => {
  const n = X.n, I = X.ind;
  const after = (key, cause, end, w) => { const on = new Float64Array(n), f = new Float64Array(n); let last = -1e9;
    for (let i = 0; i < n; i++) { if (cause(i)) last = i; on[i] = i - last < w && !cause(i) && end(i) ? 1 : 0; f[i] = on[i] && !(i > 0 && on[i - 1]) ? 1 : 0; }
    I[key] = f; };
  for (const w of [20, 40]) {
    for (const x of [20, 25, 30]) after(`dcap${w}_${x}`, (i) => I.fng[i] < 10, (i) => I.fng[i] > x, w);
    for (const u of [1.07, 1.03]) after(`dpan${w}_${Math.round(u * 100)}`, (i) => I.usdt[i] > 1.07 && I.othd[i] < 25 && I.oidd30[i] < -8, (i) => I.usdt[i] < u, w);
  }
});
const G = A.groups(), base = A.ev(G, A.MAIN);
const M = A.MAIN.rules, iCap = M.findIndex((r) => r.conds.length === 1 && r.conds[0].ind === 'fng'), iOI = M.findIndex((r) => r.conds.length === 1 && r.conds[0].ind === 'oidd30'),
  iDly = M.findIndex((r) => A.has(r, 'dly20_100f')), iSell = M.findIndex((r) => r.act < 0);
const ins = (at, ...R) => ({ ...A.MAIN, rules: [...M.slice(0, at), ...R, ...M.slice(at)] });
const rows = [];
const run = (tag, X, fam) => { const r = A.ev(G, X); r.tag = tag; r.fam = fam; r.dd = A.d(r, base); rows.push(r); console.log(A.show(tag, r, base)); };
console.log(A.HDR); console.log(A.show('основа', base, base));
console.log('\nH3a: лесенка капитуляции');
for (const T of [12, 15, 20]) for (const f of [0.1, 0.25]) { const R = { act: 1 + f, conds: [c('fng', '<', T)] };
  run(`страх < ${T} → ${f * 100}% (после капитуляции)`, ins(iCap + 1, R), 'a1'); run(`страх < ${T} → ${f * 100}% (перед продажами)`, ins(iSell, R), 'a2'); }
console.log('\nH3b: отложенная после капитуляции');
for (const w of [20, 40]) for (const x of [20, 25, 30]) for (const f of [0.25, 0.5]) run(`страх < 10 за ${w} дн, сегодня впервые > ${x} → ${f * 100}%`, ins(iDly + 1, { act: 1 + f, conds: [c(`dcap${w}_${x}`, '>', 0.5)] }), 'b');
console.log('\nH3c: отложенная после подтверждённой паники');
for (const w of [20, 40]) for (const u of [107, 103]) for (const f of [0.25, 0.5]) run(`паника с выносом за ${w} дн, сегодня usdt < ${u / 100} впервые → ${f * 100}%`, ins(iDly + 1, { act: 1 + f, conds: [c(`dpan${w}_${u}`, '>', 0.5)] }), 'c');
console.log('\nH3d: второй уровень выноса плеч');
for (const T of [16, 20, 24]) for (const f of [0.1, 0.25]) { const R = { act: 1 + f, conds: [c('oidd30', '<', -T)] };
  run(`OI < −${T}% → ${f * 100}% (сразу после −28%)`, ins(iOI + 1, R), 'd1'); run(`OI < −${T}% → ${f * 100}% (перед продажами)`, ins(iSell, R), 'd2'); }
console.log('\nлучшие 12:');
for (const r of rows.sort((a, b) => b.dd - a.dd).slice(0, 12)) console.log(A.show(r.tag, r, base));
console.log('\nпрошли строгую проверку:'); for (const r of rows.filter((r) => A.passes(r, base))) console.log(A.show(r.tag, r, base));
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent2_loop3.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, fam: r.fam, dd: r.dd, pass: A.passes(r, base), sel: r.sel, ex: r.ex, rnd: r.rnd, n100: r.n100, m: r.m }))));
