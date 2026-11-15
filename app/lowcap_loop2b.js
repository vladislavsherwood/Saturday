/* Агент «ЛОУКАП», круг 2 (доводка): плато T × s, флаг доли рынка, период (только до/после 2025-06), место правила. Запуск: node app/lowcap_loop2b.js */
const L = require('/home/user/Saturday/app/lowcap_sim.js'), { c } = L;
const G = L.load(), S0 = L.S0, b = L.evs(G, S0), iF = S0.rules.findIndex(L.isPump);
const show = (tag, S) => { const r = L.evs(G, S), lo = L.cmpLow(r, b, 'lsel'), sd = L.cmpStd(r, b); console.log(`${tag}: ЛОтбор ср.лог ${L.sg(lo.dlog)} мед ${L.sg(lo.dmed)} ${lo.u}/${lo.d} пол.${lo.hu}/${lo.hd} ${lo.strict ? '✔' : '·'} | стенд ${L.sg(sd.inc)} ${sd.pass ? '✔' : '·' + sd.why} [${['sel','ex','rnd','n100'].map(g=>sd.R[g].med.toFixed(0)+'/'+sd.R[g].hworst.toFixed(0)).join(' ')}] 100н ${L.bw(r, b, 'n100').join('/')}`); };
for (const T of [75, 100, 150]) for (const s of [0.1, 0.2, 0.3, 0.5]) show(`перед F, доля<1, T=${T} U=100 s=${s}`, L.addRule(S0, { act: -s, conds: [c('mcsh90', '<', 1), c('turn', '>', T), c('up90', '>', 100)] }, iF));
for (const fl of [0.3, 0.5, 1, 2, 3, 10]) show(`перед F, доля<${fl}, T=100 U=100 s=0.2`, L.addRule(S0, { act: -0.2, conds: [c('mcsh90', '<', fl), c('turn', '>', 100), c('up90', '>', 100)] }, iF));
const base = [c('mcsh90', '<', 1), c('turn', '>', 100), c('up90', '>', 100)];
show('только до 2025-06', L.addRule(S0, { act: -0.2, conds: L.onlyBefore(base, '2025-06-01') }, iF));
show('только после 2025-06', L.addRule(S0, { act: -0.2, conds: L.onlyAfter(base, '2025-06-01') }, iF));
show('после F (в самом конце)', L.addRule(S0, { act: -0.2, conds: base }, 'end'));
show('при BTC у максимума (btcath<20)', L.addRule(S0, { act: -0.2, conds: [...base, c('btcath', '<', 20)] }, iF));
