/* Агент 4E, круг 3: возврат в рынок. Эпизоды «BTC +X% за 30 дней» (X = 15) с 2018 — что говорили новые ряды в первый день,
   и чем хорошие возвраты (BTC через 90 дней в плюсе) отличаются от ложных (2025-07, 2026-04 и др.).
   Критерий (заранее): подтверждающий признак годится, если при пороге 15 он отсекает ≥ 2/3 ложных эпизодов и сохраняет ≥ 80% хороших,
   и делает это при соседних порогах признака. Запуск: node app/agent4e_loop3.js */
const E = require('./agent4e_sim.js');
const G = E.groups(['sel']);
const B = G.sel.find((x) => x.name === 'BTC'), n = E.T1 - E.T0 + 1, I = B.ind, C = E.CAL;
const IN = {}; for (const k of Object.keys(I)) IN[k] = new Float64Array(n).fill(NaN);
for (let i = 0; i < B.n; i++) { const d = B.t[i] - E.T0; if (d >= 0) for (const k in IN) IN[k][d] = I[k][i]; }
const from = E.dayOf('2018-01-01');
const F = ['btcath', 'fng', 'fund30', 'afund30', 'efund30', 'prem7b', 'stab30', 'stab90', 'tvl30', 'hrib', 'hribup', 'eoic30', 'mvrv', 'mvrve', 'y10d90', 'y2d90', 'dxy90', 'dxy30', 'curve', 'feesr', 'adrbr'];
const val = (k, d) => (C[k] ? C[k][d] : IN[k][d]);
for (const X of [15, 20]) {
  const Ep = E.episodes((d) => IN.btcr30[d] > X, { from, gap: 30 });
  console.log(`\n== BTC +${X}% за 30 дней: эпизодов ${Ep.length} (первый день; доходность 30/90/180)`);
  console.log('дата        макс30  30/90/180       ' + F.map((k) => k.padStart(7)).join(''));
  for (const e of Ep) { let mx = 0; for (let j = e.d; j < e.d + e.days + 30 && j < n; j++) if (IN.btcr30[j] > mx) mx = IN.btcr30[j];
    e.mx = mx; console.log(`${e.date} ${mx.toFixed(1).padStart(6)} ${[e.r30, e.r90, e.r180].map((x) => (isNaN(x) ? '—' : x.toFixed(0))).join('/').padEnd(14)} ${F.map((k) => { const v = val(k, e.d); return (isNaN(v) ? '·' : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)).padStart(7); }).join('')}`); }
}

// ---------- в стратегии: порог разворота t во всех трёх правилах × подтверждение новыми данными в двух правилах возврата резерва ----------
// подтверждение «молчит» там, где ряда нет: индикатор ok_* = 1, если данных нет или условие выполнено
const OK = [['stab30', '>', 0], ['stab30', '>', 1], ['stab30', '>', 2], ['stab14', '>', 0], ['tvl30', '>', 0], ['tvl30', '>', 5],
  ['y10d90', '<', 0], ['y10d90', '<', 0.25], ['y10d90', '<', 0.5], ['y2d90', '<', 0.25], ['dxy90', '<', 0], ['dxy90', '<', 2], ['dxy30', '<', 0],
  ['hribup', '>', 0], ['hribup', '>', 14], ['afund30', '<', 0.7], ['afund30', '<', 1], ['prem7b', '>', -0.03], ['efund30', '<', 1], ['adrbr', '>', 0.95]];
const okName = ([k, op, v]) => `ok_${k}${op === '>' ? 'g' : 'l'}${v}`;
E.EXTRA4.push((X) => { for (const o of OK) { const [k, op, v] = o, s = X.ind[k], a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) a[i] = isNaN(s[i]) ? 1 : (op === '>' ? s[i] > v : s[i] < v) ? 1 : 0; X.ind[okName(o)] = a; } });
const GG = E.groups(['sel', 'ex', 'rnd']), base = E.ev(GG, E.W25, false);
const { c } = E;
const mk = (t, ok) => ({ ...E.W25, rules: E.W25.rules.map((r) => { if (!E.has(r, 'btcr30')) return r; const conds = r.conds.map((cd) => (cd.ind === 'btcr30' ? { ...cd, v: t } : cd)); return ok && r.act > 1 ? [{ ...r, conds: [...conds, c(okName(ok), '>', 0.5)] }, { ...r, act: 1, conds }] : { ...r, conds }; }).flat() });
// без подтверждения правило возврата не исчезает, а держит позицию (только взнос) — иначе ниже срабатывают продажи
const TS = [12, 15, 17, 18, 19, 20, 22, 25];
const rows = [];
console.log('\n== в стратегии: доход к W25 (сумма лог-медиан), ✔ — строгая проверка; столбцы — порог BTC за 30 дней');
console.log('подтверждение'.padEnd(22) + TS.map((t) => String(t).padStart(9)).join(''));
for (const ok of [null, ...OK]) {
  const cells = TS.map((t) => { const r = E.ev(GG, mk(t, ok), false), d = E.d(r, base); rows.push({ ok: ok && okName(ok), t, d, pass: E.passes(r, base), sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med }); return `${d >= 0 ? '+' : ''}${d.toFixed(2)}${E.passes(r, base) ? '✔' : ' '}`.padStart(9); });
  console.log((ok ? okName(ok) : 'нет (W25)').padEnd(22) + cells.join(''));
}
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent4e_loop3.json', JSON.stringify(rows));
