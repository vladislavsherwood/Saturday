/* Круг 3: не отнимать у ранних дней, а докупать у дна. (а) разовая докупка e × резерв в первый день подтверждения в эпизоде паники (включая 10-дн. разрывы);
   (б) копии правил паники с подтверждением → доля × m (без состояния). Запуск: node panicx_r3.js */
const P = require('./panicx_sim.js'), { c } = P.Z;
const CF = {
  brsi30: (I, j) => I.brsi[j] < 30, brsi25: (I, j) => I.brsi[j] < 25,
  bd15: (I, j) => I.bdrop[j] > 15, bd20: (I, j) => I.bdrop[j] > 20, pd20: (I, j) => I.pdrop[j] > 20, pd30: (I, j) => I.pdrop[j] > 30,
  pk95: (I, j) => I.pupk[j] < 0.95 && I.pdrop[j] > 0,
  rsi30: (I, j) => I.rsi[j] < 30,
};
const One = (cf, e) => ({ extra: ({ X, j, st }) => { const I = X.ind; if (!isFinite(I.pdrop[j]) || st.fired || !cf(I, j)) return 0; st.fired = 1; return e; } });
P.report('основа', P.base, null);
const out = [];
for (const cn in CF) for (const e of [0.1, 0.25, 0.5]) out.push(P.report(`разово ${cn} e${e}`, P.base, One(CF[cn], e)));
const sc = (r, k) => +(1 + Math.min(1, (r.act - 1) * k)).toFixed(6);
for (const [ind, op, v] of [['brsi', '<', 30], ['brsi', '<', 35], ['pupk', '<', 0.95], ['pupk', '<', 0.97], ['rsi', '<', 30]]) for (const m of [1.5, 2]) out.push(P.report(`копия ${ind}${op}${v} ×${m}`, P.mapP((r) => [{ act: sc(r, m), conds: [...r.conds, c(ind, op, v)] }, r]), null));
module.exports = { CF, One };
