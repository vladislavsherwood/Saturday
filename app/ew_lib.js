/* ew: волны Эллиотта как алгоритм. Зигзаг по закрытиям с порогом th: вершина/дно подтверждается, когда цена ушла от экстремума на th (только прошлое).
   zz(c, th) → по дням: pv (подтверждённые развороты {i, p, t: +1 вершина / −1 дно}), k[j] — сколько подтверждено к дню j, dir[j] — текущая нога (+1 вверх / −1 вниз). */
function zz(c, th) {
  const n = c.length, pv = [], k = new Int32Array(n), dir = new Int8Array(n);
  let d = 1, ext = c[0], exi = 0;
  for (let j = 0; j < n; j++) {
    const p = c[j];
    if (isFinite(p)) {
      if (!isFinite(ext)) { ext = p; exi = j; }
      if (d > 0) { if (p > ext) { ext = p; exi = j; } else if (p < ext * (1 - th)) { pv.push({ i: exi, p: ext, t: 1 }); d = -1; ext = p; exi = j; } }
      else { if (p < ext) { ext = p; exi = j; } else if (p > ext * (1 + th)) { pv.push({ i: exi, p: ext, t: -1 }); d = 1; ext = p; exi = j; } }
    }
    k[j] = pv.length; dir[j] = d;
  }
  return { pv, k, dir };
}
// P(z, j, m) — m-й с конца подтверждённый разворот к дню j (1 — последний)
const P = (z, j, m) => (z.k[j] >= m ? z.pv[z.k[j] - m] : null);
// признаки (1/0) по дню j; c — ряд цен; o — параметры
const F = {
  // 1. старт волны 3: L0 < H1, L2 > L0, откат волны 2 в [a, b] волны 1, цена пробила H1 (не дальше чем на +10%)
  w3start(z, c, j, o) { if (z.dir[j] !== 1) return 0; const L2 = P(z, j, 1), H1 = P(z, j, 2), L0 = P(z, j, 3); if (!L0) return 0; const r = (H1.p - L2.p) / (H1.p - L0.p);
    return L2.p > L0.p && r >= (o.a ?? 0.382) && r <= (o.b ?? 0.786) && c[j] > H1.p && c[j] < H1.p * 1.1 ? 1 : 0; },
  // 2. идёт волна 5: L0 H1 L2 H3 L4 (L2 > L0, H3 > H1, L4 > L2, при ov — L4 > H1), цена выше H3; при div — RSI ниже, чем на H3
  w5(z, c, j, o, I) { if (z.dir[j] !== 1) return 0; const L4 = P(z, j, 1), H3 = P(z, j, 2), L2 = P(z, j, 3), H1 = P(z, j, 4), L0 = P(z, j, 5); if (!L0) return 0;
    if (!(L2.p > L0.p && H3.p > H1.p && L4.p > L2.p && (!o.ov || L4.p > H1.p) && c[j] > H3.p)) return 0; return o.div ? (I.rsi[j] < I.rsi[H3.i] ? 1 : 0) : 1; },
  // 3. конец коррекции ABC: H0, A = L1, B = H2 < H0, идёт C ниже L1 и длина C ≥ m × A
  abc(z, c, j, o) { if (z.dir[j] !== -1) return 0; const H2 = P(z, j, 1), L1 = P(z, j, 2), H0 = P(z, j, 3); if (!H0) return 0;
    return H2.p < H0.p && c[j] < L1.p && H2.p - c[j] >= o.m * (H0.p - L1.p) ? 1 : 0; },
  // 4. откат Фибоначчи: идёт нога вниз от H1, откат от ноги L0→H1 в [a, b]
  fib(z, c, j, o) { if (z.dir[j] !== -1) return 0; const H1 = P(z, j, 1), L0 = P(z, j, 2); if (!L0) return 0; const r = (H1.p - c[j]) / (H1.p - L0.p); return r >= o.a && r <= o.b ? 1 : 0; },
  // 5. цель волны 3: после L0 H1 L2 цена ≥ L2 + e × (H1 − L0)
  w3ext(z, c, j, o) { if (z.dir[j] !== 1) return 0; const L2 = P(z, j, 1), H1 = P(z, j, 2), L0 = P(z, j, 3); if (!L0) return 0;
    return L2.p > L0.p && c[j] > H1.p && c[j] >= L2.p + o.e * (H1.p - L0.p) ? 1 : 0; },
  // 6. импульс из 5 волн завершён (L0 H1 L2 H3 L4 H5, растущие), идёт первая нога вниз, цена ещё выше L4
  done5(z, c, j, o) { if (z.dir[j] !== -1) return 0; const H5 = P(z, j, 1), L4 = P(z, j, 2), H3 = P(z, j, 3), L2 = P(z, j, 4), H1 = P(z, j, 5), L0 = P(z, j, 6); if (!L0) return 0;
    return L2.p > L0.p && H3.p > H1.p && L4.p > L2.p && H5.p > H3.p && (!o.ov || L4.p > H1.p) && c[j] > L4.p ? 1 : 0; },
  // 7. пять волн вниз завершены (H0 L1 H2 L3 H4 L5, падающие), идёт первая нога вверх, цена ниже H4
  down5(z, c, j, o) { if (z.dir[j] !== 1) return 0; const L5 = P(z, j, 1), H4 = P(z, j, 2), L3 = P(z, j, 3), H2 = P(z, j, 4), L1 = P(z, j, 5), H0 = P(z, j, 6); if (!H0) return 0;
    return H2.p < H0.p && L3.p < L1.p && H4.p < H2.p && L5.p < L3.p && (!o.ov || H4.p < L1.p) && c[j] < H4.p ? 1 : 0; },
};
// индикатор по ряду: name, ряд (X → массив), порог, признак, параметры
function series(X, src) { return src === 'btc' ? X.ind.btcp : src === 'usdt' ? X.ind.usdt : X.c; }
function make(X, src, th, f, o = {}) { const c = series(X, src), z = zz(c, th), a = new Float64Array(X.n); for (let j = 0; j < X.n; j++) a[j] = F[f](z, c, j, o, X.ind); return a; }
// обратный ряд (для «волн вверх у USDT.D» как падающих волн у 1/usdt не нужен — зигзаг симметричен)
module.exports = { zz, P, F, make };
