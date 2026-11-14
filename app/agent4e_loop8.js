/* Агент 4E, круг 8: продажа на росте OI ETH — разово или ограниченно по дням, а не каждый день сигнала.
   Эпизод = дни с OI ETH за 30 дн. > порога, склеенные с разрывом < 30 дней. Продажа X% только в первые k дней эпизода (k = 1, 3, 7, все).
   H8: разовая крупная продажа (40–80%) в начале эпизода даёт тот же доход и меньше вредит монетам, которые потом растут (NPC, TON).
   Критерий (заранее): плато ≥ +0,1 (OI 35/40/50 и 2 соседних размера), строгая проверка пройдена или 1 пункт, 100 новых не хуже W25.
   Запуск: node app/agent4e_loop8.js */
const E = require('./agent4e_sim.js');
const { c } = E;
const TH = [30, 35, 40, 50, 60];
E.EXTRA4.push((X) => { const o = X.ind.eoic30, n = X.n; for (const v of TH) { const a = new Float64Array(n).fill(NaN); let start = -1e9, last = -1e9;
  for (let i = 0; i < n; i++) { if (o[i] > v) { if (i - last >= 30) start = i; last = i; a[i] = i - start; } } X.ind['eoiday' + v] = a; } });   // день эпизода (0 — первый), NaN вне сигнала
const G = E.groups(['sel', 'ex', 'rnd', 'n100']), base = E.ev(G, E.W25, true);
const R = E.W25.rules, i13 = R.findIndex((r) => r.act === 2 && r.conds.length === 1 && r.conds[0].ind === 'btcr30');
const after = (rules) => ({ ...E.W25, rules: [...R.slice(0, i13 + 1), ...rules, ...R.slice(i13 + 1)] });
const rule = (v, k, a) => ({ act: -a, conds: k ? [c('eoiday' + v, '<', k - 0.5)] : [c('eoic30', '>', v)] });
console.log(E.HDR); console.log(E.show('W25', base, base));
const rows = [];
console.log('\nдоход к W25 / 100 новых (✔ строгая, ~ 1 пункт); пороги OI ETH 30 / 35 / 40 / 50 / 60');
for (const k of [1, 3, 7, 0]) for (const a of k === 1 ? [0.25, 0.4, 0.6, 0.8] : k === 3 ? [0.15, 0.25, 0.4] : [0.1, 0.25]) {
  const line = [];
  for (const v of TH) { const r = E.ev(G, after([rule(v, k, a)]), false), d = E.d(r, base), w = E.why(r, base), nf = w ? w.split('; ').length : 0;
    rows.push({ k, a, v, d, pass: E.passes(r, base), why: w, n100: r.n100.med, n100pos: r.n100.pos, n100h: r.n100.hpos }); line.push(`${d >= 0 ? '+' : ''}${d.toFixed(2)}${nf === 0 ? '✔' : nf === 1 ? '~' : ' '}/${r.n100.med.toFixed(0)}`); }
  console.log(`  ${k ? `первые ${k} дн.` : 'каждый день'} ${String(a * 100).padStart(2)}% | ${line.join('  ')}`);
}
const top = rows.filter((r) => r.d > 0.05).sort((x, y) => (y.pass - x.pass) || (x.why.split(';').length - y.why.split(';').length) || y.d - x.d).slice(0, 10);
console.log('\nлучшие:'); for (const t of top) console.log(`  первые ${t.k || 'все'} дн., OI > ${t.v}% → ${t.a * 100}%: ${t.d.toFixed(3)} | 100н ${t.n100.toFixed(0)}/${t.n100pos}/${t.n100h} | ${t.pass ? '✔' : t.why}`);
// подробно: лучший разовый
const b = rows.filter((r) => r.k === 1).sort((x, y) => (x.why.split(';').length - y.why.split(';').length) || y.d - x.d)[0];
const SB = after([rule(b.v, 1, b.a)]), rb = E.ev(G, SB, true);
console.log(`\nразовый лучший (OI > ${b.v}% → ${b.a * 100}%):`); console.log(E.show('разовый', rb, base) + ' | ' + E.why(rb, base));
for (const g of ['sel', 'ex', 'rnd', 'n100']) console.log(`  ${g}: лучше W25 на ${rb[g].e.filter((x, i) => x > base[g].e[i] + 0.5).length}, хуже на ${rb[g].e.filter((x, i) => x < base[g].e[i] - 0.5).length} из ${rb[g].n}`);
console.log('  ' + E.fmtM(rb.m));
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent4e_loop8.json', JSON.stringify(rows));

// ---------- сколько эпизодов делают доход: сигнал разрешён только с даты D (раньше — молчит) ----------
console.log('\nзависимость от эпизодов: правило работает только с даты (доход к W25 / 100 новых)');
for (const from of ['2021-12-01', '2023-01-01', '2024-01-01', '2024-07-01', '2025-01-01', '2025-12-01']) {
  const t0 = E.dayOf(from) + E.T0;
  for (const X of [...G.sel, ...G.ex, ...G.rnd, ...G.n100]) { const o = X.ind.eoic30, a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) a[i] = X.t[i] >= t0 ? o[i] : NaN; X.ind.eoicF = a; }
  const line = [];
  for (const [tag, rl] of [['каждый день OI > 40% → 25%', { act: -0.25, conds: [c('eoicF', '>', 40)] }], ['каждый день OI > 35% → 10%', { act: -0.1, conds: [c('eoicF', '>', 35)] }]]) { const r = E.ev(G, after([rl]), false); line.push(`${tag}: ${E.d(r, base) >= 0 ? '+' : ''}${E.d(r, base).toFixed(3)} / ${r.n100.med.toFixed(0)}`); }
  console.log(`  с ${from}: ${line.join(' | ')}`);
}
