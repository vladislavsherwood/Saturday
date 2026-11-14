/* Индикаторы «после выноса» поверх liq_inject.js: минимум OI к максимуму за N дней, минимум лонги/шорты к средней за N дней,
   первый день, когда толпа вышла из шортов после выноса. Вызывать после injLiq. */
const injLs = () => {
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW);
  for (const k of SETS.avg) {
    setup(k, true);
    if (IND.oimin20) continue;
    const add = (key, v) => { IND[key] = { v, step: 1, min: 0, max: 1, short: key, name: key }; };
    const mn = (a, n) => a.map((x, i) => { if (i < n - 1) return NaN; let m = Infinity; for (let j = i - n + 1; j <= i; j++) { if (!(a[j] <= m)) { if (isNaN(a[j])) return NaN; } else m = a[j]; } return m; });
    const oi = IND.oidd30.v, lsr = IND.lsr.v;
    for (const n of [20, 40]) { add('oimin' + n, mn(oi, n)); add('lsrmin' + n, mn(lsr, n)); }
    for (const n of [20, 40]) for (const x of [0.95, 1.0]) {
      const on = oi.map((v, i) => (IND['oimin' + n].v[i] < -28 && v > -28 && lsr[i] > x && IND['lsrmin' + n].v[i] < 0.9 ? 1 : 0));
      add(`dly${n}_${x * 100}`, on); add(`dly${n}_${x * 100}f`, on.map((v, i) => (v && !on[i - 1] ? 1 : 0)));
    }
  }
  setup(cur, true);
};
module.exports = { injLs };
