/* Отложенная паника для всех монет? combo4 с порогом возраста A = 0 / 180 / 365 / 540 (основа) / 730 — строгая к combo4 и отдельно молодые монеты.
   Запуск: node age_defer.js */
const P2 = require('./panicx_p2.js'), P = P2.P, Z = P.Z;
const pol = (A) => P2.Boost(2, { k: 0, A });
P.setBaseline(P.base, pol(540));
const base = P.evc(P.base, pol(540), ['sel', 'ex', 'rnd', 'n100']);
for (const A of [0, 180, 365, 540, 730]) {
  P.report(`A ${A}`, P.base, pol(A), { n100: true });
  const R = P.evc(P.base, pol(A), ['sel', 'ex', 'rnd', 'n100']);
  // молодые монеты: история < 900 дней — сколько половин лучше/хуже основы и средний лог-прирост
  let n = 0, up = 0, dn = 0, t = 0; const names = [];
  for (const g in R) R[g].forEach((x, i) => { const X = P2.G[g][i]; if (X.n >= 900) return; const y = base[g][i];
    for (const k of ['h1', 'h2']) { n++; const d = Math.log1p(x[k] / 100) - Math.log1p(y[k] / 100); t += d; if (d > 0.005) up++; if (d < -0.005) { dn++; names.push(`${x.name}:${k} ${y[k].toFixed(0)}→${x[k].toFixed(0)}%`); } } });
  console.log(`   молодые (< 900 дн): половин ${n}, лучше ${up}, хуже ${dn}, средний лог ${(t / n).toFixed(3)} | хуже всех: ${names.slice(0, 8).join(', ')}`);
}
