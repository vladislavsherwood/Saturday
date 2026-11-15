/* Круг 6: подтверждение по деривативам и страху — копия паники × m, если толпа в шортах (лонг/шорт lsr < v), страх резко растёт (fngd7 < −10),
   и вместе с разворотом usdt (upk10 < 0,96). С фильтром возраста монеты (age > 365) и без. Запуск: node panicx_r6.js */
const P = require('./panicx_sim.js'), { c } = P.Z, Z = P.Z;
const G = P.load();
for (const g in G) for (const X of G[g]) if (!X.ind.upk10) { const u = X.ind.usdt, a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { let m = -Infinity; for (let k = Math.max(0, i - 9); k <= i; k++) if (u[k] > m) m = u[k]; a[i] = u[i] / m; } X.ind.upk10 = a; }
const sc = (r, k) => +(1 + Math.min(1, (r.act - 1) * k)).toFixed(6);
// наборы копий: [[условия], m] — от первого к последнему, перед исходным правилом
const V = (sets) => P.mapP((r) => [...sets.map(([cs, m]) => ({ act: sc(r, m), conds: [...r.conds, ...cs.map(([a, b, v]) => c(a, b, v))] })), r]);
const why = (r) => { const { BS } = P.baseline(); return Z.SEGS.map((s) => { const w = Z.strict(r.RS, BS, s); return w.length ? `${s}: ${w.join(',')}` : ''; }).filter(Boolean).join(' | '); };
const run = (nm, S) => { const r = P.report(nm, S, null, { quiet: true }); const L = r.line.replace(/ (sel|ex|rnd):\S*/g, ''); console.log(L.replace(/ +/g, ' '), '||', why(r)); return r; };
P.report('основа', P.base, null);
const AG = ['age', '>', 365];
for (const ag of [[], [AG]]) {
  const t = ag.length ? ' age>365' : '';
  for (const v of [0.8, 0.9, 1.0]) for (const m of [1.5, 2]) run(`lsr<${v} ×${m}${t}`, V([[[['lsr', '<', v], ...ag], m]]));
  for (const v of [-10, -15]) for (const m of [1.5, 2]) run(`fngd7<${v} ×${m}${t}`, V([[[['fngd7', '<', v], ...ag], m]]));
  for (const m of [1.5, 2]) run(`upk10<0.96|lsr<0.9 ×${m}${t}`, V([[[['upk10', '<', 0.96], ...ag], m], [[['lsr', '<', 0.9], ...ag], m]]));
}
