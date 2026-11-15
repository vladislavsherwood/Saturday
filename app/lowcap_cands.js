/* Агент «ЛОУКАП»: кандидаты для браузерного стенда и финального файла. V — памп на обороте, PF — памп на фандинге, Ф — страх ×1,5 у лоукапа.
   Запуск: node app/lowcap_cands.js <out.json> */
const L = require('./lowcap_sim.js'), { c } = L;
const S0 = L.S0, iF = S0.rules.findIndex(L.isPump);
function build({ base = S0, fl = [c('mcsh90', '<', 1)], vT = 100, vU = 100, vs = 0.2, pf = 0.4, pfT = 30, pfs = 0.2, phi = 1.5 } = {}) {
  const jF = base.rules.findIndex(L.isPump);
  let S = { base: base.base, rules: base.rules };
  if (vs) S = L.addRule(S, { act: -vs, conds: [...fl, c('turn', '>', vT), c('up90', '>', vU)] }, jF);
  if (pfs) S = L.addRule(S, { act: -pfs, conds: [...fl, c('cf7', '>', pf), c('up90', '>', 100), c('turn', '>', pfT)] }, jF + (vs ? 1 : 0));
  if (phi && phi !== 1) S = L.pre(S, L.isFear, fl, (r) => Math.max(-1, +(r.act * phi).toFixed(6)));
  return S;
}
module.exports = { build };
if (require.main === module) {
  const out = { 'основа combo-best': S0, 'V + PF (осторожный)': build({ phi: 1 }), 'V + PF + Ф1,5 (основной)': build({}), 'V': build({ pfs: 0, phi: 1 }) };
  require('fs').writeFileSync(process.argv[2], JSON.stringify(out));
  console.log('кандидатов', Object.keys(out).length, 'правил', Object.values(out).map((s) => s.rules.length).join('/'));
}
