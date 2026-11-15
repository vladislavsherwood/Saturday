/* imp8, круг 2: чувствительность S2 к каждому порогу и доле (×0,8/0,9/1,1/1,2). Пороги: все копии одного условия (ind, op, v) меняются вместе;
   у usdt и множителей меняется отклонение от 1. Доли: правило и его копии C/C6 масштабируются вместе (доля покупки act−1, продажи −act).
   Запуск: node app/imp8_loop2.js <out.json> */
const I = require('./imp8_sim.js'); const { K } = I; const fs = require('fs');
const G = I.load(); const S2 = I.simplify(); const base = K.ev(G, S2, false);
const F = [0.8, 0.9, 1.1, 1.2], out = [];
const run = (t, f, S) => { const r = K.ev(G, S, false); const o = { t, f, d: K.d(r, base), pass: K.passes(r, base), why: K.why(r, base), sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med }; out.push(o); return o; };
const sc = (ind, v, f) => (ind === 'usdt' ? +(1 + (v - 1) * f).toFixed(4) : ind === 'ago_qt' ? Math.round((v - 0.5) * f) + 0.5 : +(v * f).toFixed(4));
// пороги
const thr = new Map(); for (const r of S2.rules) for (const x of r.conds) if (!['dly20_100f', 'hi90'].includes(x.ind)) thr.set(`${x.ind}${x.op}${x.v}`, x);
for (const [k, x] of thr) {
  const row = F.map((f) => run(k, f, { ...S2, rules: S2.rules.map((r) => ({ ...r, conds: r.conds.map((y) => (y.ind === x.ind && y.op === x.op && y.v === x.v ? { ...y, v: sc(y.ind, y.v, f) } : y)) })) }));
  console.log(`порог ${k.padEnd(18)} ${row.map((o) => `${o.f}: ${o.d >= 0 ? '+' : ''}${o.d.toFixed(3)}${o.pass ? '✔' : '·'}`).join('  ')}`);
}
// доли
const key = (r) => JSON.stringify(r.conds.filter((x) => x.ind !== 'rel180' && !(x.ind === 'usdt' && x.v === 1.2)));
const fam = new Map(); S2.rules.forEach((r) => { if (r.act === 1) return; const k = key(r); if (!fam.has(k)) fam.set(k, r); });
for (const [k, r0] of fam) {
  const nm = `${r0.act > 1 ? 'покупка' : 'продажа'} ${r0.act} [${JSON.parse(k).map((x) => x.ind + x.op + x.v).join(' ')}]`;
  const row = F.map((f) => run(nm, f, { ...S2, rules: S2.rules.map((r) => (key(r) !== k ? r : { ...r, act: r.act > 1 ? 1 + Math.min(1, (r.act - 1) * f) : Math.max(-1, r.act * f) })) }));
  console.log(`доля ${nm.slice(0, 60).padEnd(60)} ${row.map((o) => `${o.f}: ${o.d >= 0 ? '+' : ''}${o.d.toFixed(3)}${o.pass ? '✔' : '·'}`).join('  ')}`);
}
// множители C и C6
const withK = (kc, k6) => { let S = { ...I.BEST.cautious.rules ? { base: 1, rules: I.BEST.cautious.rules } : null }; return S; };
const F0 = { base: 1, rules: I.BEST.cautious.rules }; // F + C6
for (const f of F) {
  const kC = 1 + 0.25 * f; out.push(run('C ×' + kC, f, I.simplify(K.withC(F0, kC))));
}
console.log('C ×1,25 → ' + out.filter((o) => o.t.startsWith('C ×')).map((o) => `${o.t}: ${o.d >= 0 ? '+' : ''}${o.d.toFixed(3)}${o.pass ? '✔' : '·'}`).join('  '));
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
