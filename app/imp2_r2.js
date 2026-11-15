/* imp2, круг 2: доход на резерв в стейблах (S.yld, годовых) — меняет ли он оптимальные размеры продаж и покупок из резерва.
   Сетка: доход 0 / 4,5% × все продажи ×k (0,75/1/1,25/1,5) × доли покупок из резерва ×m (0,5/0,75/1; act = 1 + (act − 1)·m).
   Сравнение внутри одного дохода: размеры, оптимальные при 4,5%, против размеров основы при 4,5%. Запуск: node app/imp2_r2.js <out.json> */
const I = require('./imp2_sim.js'); const fs = require('fs');
const G = I.groups();
const sized = (k, m) => ({ ...I.BASE, rules: I.BASE.rules.map((r) => (r.act < 0 ? { ...r, act: Math.max(-1, r.act * k) } : r.act > 1 ? { ...r, act: 1 + (r.act - 1) * m } : r)) });
const out = [];
for (const y of [0, 0.045]) {
  const b = I.ev(G, { ...I.BASE, yld: y }); const b0 = out.length ? out[0].r : null;
  console.log(`=== доход ${y * 100}% годовых`); console.log(I.row('основа', b, b));
  for (const k of [0.75, 1, 1.25, 1.5]) for (const m of [0.5, 0.75, 1]) {
    if (k === 1 && m === 1) continue;
    const r = I.ev(G, { ...sized(k, m), yld: y }, false); const t = `доход ${y * 100}%: продажи ×${k}, покупки из резерва ×${m}`;
    console.log(I.row(t, r, b)); out.push({ t, y, k, m, d: I.d(r, b), pass: I.passes(r, b), r: I.slim(r), bw: I.bw(r, b, 'n100') });
  }
  out.push({ t: `основа, доход ${y * 100}%`, y, k: 1, m: 1, d: 0, r: I.slim(b) });
}
fs.writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(out));
