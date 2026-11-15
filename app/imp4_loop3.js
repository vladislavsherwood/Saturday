/* imp4, круг 3. Правила против обвалов в стенде (быстрый оценщик, основа combo-best):
   A — на развороте BTC (правила #10 «разворот + фандинг» и #18 «BTC +20% за 30 дн», весь резерв) в жару покупать меньше: копия перед
       правилом с условием жары и долей a (1 = только взнос, 1,5 = половина резерва);
   B — продавать x% в день на жаре (перед разворотом), жара: жадность > T и BTC +20% за 30 дн / жадность > T / фандинг 7 дн > 0,5%;
   Z — не покупать монету на панике (правила покупки #1–#8, #11–#13), если она сама в пампе: up90 > U или rel180 > R (случай ZEC).
   Тест «правило только с даты D»: условие t > D. Запуск: node app/imp4_loop3.js <out.json> */
const L = require('./imp4_lib.js'); const { K } = L; const c = K.c;
const fs = require('fs');
const G = K.groups(['sel', 'ex', 'rnd', 'n100']); K.prep(G);
const S0 = L.S0;
const REV = [10, 18], PAN = [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13];
const heat = { 'жадн>T & BTC+20': (T) => [c('fng', '>', T), c('btcr30', '>', 20)], 'жадн>T': (T) => [c('fng', '>', T)], 'фанд7>T': (T) => [c('fund7', '>', T)] };
const ins = (S, idx, f) => ({ ...S, rules: S.rules.flatMap((r, q) => (idx.includes(q) ? [...f(r), r] : [r])) });
const since = (D) => (D ? [c('t', '>', L.tOf(D))] : []);
const A = (conds, a, D) => ins(S0, REV, (r) => [{ act: a, conds: [...r.conds, ...conds, ...since(D)] }]);
const Bs = (conds, x, D) => ({ ...S0, rules: [...S0.rules.slice(0, 9), { act: -x, conds: [...conds, ...since(D)] }, ...S0.rules.slice(9)] });
const Z = (cond, D) => ins(S0, PAN, (r) => [{ act: 1, conds: [...r.conds, cond, ...since(D)] }]);
const V = [];
for (const T of [70, 75, 80, 90]) for (const a of [1, 1.5]) V.push([`A: разворот при жадн>${T} → ${a === 1 ? 'только взнос' : 'половина резерва'}`, A([c('fng', '>', T)], a)]);
for (const a of [1, 1.5]) V.push([`A: разворот при фанд7>0,5 → ${a === 1 ? 'только взнос' : 'половина резерва'}`, A([c('fund7', '>', 0.5)], a)]);
for (const T of [75, 80, 90]) for (const x of [0.05, 0.1]) V.push([`B: жадн>${T} & BTC+20 → продать ${x * 100}%/день`, Bs(heat['жадн>T & BTC+20'](T), x)]);
for (const T of [80, 90]) V.push([`B: жадн>${T} → продать 5%/день`, Bs(heat['жадн>T'](T), 0.05)]);
for (const x of [0.05, 0.1]) V.push([`B: фанд7>0,5 → продать ${x * 100}%/день`, Bs(heat['фанд7>T'](0.5), x)]);
for (const U of [150, 200, 300]) V.push([`Z: паника без покупки при up90>${U}`, Z(c('up90', '>', U))]);
for (const R of [50, 100, 200]) V.push([`Z: паника без покупки при rel180>${R}`, Z(c('rel180', '>', R))]);
const t0 = Date.now();
const base = K.ev(G, S0);
console.log('основа:', K.line ? K.line(base) : '', `| 100 новых ${base.n100.med.toFixed(0)} ${base.n100.pos}/${base.n100.hpos}`, ((Date.now() - t0) / 1000).toFixed(0) + 'с');
const R = {};
for (const [t, S] of V) {
  const r = K.ev(G, S, false); const [bt, wr] = K.bw(r, base, 'n100');
  R[t] = { d: K.d(r, base), strict: K.passes(r, base), why: K.passes(r, base) ? '' : K.why(r, base), sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med, n100: r.n100.med, n100pos: r.n100.pos, n100h: r.n100.hpos, bw: [bt, wr] };
  console.log(`${t} | к основе ${R[t].d >= 0 ? '+' : ''}${R[t].d.toFixed(3)} ${R[t].strict ? '✔' : '· ' + R[t].why} | ${r.sel.med.toFixed(0)}/${r.ex.med.toFixed(0)}/${r.rnd.med.toFixed(0)} | 100н ${r.n100.med.toFixed(0)} ${r.n100.pos}/${r.n100.hpos} лучше/хуже ${bt}/${wr}`);
}
fs.writeFileSync(process.argv[2] || '/dev/null', JSON.stringify({ base: { sel: base.sel.med, ex: base.ex.med, rnd: base.rnd.med, n100: base.n100.med }, R }, null, 1));
