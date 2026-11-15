/* Агент «ЛОУКАП», круг 7: «толпа в шортах права» (круг 6) — отрицательный фандинг лоукапа как признак слабости.
   Поверх V + PF (круги 2, 6): (a) паника лоукапа с отрицательным фандингом → только взнос; (b) продажи на страхе ×k при отрицательном фандинге;
   (c) новое правило в свободные дни: лоукап, фандинг за 30 дн < −x → продать s; (d) сравнение с «Ф» (страх ×1,5 у всех лоукапов, круг 3).
   Каждая форма — всё время / только до / только после 2025-06. Запуск: node app/lowcap_loop7.js */
const L = require('./lowcap_sim.js'), { c } = L;
const G = L.load(), S0 = L.S0, b = L.evs(G, S0), iF = S0.rules.findIndex(L.isPump), LC = c('mcsh90', '<', 1);
const SV = L.addRule(L.addRule(S0, { act: -0.2, conds: [LC, c('turn', '>', 100), c('up90', '>', 100)] }, iF), { act: -0.2, conds: [LC, c('cf7', '>', 0.4), c('up90', '>', 100), c('turn', '>', 30)] }, iF + 1);
const rv = L.evs(G, SV);
const show = (tag, S, base = rv) => { const r = L.evs(G, S), lo = L.cmpLow(r, base, 'lsel'), sd = L.cmpStd(r, base), l0 = L.cmpLow(r, b, 'lsel'), s0 = L.cmpStd(r, b);
  console.log(`${tag}: к V+PF ЛОтбор ${L.sg(lo.dlog)} ${lo.u}/${lo.d} ${lo.strict ? '✔' : '·'} стенд ${L.sg(sd.inc)} ${sd.pass ? '✔' : '·' + sd.why} | к основе ЛОтбор ${L.sg(l0.dlog)} ${l0.strict ? '✔' : '·'} стенд ${L.sg(s0.inc)} ${s0.pass ? '✔' : '·' + s0.why} [${['sel', 'ex', 'rnd', 'n100'].map((g) => s0.R[g].med.toFixed(0) + '/' + s0.R[g].hworst.toFixed(0)).join(' ')}] 100н ${L.bw(r, b, 'n100').join('/')}`); return r; };
show('V + PF', SV);
const T3 = (cd, f) => [['всё время', f(cd)], ['только до', f(L.onlyBefore(cd, '2025-06-01'))], ['только после', f(L.onlyAfter(cd, '2025-06-01'))]];
for (const x of [-0.3, -1]) for (const [p, S] of T3([LC, c('cf7', '<', x)], (cd) => L.pre(SV, L.isPanic, cd, 1, { grp: 0 }))) show(`(a) паника → взнос, cf7 < ${x} | ${p}`, S);
for (const x of [-0.3, -1]) for (const k of [1.5, 2]) for (const [p, S] of T3([LC, c('cf7', '<', x)], (cd) => L.pre(SV, L.isFear, cd, (r) => Math.max(-1, r.act * k)))) show(`(b) страх ×${k}, cf7 < ${x} | ${p}`, S);
for (const x of [-1, -3]) for (const s of [0.05, 0.1]) for (const [p, S] of T3([LC, c('cf30', '<', x)], (cd) => L.addRule(SV, { act: -s, conds: cd }, 'end'))) show(`(c) фандинг 30 дн < ${x} → продать ${s * 100}% (свободные дни) | ${p}`, S);
for (const [p, S] of T3([LC], (cd) => L.pre(SV, L.isFear, cd, (r) => Math.max(-1, r.act * 1.5)))) show(`(d) Ф: страх ×1,5 у всех лоукапов | ${p}`, S);
for (const [p, S] of T3([LC], (cd) => L.pre(SV, L.isFear, cd, (r) => Math.max(-1, r.act * 1.25)))) show(`(d) Ф: страх ×1,25 у всех лоукапов | ${p}`, S);
