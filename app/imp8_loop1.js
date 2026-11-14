/* imp8, круг 1: удаление логических блоков основы по одному и парами. Запуск: node app/imp8_loop1.js <out.json> */
const I = require('./imp8_sim.js'); const { K } = I; const fs = require('fs');
const G = I.load(); const base = K.ev(G, I.BASE, false);
const out = [];
const run = (t, S) => { const r = K.ev(G, S, false); const o = { t, n: S.rules.length, d: K.d(r, base), pass: K.passes(r, base), why: K.why(r, base), sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med, bw: ['sel', 'ex', 'rnd'].map((g) => K.bw(r, base, g)) }; out.push(o); console.log(`${o.d >= 0 ? '+' : ''}${o.d.toFixed(3)} ${o.pass ? '✔' : '·'} ${K.line(r)} | ${t} | ${o.why}`); return o; };
console.log('основа', K.line(base));
const singles = [];
for (const [t, idx] of Object.entries(I.UNITS)) singles.push([t, run(t, I.drop(I.BASE, idx))]);
for (const [t, f] of Object.entries(I.MODS)) singles.push([t, run(t, I.drop(I.BASE, [], f))]);
// пары среди блоков с потерей < 0.05
const cheap = singles.filter(([, o]) => o.d > -0.05).map(([t]) => t);
console.log('\nдешёвые:', cheap.join(' | '));
const sel = (t) => (I.UNITS[t] ? [I.UNITS[t], () => false] : [[], I.MODS[t]]);
for (let a = 0; a < cheap.length; a++) for (let b = a + 1; b < cheap.length; b++) {
  const [ia, fa] = sel(cheap[a]), [ib, fb] = sel(cheap[b]);
  run(`${cheap[a]} + ${cheap[b]}`, I.drop(I.BASE, [...ia, ...ib], (r) => fa(r) || fb(r)));
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
