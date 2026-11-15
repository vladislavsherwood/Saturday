/* Агент «ЛОУКАП», круг 3 (доводка): защита резерва лоукапа (паника → взнос / ×0,5) и продажи на страхе ×1,5 — держится ли на одном режиме?
   Правило разрешено только до 2025-06-01 / только после (по дню решения); плато по порогу доли рынка. Запуск: node app/lowcap_loop3b.js */
const L = require('./lowcap_sim.js'), { c } = L;
const G = L.load(), S0 = L.S0, b = L.evs(G, S0);
const show = (tag, S) => { const r = L.evs(G, S), lo = L.cmpLow(r, b, 'lsel'), sd = L.cmpStd(r, b); console.log(`${tag}: ЛОтбор ср.лог ${L.sg(lo.dlog)} мед ${L.sg(lo.dmed)} ${lo.u}/${lo.d} пол.${lo.hu}/${lo.hd} [${lo.R.pos}/${lo.R.hpos}/${lo.R.hworst.toFixed(0)}/${lo.R.worst.toFixed(0)}] ${lo.strict ? '✔' : '·'} | стенд ${L.sg(sd.inc)} ${sd.pass ? '✔' : '·' + sd.why} [${['sel', 'ex', 'rnd', 'n100'].map((g) => sd.R[g].med.toFixed(0) + '/' + sd.R[g].hworst.toFixed(0)).join(' ')}] 100н ${L.bw(r, b, 'n100').join('/')}`); return r; };
const lo = L.cmpLow(b, b, 'lsel'); console.log('основа ЛОтбор [в плюсе/половин/худш.пол/худшая]', lo.R.pos, lo.R.hpos, lo.R.hworst.toFixed(0), lo.R.worst.toFixed(0));
for (const fl of [0.3, 1, 3]) {
  const LC = [c('mcsh90', '<', fl)];
  for (const [nm, f] of [['взнос', (cd) => L.pre(S0, L.isPanic, cd, 1, { grp: 0 })], ['×0,5', (cd) => L.pre(S0, L.isPanic, cd, (r) => 1 + (r.act - 1) * 0.5)], ['страх ×1,5', (cd) => L.pre(S0, L.isFear, cd, (r) => Math.max(-1, r.act * 1.5))]]) {
    show(`доля<${fl} паника ${nm} | всё время`, f(LC));
    show(`доля<${fl} паника ${nm} | только до 06.2025`, f(L.onlyBefore(LC, '2025-06-01')));
    show(`доля<${fl} паника ${nm} | только после`, f(L.onlyAfter(LC, '2025-06-01')));
  }
}
