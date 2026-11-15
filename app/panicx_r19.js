/* Круг 19: грубая оценка для маржи — как меняются дни трат резерва (без расчёта плеча). По 81 монете, сдвиг 0:
   доля денег покупок из резерва по дню эпизода паники; самая большая покупка дня в % капитала (резерв + монеты) — медиана и 95-й процентиль по монетам;
   доля денег, после которых цена падала > 30% / > 50% в следующие 120 дней (для плеча это и есть риск); число дней с покупкой > 25% капитала.
   Браузерный стенд: страницы считают стратегию своим движком по JSON правил — долга (состояния) там нет, без правки общих simple.js/lab.js не запустить. Запуск: node panicx_r19.js */
const H = require('./panicx_p2.js'), P = H.P, G = H.G;
const V = [['C3 (combo3 без tune1)', null], ['panicx-best', H.Pol2()], ['k 0', H.Pol2({ k: 0 })], ['k 0, выдача × 2', H.Boost(2, { k: 0 })]];
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(f * (s.length - 1))]; };
for (const [nm, pol] of V) {
  const B = { 'не паника': 0, 'д1': 0, 'д2–7': 0, 'д8–30': 0, 'д31+': 0, 'разрыв/после': 0 }; let W = 0, f30 = 0, f50 = 0, big = 0; const mx = [];
  for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) {
    const { tr } = P.edge(X, P.base, 0, 'full', true, pol); let m = 0, cash = 0;
    // капитал на день — пересчитываю грубо: units и cash из сделок
    let units = 0, cs = 0; const byI = new Map(); for (const t of tr) (byI.get(t.i) || byI.set(t.i, []).get(t.i)).push(t);
    for (let i = 0; i < X.n; i++) {
      cs += 10; const ts = byI.get(i) || []; let buy = 10;
      for (const t of ts) { if (t.s > 0) buy += t.amt; else { units -= t.amt / t.p; cs += t.amt * 0.999; } }
      const eq = cs + units * X.c[i]; const amt = Math.min(cs, buy); units += (amt * 0.999) / X.c[i]; cs -= amt;
      const extra = amt - 10; if (extra <= 1) continue;
      const fr = extra / Math.max(eq, 1e-9); if (fr > m) m = fr; if (fr > 0.25) big++;
      const d = X.ind.pday[i - 1]; const k = !(t => t)(0) && (ts.some((t) => t.pan) ? (d === 1 ? 'д1' : d >= 2 && d <= 7 ? 'д2–7' : d >= 8 && d <= 30 ? 'д8–30' : d > 30 ? 'д31+' : 'разрыв/после') : 'не паника');
      if (i + 120 < X.n) { let lo = X.c[i]; for (let j = i; j <= i + 120; j++) lo = Math.min(lo, X.c[j]); const fl = 1 - lo / X.c[i]; W += extra; B[k] += extra; if (fl > 0.3) f30 += extra; if (fl > 0.5) f50 += extra; }
    }
    mx.push(m);
  }
  console.log(`${nm.padEnd(24)} деньги по дням: ${Object.entries(B).map(([k, v]) => `${k} ${(100 * v / W).toFixed(0)}%`).join(', ')} | макс. покупка дня, % капитала: медиана ${(100 * q(mx, 0.5)).toFixed(0)}, 95% ${(100 * q(mx, 0.95)).toFixed(0)} | дней с покупкой > 25% капитала ${big} | денег перед падением >30% ${(100 * f30 / W).toFixed(0)}%, >50% ${(100 * f50 / W).toFixed(0)}%`);
}
