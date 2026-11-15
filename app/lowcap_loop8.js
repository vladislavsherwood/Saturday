/* Агент «ЛОУКАП», круг 8: сборка V + PF (+ Ф), признак «лоукап» по данным, плато соседей, метрики дна/вершин, периоды.
   Критерий выбора (заранее): ОСНОВНОЙ — наибольший средний лог-прирост по монетам отбора лоукапов среди вариантов со строгой ✔ на отборе лоукапов
   и на стенде либо с единственным провалом стенда «2-я половина ARIA на 50 случайных» (цена правила C, принятая в combo-best), при 100 новых не хуже
   основы (медиана, монеты и половины в плюсе); ОСТОРОЖНЫЙ — то же только со строгой ✔ везде. Соседи по каждому параметру — тоже в плюс.
   Запуск: node app/lowcap_loop8.js */
const L = require('./lowcap_sim.js'), K = L.K, { c } = L;
const G = L.load(), S0 = L.S0, b = L.evs(G, S0), iF = S0.rules.findIndex(L.isPump);
function build({ fl = [c('mcsh90', '<', 1)], vT = 100, vU = 100, vs = 0.2, pf = 0.4, pfT = 30, pfs = 0.2, phi = 1.5 } = {}) {
  let S = S0;
  if (vs) S = L.addRule(S, { act: -vs, conds: [...fl, c('turn', '>', vT), c('up90', '>', vU)] }, iF);
  if (pfs) S = L.addRule(S, { act: -pfs, conds: [...fl, c('cf7', '>', pf), c('up90', '>', 100), c('turn', '>', pfT)] }, iF + (vs ? 1 : 0));
  if (phi && phi !== 1) S = L.pre(S, L.isFear, fl, (r) => Math.max(-1, +(r.act * phi).toFixed(6)));
  return S;
}
const rows = [];
function show(tag, S, withM = false) {
  const r = L.evs(G, S), lo = L.cmpLow(r, b, 'lsel'), sd = L.cmpStd(r, b), n0 = L.st(b.n100), n1 = L.st(r.n100);
  const ariaOnly = !sd.pass && sd.why === 'rnd' && (() => { const R = L.st(r.rnd.filter((x) => x.name !== 'ARIA')), B = L.st(b.rnd.filter((x) => x.name !== 'ARIA')); return R.pos >= B.pos && R.hpos >= B.hpos && R.hworst >= B.hworst - 1e-9; })();
  const n100ok = n1.med >= n0.med && n1.pos >= n0.pos && n1.hpos >= n0.hpos;
  let m = ''; if (withM) { const M = K.metrics(G.lsel, S); m = ` | дно ${M.buyAbove90.toFixed(0)}/${M.zone15.toFixed(0)} вершины ${M.sellToTop.toFixed(0)}/${M.missedTops.toFixed(0)}`; }
  console.log(`${tag}: ЛОтбор ${L.sg(lo.dlog)} мед ${L.sg(lo.dmed)} ${lo.u}/${lo.d} пол.${lo.hu}/${lo.hd} ${lo.strict ? '✔' : '·'} | стенд ${L.sg(sd.inc)} ${sd.pass ? '✔' : ariaOnly ? '·ARIA' : '·' + sd.why} [${['sel', 'ex', 'rnd'].map((g) => sd.R[g].med.toFixed(0)).join(' ')}] 100н ${n1.med.toFixed(0)}/${n1.pos}/${n1.hpos} ${L.bw(r, b, 'n100').join('/')}${n100ok ? '' : ' (100н хуже)'}${m}`);
  rows.push({ tag, low: lo.dlog, lowStrict: lo.strict, std: sd.inc, stdPass: sd.pass, ariaOnly, n100ok, n100: n1.med });
  return r;
}
console.log('Метрики основы на отборе лоукапов:', K.fmtM(K.metrics(G.lsel, S0)));
console.log('\n— сборки —');
show('V', build({ pfs: 0, phi: 1 }), true);
show('V + PF', build({ phi: 1 }), true);
show('V + Ф1,5', build({ pfs: 0 }), true);
show('V + PF + Ф1,25', build({ phi: 1.25 }), true);
show('V + PF + Ф1,5', build({}), true);
show('V + PF + Ф1,75', build({ phi: 1.75 }), true);
console.log('\n— признак «лоукап» (V + PF + Ф1,5) —');
for (const [nm, fl] of [['доля < 0,5 б.п.', [c('mcsh90', '<', 0.5)]], ['доля < 2 б.п.', [c('mcsh90', '<', 2)]], ['капитализация < $300 млн', [c('mcm90', '<', 300)]], ['капитализация < $1 млрд', [c('mcm90', '<', 1000)]],
  ['доля < 1 б.п. и оборот30 > 5%', [c('mcsh90', '<', 1), c('turn30', '>', 5)]], ['оборот30 > 10% (без капитализации)', [c('turn30', '>', 10)]], ['все монеты', []]]) show(nm, build({ fl }));
console.log('\n— соседи (V + PF + Ф1,5, по одному параметру) —');
for (const o of [{ vT: 75 }, { vT: 150 }, { vU: 50 }, { vU: 200 }, { vs: 0.1 }, { vs: 0.3 }, { pf: 0.3 }, { pf: 0.5 }, { pfT: 0 }, { pfT: 50 }, { pfs: 0.1 }, { pfs: 0.3 }]) show(JSON.stringify(o), build(o));
console.log('\n— по периодам (вся сборка разрешена только до / только после 2025-06) —');
for (const [nm, f] of [['до', L.onlyBefore], ['после', L.onlyAfter]]) { show(`V + PF только ${nm}`, build({ phi: 1, fl: f([c('mcsh90', '<', 1)], '2025-06-01') })); show(`V + PF + Ф1,5 только ${nm}`, build({ fl: f([c('mcsh90', '<', 1)], '2025-06-01') })); }
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/lowcap/loop8.json', JSON.stringify(rows));
module.exports = { build };
