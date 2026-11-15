/* «Красные» монеты (корреляция с BTC за 180 дней ниже порога): что с ними делать в combo4.
   Варианты: (dca) все правила выключены — обычный взнос; (buy) выключены только покупки из резерва; (half) доли сигналов ×0,5.
   Основа — combo4 (P.base + Boost(2, k 0)). Запуск: node fit_test.js */
const P2 = require('./panicx_p2.js'), P = P2.P;
const pol = P2.Boost(2, { k: 0 });
P.setBaseline(P.base, pol);
const gate = (thr) => ({ ind: 'corr180', op: '>', v: thr });
function V(thr, mode) {
  const S = P.clone(P.base), out = [];
  for (const r of S.rules) {
    const sig = Math.abs(r.act - 1) > 1e-9, buy = r.act > 1;
    if (!sig || (mode === 'buy' && !buy)) { out.push(r); continue; }
    out.push({ ...r, conds: [...r.conds, gate(thr)] });
    if (mode === 'half') out.push({ ...r, act: +(1 + (r.act - 1) * 0.5).toFixed(6) });
    if (mode === 'buy') out.push({ act: 1, conds: r.conds }); // покупка у красной монеты — только взнос (не даём упасть в нижние правила)
    if (mode === 'dca') out.push({ act: 1, conds: r.conds });
  }
  S.rules = out; return S;
}
P.report('combo4', P.base, pol, { n100: true });
for (const thr of [0.1, 0.2, 0.3]) for (const mode of ['dca', 'buy', 'half']) P.report(`corr180 < ${thr}: ${mode}`, V(thr, mode), pol, { n100: true });
