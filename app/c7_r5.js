/* c7, круг 5: молодые монеты (PUMP, PENGU, FARTCOIN, USELESS, HYPE — combo7 их почти не меняет: К1/К4 — с возраста 365, эйфория — 540, rel/corr/beta — 180).
   Гипотезы: (а) после листинга монеты в среднем дешевеют — первые N дней копить взнос (резерв потом тратят паника/фитили/разворот);
   (б) молодым монетам продажи на страхе/вершине — другой размер; (в) фитили раньше (возраст > 60 → 14/30). Запуск: node c7_r5.js (лог scratchpad/c7/r5.txt) */
const C = require('./c7_lib.js'), { L, c } = C;
C.tee('r5');
// диагностика: средний избыточный лог-рост монеты к BTC за окна возраста (монеты с началом ряда после 2019-06 — ряд ≈ листинг), 81 + 100 новых
const G = L.G, T0 = C.T('2019-06-01'); const W = [[0, 30], [30, 90], [90, 180], [180, 365], [365, 730]]; const acc = W.map(() => []);
for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const X of G[g]) { if (X.ind.t[0] < T0 || X.name === 'BTC') continue; const b = X.ind.btcp;
  W.forEach(([a, z], k) => { if (X.n <= z || !b || !(b[a] > 0) || !(b[z] > 0)) return; acc[k].push(Math.log(X.c[z] / X.c[a]) - Math.log(b[z] / b[a])); }); }
const md = (v) => { const s = [...v].sort((x, y) => x - y); return s[s.length >> 1]; };
console.log('избыточный лог-рост к BTC по возрасту ряда (монеты с 2019-06): ' + W.map(([a, z], k) => `${a}–${z} дн: медиана ${C.sg(md(acc[k]))}, средн ${C.sg(acc[k].reduce((p, q) => p + q, 0) / acc[k].length)}, монет ${acc[k].length}, падали ${acc[k].filter((x) => x < 0).length}`).join(' | '));
const add = (rule) => { const S = L.clone(C.mini); S.rules.push(rule); return S; };
console.log('--- (а) первые N дней ряда: взнос копить / половина взноса (правилом последним — только дни без сигнала) ---');
for (const N of [30, 60, 90, 180, 365]) { C.run(`age < ${N} → копить`, add({ act: 1e-6, conds: [c('age', '<', N)], f: 'young' }), C.polM2()); C.run(`age < ${N} → ½ взноса`, add({ act: 0.5, conds: [c('age', '<', N)], f: 'young' }), C.polM2()); }
console.log('--- (б) молодые (age < A): страх / вершина / памп ×m ---');
for (const A of [180, 365]) for (const f of ['fear', 'top', 'pump']) for (const m of [0.5, 1.5]) {
  const extra = (ctx, ff, a) => (ff === f && !(ctx.X.ind.age[ctx.j] > A) && a < 0 ? C.sellAct(a, m) : a);
  C.run(`age < ${A}: ${f} ×${m}`, C.mini, C.polM2({ extra }));
}
console.log('--- (в) фитили с возраста 14 / 30 / 90 дней (сейчас 60) ---');
for (const A of [14, 30, 90]) { const p = C.polM2(); p.wick = { ...p.wick, age: A }; C.run(`фитили age > ${A}`, C.mini, p); }
