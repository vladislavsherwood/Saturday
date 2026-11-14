/* Индикаторы рынка деривативов внутри страницы (из found/liq_extra.json). */
const injLiq = (EX) => {
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW);
  for (const k of SETS.avg) {
    setup(k, true);
    if (IND.oic3) continue;
    const add = (key, v) => { IND[key] = { v, step: 1, min: 0, max: 1, short: key, name: key }; };
    const at = {}; EX.t.forEach((t, i) => (at[t] = i));
    const S = (key) => { let last = NaN; return H.t.map((t) => { const i = at[t]; if (i != null && EX[key][i] != null) last = EX[key][i]; else if (i == null) last = NaN; return last; }); };
    const chg = (a, n) => a.map((x, i) => (i >= n ? (x / a[i - n] - 1) * 100 : NaN)), sum = (a, n) => a.map((x, i) => { if (i < n - 1) return NaN; let s = 0; for (let j = i - n + 1; j <= i; j++) s += a[j]; return s; });
    const mean = (a, n) => sum(a, n).map((x) => x / n), mx = (a, n) => a.map((x, i) => { let m = -Infinity; for (let j = Math.max(0, i - n + 1); j <= i; j++) if (a[j] > m) m = a[j]; return m; });
    const mn = (a, n) => a.map((x, i) => { let m = Infinity; for (let j = Math.max(0, i - n + 1); j <= i; j++) if (a[j] < m) m = a[j]; return m; });
    const fix = (a) => { let last = NaN; return a.map((x) => { if (x > 0 && !(x < 0.7 * last)) last = x; else if (x > 0 && x < 0.7 * last) return last; return x > 0 ? x : last; }); };   // сбои архива: OI обнуляется на день
    const oic = fix(S('boic')), oiv = S('boi'), p = oiv.map((v, i) => v / oic[i]), eoic = S('eoic'), fund = S('bfund'), ls = S('bls'), tls = S('btls'), tk = S('btaker'), lo = S('boimin'), hi = S('boimax');
    const oic3 = chg(oic, 3); add('oic3', oic3); add('oic7', chg(oic, 7)); add('oic14', chg(oic, 14)); add('eoic7', chg(eoic, 7));
    add('oidd30', oic.map((x, i) => (x / mx(oic, 30)[i] - 1) * 100));
    add('bp3', chg(p, 3)); add('bp7', chg(p, 7));
    add('fund7', sum(fund, 7)); add('fund30', sum(fund, 30));
    add('lsr', ls.map((x, i) => x / mean(ls, 90)[i])); add('ls', ls); add('tlsr', tls.map((x, i) => x / mean(tls, 90)[i]));
    add('taker7', mean(tk, 7)); add('oir', hi.map((x, i) => (1 - lo[i] / x) * 100));
    add('flush10', mn(oic3, 10)); add('oi30', chg(oiv, 30)); add('oic30', chg(oic, 30));
  }
  setup(cur, true);
};

module.exports = { injLiq };
