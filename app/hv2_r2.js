/* hv2, круг 2: исключение крупных — признак вместо списка isbig. Рабочие конфигурации: рампа 100–140, ×2, порог пампа U 250 / 300.
   Признаки (монета исключена в день j, если …): corr180 > x; corr180 > 0,6 и beta180 < y («ходит с рынком, не усиливает»); B65 с ослабленной волатильностью (corr180 > 0,6 и vol180 < v);
   возраст ряда > A дней; без исключения; список. */
const X = require('./hv2_lib.js'), { H, c } = X;
const I = (k) => (Y, j) => Y.ind[k][j];
const EX = {
  'список isbig': X.EXL.list, 'без исключения': X.EXL.none,
  'corr180 > 0,6': (Y, j) => I('corr180')(Y, j) > 0.6, 'corr180 > 0,7': (Y, j) => I('corr180')(Y, j) > 0.7, 'corr180 > 0,75': (Y, j) => I('corr180')(Y, j) > 0.75,
  'corr180 > 0,6 и beta180 < 1,3': (Y, j) => I('corr180')(Y, j) > 0.6 && I('beta180')(Y, j) < 1.3, 'corr180 > 0,6 и beta180 < 1,5': (Y, j) => I('corr180')(Y, j) > 0.6 && I('beta180')(Y, j) < 1.5,
  'corr180 > 0,7 и beta180 < 1,5': (Y, j) => I('corr180')(Y, j) > 0.7 && I('beta180')(Y, j) < 1.5,
  'beta180 < 1,3': (Y, j) => I('beta180')(Y, j) < 1.3,
  'B65 ослабл.: corr180 > 0,6 и vol180 < 130': (Y, j) => I('corr180')(Y, j) > 0.6 && I('vol180')(Y, j) < 130,
  'возраст ряда > 1500': (Y, j) => I('age')(Y, j) > 1500,
};
const big = (r) => { const { BR } = H.bases(); return r.R.sel.map((x, i) => (x.seg === 'big' ? `${x.name} ${H.sg(X.L1(x.f) - X.L1(BR.sel[i].f), 3)}` : '')).filter(Boolean).filter((s) => !s.endsWith('+0.000') && !s.endsWith('-0.000')).join(' '); };
for (const U of [250, 300]) for (const [nm, ex] of Object.entries(EX)) {
  const r = X.run('', { gf: X.ramp(100, 140), U, ex }, { quiet: true });
  console.log(`U${U} ${nm.padEnd(40)} доход ${H.sg(r.all)} к${H.sg(r.big)} ${r.ok ? '✔' : '✗'} | БД ${H.sg(r.hvInc)} БД81 ${H.sg(r.hv81.m, 3)} (${r.hv81.u}/${r.hv81.d}) БД100н ${H.sg(r.nhv.m, 3)} (${r.nhv.u}/${r.nhv.d}) | 81 ${H.sg(r.m81.m, 3)} 100н ${H.sg(r.n.m, 3)} | PUMP ${r.pump.toFixed(0)} | крупные: ${big(r) || '0'}${r.why ? ' | ' + r.why.slice(0, 60) : ''}`);
}
