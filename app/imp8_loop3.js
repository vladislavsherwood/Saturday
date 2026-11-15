/* imp8, круг 3: вперёд по времени. Для Y = 2021…2024: обучение — окно «вся история монеты до 1 января Y» (старт с нуля), проверка —
   окно «с 1 января Y до конца» (старт с нуля в Y). Монеты: отбор + экзамен + 50 случайных (81), окно ≥ 365 дней.
   (а) хрупкие пороги подбираются покоординатно по обучению (2 прохода, при равенстве — ближе к S2, для usdtd — «нет условия»);
   (б) вклад каждого блока (удаление) на обучении и на проверке. Запуск: node app/imp8_loop3.js <out.json> */
const I = require('./imp8_sim.js'); const { K } = I; const fs = require('fs');
const G = I.load(); const ALL = [...G.sel, ...G.ex, ...G.rnd]; const S2 = I.simplify();
const score = (S, y0, y1) => { const e = ALL.map((X) => I.EW(X, S, y0, y1)).filter((v) => v != null); return { lm: I.lm(e), med: K.med(e), n: e.length, pos: e.filter((v) => v > 0).length }; };
const setThr = (S, ind, op, v0, v) => ({ ...S, rules: S.rules.map((r) => ({ ...r, conds: v === null ? r.conds.filter((y) => !(y.ind === ind && y.op === op && y.v === v0)) : r.conds.map((y) => (y.ind === ind && y.op === op && y.v === v0 ? { ...y, v } : y)) })) });
const P = [['usdtd', '<', 7.6, [null, 6.5, 7.0, 7.4, 7.6, 7.8, 8.0]], ['fng', '<', 52, [48, 50, 52, 54, 56]], ['othd', '<', 25, [20, 22.5, 25, 27.5, 30]],
  ['btcr30', '>', 20, [15, 17.5, 20, 22.5, 25]], ['oth90', '>', 1, [0.8, 0.9, 1, 1.1, 1.2]], ['fund30', '>', 2, [1.5, 2, 2.5, 3]], ['usdt', '>', 1.07, [1.05, 1.06, 1.07, 1.08, 1.09]], ['oidd30', '<', -28, [-22, -25, -28, -31, -34]]];
const build = (vals) => P.reduce((S, [ind, op, v0], k) => setThr(S, ind, op, v0, vals[k]), S2);
const out = { tune: {}, blocks: {} };
for (const Y of [2021, 2022, 2023, 2024]) {
  let cur = P.map((p) => p[2]); let best = score(build(cur), null, Y).lm;
  for (let pass = 0; pass < 2; pass++) for (let k = 0; k < P.length; k++) {
    for (const v of P[k][3]) { if (v === cur[k]) continue; const t = [...cur]; t[k] = v; const s = score(build(t), null, Y).lm; if (s > best + 1e-9 || (Math.abs(s - best) < 1e-9 && v === null)) { best = s; cur = t; } }
  }
  const trS2 = score(S2, null, Y), teS2 = score(S2, Y, null), teT = score(build(cur), Y, null), trT = score(build(cur), null, Y);
  const noU = setThr(S2, 'usdtd', '<', 7.6, null), teNoU = score(noU, Y, null);
  out.tune[Y] = { vals: cur, trS2, trT, teS2, teT, teNoU };
  console.log(`Y=${Y}: подобрано ${P.map((p, k) => p[0] + p[1] + (cur[k] === null ? 'нет' : cur[k])).join(' ')}`);
  console.log(`   обучение: S2 мед ${trS2.med.toFixed(0)}% (${trS2.pos}/${trS2.n}) → подобр. ${trT.med.toFixed(0)}% | проверка: S2 ${teS2.med.toFixed(1)}% (${teS2.pos}/${teS2.n}), подобр. ${teT.med.toFixed(1)}% (${teT.pos}), S2 без usdtd ${teNoU.med.toFixed(1)}% (${teNoU.pos}) | Δlm проверки подобр.−S2 ${(teT.lm - teS2.lm).toFixed(3)}`);
  // вклад блоков (индексы S2)
  const B = {}; const rows = [];
  const units = { 'разворот #14': (r) => r.act === 2, 'страх 16%': (r) => r.act < 0 && I.has(r, 'fng') && r.conds.find((x) => x.ind === 'fng').v === 52, 'страх 30%': (r) => r.act < 0 && I.has(r, 'fng') && r.conds.find((x) => x.ind === 'fng').v === 40,
    'паника #6-8': (r) => r.act > 1 && I.has(r, 'usdt') && !I.has(r, 'fng'), 'паника+fng<40 #3-5': (r) => r.act > 1 && I.has(r, 'usdt') && I.has(r, 'fng'), 'fng<10': (r) => I.has(r, 'fng') && r.act === 1.25 && r.conds.length === 1,
    'отложенная': (r) => I.has(r, 'dly20_100f'), 'вынос OI': (r) => r.conds.length === 1 && I.has(r, 'oidd30'), 'охрана #9': (r) => r.act === 1, 'фандинг 5%': (r) => I.has(r, 'fund30'),
    'узкая тихая': (r) => I.has(r, 'qt'), 'широкая тихая': (r) => I.has(r, 'oth90'), 'возврат': (r) => I.has(r, 'ago_qt'), 'памп': (r) => I.has(r, 'up90'), 'C': (r) => I.has(r, 'rel180'), 'C6': (r) => I.isC6(r) };
  for (const [nm, f] of Object.entries(units)) { const S = I.drop(S2, [], f); const tr = score(S, null, Y), te = score(S, Y, null); B[nm] = { tr: trS2.lm - tr.lm, te: teS2.lm - te.lm }; rows.push(`${nm} ${B[nm].tr >= 0 ? '+' : ''}${B[nm].tr.toFixed(3)}/${B[nm].te >= 0 ? '+' : ''}${B[nm].te.toFixed(3)}`); }
  out.blocks[Y] = B; console.log('   вклад блока (обучение/проверка, Δ лог-медианы): ' + rows.join(' | '));
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
