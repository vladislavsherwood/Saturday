/* Агент «АЛЬТЫ», круг 7: монеты в собственном росте против рынка и долгие падения к BTC (сверху A1 + AS).
   Гипотезы (заранее):
   H7a — альт в сильном собственном росте к BTC (rel90 > 50/100/200% или rel180 > 100/200%; KAS 2023, WFI 2025, ARIA 2025, TON 2024, XMR 2020–21)
     продаётся на страхе рынка слишком рано: продажи на страхе (#14–17) ×0,5/×0,75 в такие дни дадут плюс. (Агент 3 круг 10 проверял «низкая бета
     и сильная» ×0,5 — отвергнуто; 4C проверял «сильная → ×1,5»; здесь — именно сильный относительный рост, без беты, и только альты.)
   H7b — альт в долгом падении к BTC (отношение монета/BTC ниже максимума года на 70/85%, rdd365) продаётся мало даже с C ×1,25:
     все продажи ×1,25/×1,5 в такие дни дадут плюс (у C ×1,5 на всех монетах терялись половины; здесь — глубина, а не 180-дн. отставание).
   Запуск: node app/seg_alt_loop7.js <out.json> */
const Q = require('./seg_alt_sim.js');
const fs = require('fs');
const { c } = Q;
const G = Q.load(); Q.addAltFlag(G);
const B = Q.BASE, rb = Q.evs(G, B);
const ALT = c('isalt', '>', 0.5);
const up = (S, qs, k, extra) => ({ ...S, rules: S.rules.flatMap((r, q) => (qs.includes(q) ? [{ act: Math.max(-1, +(r.act * k).toFixed(6)), conds: [...r.conds, ...extra] }, r] : [r])) });
const AS = (S, f = 65, o = 1, s = 0.05) => ({ ...S, rules: [...S.rules, { act: -s, conds: [ALT, c('fng', '>', f), c('oth90', '>', o)] }] });
const S0 = AS(up(B, [23, 24], 1.5, [ALT])), r0 = Q.evs(G, S0);
const fearIdx = [14, 15, 16, 17];
// индексы правил основы сдвигаются после up(); ищем правила продажи на страхе по условиям
const isFear = (r) => r.act < 0 && r.conds.some((x) => x.ind === 'fng' && x.op === '<' && x.v === 52) && r.conds.some((x) => x.ind === 'usdtd');
const scaleW = (S, which, k, extra) => ({ ...S, rules: S.rules.flatMap((r) => (which(r) ? [{ act: Math.max(-1, +(r.act * k).toFixed(6)), conds: [...r.conds, ...extra] }, r] : [r])) });
const L = [];
for (const [ind, vs] of [['rel90', [50, 100, 200]], ['rel180', [100, 200]]]) for (const v of vs) for (const k of [0.5, 0.75]) L.push([`H7a: альт ${ind}>${v} → продажи на страхе ×${k}`, scaleW(S0, isFear, k, [ALT, c(ind, '>', v)])]);
for (const v of [70, 85]) for (const k of [1.25, 1.5]) L.push([`H7b: альт rdd365>${v} → все продажи ×${k}`, scaleW(S0, (r) => r.act < 0 && !r.conds.some((x) => x.ind === 'rdd365'), k, [ALT, c('rdd365', '>', v)])]);
for (const k of [1.25]) L.push([`H7b': альт rel180<-50 → все продажи ×${k}`, scaleW(S0, (r) => r.act < 0, k, [ALT, c('rel180', '<', -50)])]);
const out = [];
console.log(Q.row('A1+AS к основе', r0, rb));
for (const [t, S] of L) { const r = Q.evs(G, S); console.log(Q.row(t, r, r0)); out.push({ t, ...Q.pack(r, r0) }); }
fs.writeFileSync(process.argv[2], JSON.stringify(out));
