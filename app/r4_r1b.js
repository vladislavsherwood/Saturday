/* r4, круг 1 (продолжение): упрощение по парам «класс продаж × модификатор» и жадное объединение.
   Классы: fear40 (fng<40 & usdtd<7,6), fear52, fund, qt, wide (btcath<15 & oth90>1), pump (up90>300). Модификаторы: C (rel180<−15), M (мем), Bl (isbig), Bb (corr180 & vol180), A (isalt).
   Убрать модификатор у класса = удалить копии правил класса с его индикатором. Критерий (заранее): строгая ✔ везде, суммарный доход ≥ −0,005; затем 100 новых: средний лог ≥ −0,002.
   Запуск: node r4_r1b.js */
const L = require('./r4_lib.js'), { S0, Z, P } = L;
const has = (r, ind, op, v) => r.conds.some((x) => x.ind === ind && (op == null || (x.op === op && x.v === v)));
const cls = (r) => { if (r.act >= 0) return null; if (has(r, 'usdt')) return 'euph'; if (has(r, 'fng', '<', 40)) return 'fear40'; if (has(r, 'fng', '<', 52)) return 'fear52'; if (has(r, 'fund30')) return 'fund'; if (has(r, 'qt')) return 'qt'; if (has(r, 'up90')) return 'pump'; if (has(r, 'btcath')) return 'wide'; return 'as'; };
const MOD = { C: 'rel180', M: 'meme', Bl: 'isbig', Bb: 'corr180', A: 'isalt' };
const drop = (S, q, m) => { const T = L.clone(S); T.rules = T.rules.filter((r) => !(cls(r) === q && has(r, MOD[m]))); return T; };
const B0 = P.evc(S0, L.pol0);
const ml = (S) => { const R = P.evc(S, L.pol0); return Z.mlog(R, B0, 'all', ['sel', 'ex', 'rnd']); };
const cand = [];
for (const q of ['fear40', 'fear52', 'fund', 'qt', 'wide', 'pump']) for (const m of Object.keys(MOD)) {
  const S = drop(S0, q, m); if (S.rules.length === S0.rules.length) continue;
  const r = L.run(`${q} без ${m} (−${S0.rules.length - S.rules.length})`, S, L.pol0, { quiet: true }), q81 = ml(S);
  console.log(r.txt.slice(0, 150), `| 81 монета: лог ${L.sg(q81.m)} ${q81.u}/${q81.d}`);
  cand.push({ q, m, d: r.d, ok: !r.w, n: S0.rules.length - S.rules.length });
}
// жадно: сначала те, что проходят по одному, по убыванию дохода
let S = L.clone(S0); const taken = [];
for (const k of cand.filter((x) => x.ok && x.d >= -0.005).sort((a, b) => b.d - a.d)) {
  const T = drop(S, k.q, k.m); if (T.rules.length === S.rules.length) continue;
  const r = L.run('', T, L.pol0, { quiet: true });
  if (!r.w && r.d >= -0.005) { S = T; taken.push(`${k.q}−${k.m}`); }
}
console.log('жадное объединение:', taken.join(', '), '| правил', S.rules.length);
const r = L.run('упрощённая', S, L.pol0, { n100: true }), q81 = ml(S);
console.log(`81 монета: лог ${L.sg(q81.m)} ${q81.u}/${q81.d}`);
console.log(S.rules.map((r, i) => `${i}: ${r.act} ${r.conds.map((c) => c.ind + c.op + c.v).join(' & ')}`).join('\n'));
module.exports = { cls, drop, MOD, has };
