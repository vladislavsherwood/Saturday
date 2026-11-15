/* imp8, круг 4: бутстрэп по монетам и периодам. Матрица итогов «монета × год старта» (старт с нуля 1 января Y, до конца; Y = вся история,
   2018…2025; окно ≥ 365 дней) для S2 и вариантов; 2000 повторов: монеты (81) и годы старта (9) с возвращением; медиана итога и парная
   разница лог-медиан варианта и S2. Запуск: node app/imp8_loop4.js <out.json> */
const I = require('./imp8_sim.js'); const { K } = I; const fs = require('fs');
const G = I.load(); const ALL = [...G.sel, ...G.ex, ...G.rnd]; const S2 = I.simplify();
const setThr = (S, ind, op, v0, v) => ({ ...S, rules: S.rules.map((r) => ({ ...r, conds: v === null ? r.conds.filter((y) => !(y.ind === ind && y.op === op && y.v === v0)) : r.conds.map((y) => (y.ind === ind && y.op === op && y.v === v0 ? { ...y, v } : y)) })) });
const V = { S2, 'без узкой тихой': I.drop(S2, [], (r) => I.has(r, 'qt')), 'oth90>0,9': setThr(S2, 'oth90', '>', 1, 0.9),
  'без узкой + oth90>0,9': setThr(I.drop(S2, [], (r) => I.has(r, 'qt')), 'oth90', '>', 1, 0.9), 'без фандинга 5%': I.drop(S2, [], (r) => I.has(r, 'fund30')),
  'без C6': I.drop(S2, [], I.isC6), 'без C': I.drop(S2, [], I.isC), 'без usdtd': setThr(S2, 'usdtd', '<', 7.6, null), 'fng<54': setThr(S2, 'fng', '<', 52, 54), 'fund30>2,2': setThr(S2, 'fund30', '>', 2, 2.2) };
const YS = [null, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const M = {}; for (const [k, S] of Object.entries(V)) M[k] = ALL.map((X) => YS.map((y) => I.EW(X, S, y, null)));
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const lmed = (m, cs, ys) => { const e = []; for (const c of cs) for (const y of ys) { const v = m[c][y]; if (v != null) e.push(v); } return I.lm(e); };
const NB = 2000, res = {}; const idxC = ALL.map((_, i) => i), idxY = YS.map((_, i) => i);
const draws = []; for (let b = 0; b < NB; b++) draws.push([idxC.map(() => Math.floor(rnd() * ALL.length)), idxY.map(() => Math.floor(rnd() * YS.length))]);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
const b0 = draws.map(([cs, ys]) => lmed(M.S2, cs, ys));
const pc = (lm) => (Math.expm1(lm) * 100).toFixed(0);
console.log(`S2: медиана итога (все монеты × годы) ${pc(lmed(M.S2, idxC, idxY))}%, бутстрэп 5/50/95%: ${pc(q(b0, 0.05))} / ${pc(q(b0, 0.5))} / ${pc(q(b0, 0.95))}%`);
// по годам старта
console.log('S2 по годам старта: ' + YS.map((y, j) => `${y || 'вся'} ${pc(lmed(M.S2, idxC, [j]))}%`).join(', '));
for (const k of Object.keys(V)) {
  if (k === 'S2') continue;
  const d = draws.map(([cs, ys], b) => lmed(M[k], cs, ys) - b0[b]);
  const pair = ALL.map((_, c) => YS.map((_, y) => (M[k][c][y] != null ? Math.log1p(M[k][c][y] / 100) - Math.log1p(M.S2[c][y] / 100) : null))).flat().filter((v) => v != null);
  res[k] = { full: lmed(M[k], idxC, idxY) - lmed(M.S2, idxC, idxY), p5: q(d, 0.05), p50: q(d, 0.5), p95: q(d, 0.95), pPos: d.filter((v) => v > 0).length / NB, better: pair.filter((v) => v > 0.005).length, worse: pair.filter((v) => v < -0.005).length, worstPair: Math.min(...pair) };
  const r = res[k];
  console.log(`${k.padEnd(24)} Δ лог-мед. ${r.full >= 0 ? '+' : ''}${r.full.toFixed(3)} | бутстрэп 5/50/95%: ${r.p5.toFixed(3)} / ${r.p50.toFixed(3)} / ${r.p95.toFixed(3)} | P(>0) ${(r.pPos * 100).toFixed(0)}% | пар «монета×год» лучше/хуже ${r.better}/${r.worse}, худшая пара ${(r.worstPair * 100).toFixed(1)}%`);
  console.log('   по годам старта Δ: ' + YS.map((y, j) => `${y || 'вся'} ${(lmed(M[k], idxC, [j]) - lmed(M.S2, idxC, [j])).toFixed(3)}`).join(', '));
}
fs.writeFileSync(process.argv[2], JSON.stringify({ res, b0: [q(b0, 0.05), q(b0, 0.5), q(b0, 0.95)] }, null, 1));
