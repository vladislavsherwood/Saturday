/* hv, круг 2: «памп в медвежьем рынке» (правила 53–55: btcath > 20 и up90 > 300 → продать 10%; отстающая 12,5%; отстающий мем 20%) у волатильной монеты раньше и крупнее.
   Перед каждым из правил 53–55 — копия с hvv > T: порог up90 > U (вместо 300), доля × m; вариант — порог BTC ниже ATH > B (вместо 20). */
const H = require('./hv_lib.js'), { c } = H;
const PB = (r, k) => k >= 52 && k <= 54;
const mod = (T, U, m, B = 20) => (r) => { for (const x of r.conds) { if (x.ind === 'up90') x.v = U; if (x.ind === 'btcath') x.v = B; } r.conds.push(...H.HV(T)); r.act = H.mul(m)(r.act); return r; };
H.head();
H.ev('combo5', H.S5);
for (const T of [100, 115, 130]) for (const U of [150, 200, 250, 300]) for (const m of [1, 1.5, 2]) {
  if (U === 300 && m === 1) continue;
  H.ev(`T${T} up90>${U} ×${m}`, H.preMod(H.S5, PB, mod(T, U, m)));
}
for (const B of [10, 15]) for (const U of [200, 300]) for (const m of [1, 1.5]) H.ev(`T115 btcath>${B} up90>${U} ×${m}`, H.preMod(H.S5, PB, mod(115, U, m, B)));
