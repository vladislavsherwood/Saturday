/* c7, круг 1: диагностика combo7. (а) разбор удалением: слои (К1, К4, К-V, К-D, hv2), семьи и каждое правило ядра (64 правила + множитель = combo7),
   отложенная паника и фитили; (б) где combo7 ошибается (как gap_r1: кэш, упущенные дна/вершины, годы) — 81 монета + 100 новых, сдвиг 0;
   (в) монеты пользователя: итог к DCA, доля кэша сейчас, последние сигналы. Запуск: node c7_r1.js [abl|one|gap|mine] (лог scratchpad/c7/r1_<режим>.txt) */
const C = require('./c7_lib.js'), { O, L, P } = C;
const mode = process.argv[2] || 'abl';
C.tee('r1_' + mode);
const sg = C.sg;
const line = (r) => `${sg(r.dseg.all)} к${sg(r.dseg.big)} а${sg(r.dseg.alt)} м${sg(r.dseg.meme)} ${r.w ? '✗' : '✔'} | 100н ${sg(r.n100.m)} ${r.n100.u}/${r.n100.d} | пол ${sg(r.hv.h1)}/${sg(r.hv.h2)}`;
if (mode === 'abl') {
  const out = [];
  const go = (nm, S, pol) => { const r = C.run(nm, S, pol, { quiet: true }); out.push([nm, r]); console.log(`${nm.padEnd(52)} ${line(r)}`); };
  console.log('=== слои (без слоя: множитель выключен; к combo7) ===');
  go('без К1 (золото: покупки ×1,5)', C.core, C.polM({ k1: 0 }));
  go('без К4 (золото: страх ×1,5)', C.core, C.polM({ k4: 0 }));
  go('без К1 и К4 (всё золото)', C.core, C.polM({ k1: 0, k4: 0 }));
  go('без К-V (VVIX: фандинг копить)', C.core, C.polM({ kv: 0 }));
  go('без К-D (DVOL: вершина ×1,5)', C.core, C.polM({ kd: 0 }));
  go('без К-V и К-D (все опционы)', C.core, C.polM({ kv: 0, kd: 0 }));
  go('без hv2 (волатильные ×1,5/×2 и пороги пампа)', C.coreNoThr(), C.polM({ hv: 0 }));
  go('без hv2-множителя (пороги пампа остаются)', C.core, C.polM({ hv: 0 }));
  go('без всех слоёв (= combo5)', C.coreNoThr(), C.polW);
  const { wick, ...noW } = C.polW;
  go('без фитилей', C.core, { ...noW, c7_act: C.mkAct() });
  go('без отложенной паники (фитили остаются)', C.core, { wick: C.polW.wick, c7_act: C.mkAct() });
  console.log('\n=== семьи ядра (с множителем) ===');
  const fams = [...new Set(C.core.rules.map((r) => r.f))];
  for (const f of fams) { const S = L.clone(C.core); S.rules = C.core.rules.filter((r) => r.f !== f); go(`без семьи ${f} (${C.core.rules.filter((r) => r.f === f).length})`, S, C.polM()); }
  const hold = L.clone(C.core); hold.rules = C.core.rules.filter((r) => !r.conds.some((x) => x.ind === 'h2fd15')); go('без удержания после капитуляции (h2)', hold, C.polM());
}
if (mode === 'one') {
  console.log('=== по одному правилу ядра (64; с множителем; к combo7) ===');
  const rows = [];
  C.core.rules.forEach((r, k) => { const S = L.clone(C.core); S.rules.splice(k, 1); const rr = C.run('r' + k, S, C.polM(), { quiet: true });
    const d = `${k} [${r.f}] ${r.act} ${r.conds.map((x) => x.ind + x.op + x.v).join(' & ')}`; rows.push([rr.dseg.all, rr.n100.m, d, line(rr)]); });
  rows.sort((a, b) => b[0] - a[0]);
  for (const [a, m, d, l] of rows) console.log(`${l}  ${a > 0 && m > 0 ? '← мешает?' : ''}  ${d}`);
}
if (mode === 'gap' || mode === 'mine') {
  const G = L.G, UNIT = 10, FEE = 0.001;
  const med = (v) => { const a = v.filter(isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
  const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  const pc = (x) => (x * 100).toFixed(0) + '%';
  const trace = (X, S, pol) => { const p = { ...pol, trace: [] }; P.edge(X, S, 0, 'full', false, p); return p.trace; };
  const dca = (X) => { let du = 0; const D = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { du += (UNIT * (1 - FEE)) / X.c[i]; D[i] = du * X.c[i]; } return D; };
  if (mode === 'gap') {
    const cashAll = [], bottoms = [], tops = [], yrs = {}, yrs6 = {};
    for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const X of G[g]) {
      const T = trace(X, C.S7, C.polW), T6 = trace(X, C.S6, C.polW), c = X.c, n = X.n, D = dca(X);
      const V = T.map(([i, cash, u]) => cash + u * c[i]), V6 = T6.map(([i, cash, u]) => cash + u * c[i]), cs = T.map(([i, cash], k) => cash / V[k]);
      if (g !== 'n100') cashAll.push(mean(cs.slice(60)));
      const y0 = (i) => +L.day(X.ind.t[i]).slice(0, 4); let prev = null, prev6 = null;
      for (let i = 0; i < n; i++) { const y = y0(i); if (!(i === n - 1 || y0(i + 1) !== y)) continue; const e = Math.log(V[i] / D[i]), e6 = Math.log(V6[i] / D[i]);
        if (prev !== null && i > 120) { (yrs[y] = yrs[y] || []).push(e - prev); (yrs6[y] = yrs6[y] || []).push(e - prev - (e6 - prev6)); } prev = e; prev6 = e6; }
      for (let i = 180; i < n - 30; i++) {
        let isMin = true, isMax = true; for (let k = Math.max(0, i - 180); k <= Math.min(n - 1, i + 180); k++) { if (c[k] < c[i]) isMin = false; if (c[k] > c[i]) isMax = false; if (!isMin && !isMax) break; }
        if (isMin) { let mx = 0; for (let k = Math.max(0, i - 365); k < i; k++) mx = Math.max(mx, c[k]); if (c[i] < mx * 0.4) { const a = Math.max(0, i - 60), b = Math.min(n - 1, i + 30), ca = T[a][1], cb = T[b][1], inflow = (b - a) * UNIT;
          bottoms.push({ g, nm: X.name, d: L.day(X.ind.t[i]), cs: cs[i], spent: (ca + inflow - cb) / (ca + inflow), dd: 1 - c[i] / mx }); } }
        if (isMax) { let mn = Infinity; for (let k = i; k < Math.min(n, i + 365); k++) mn = Math.min(mn, c[k]); if (mn < c[i] * 0.4) { const a = Math.max(0, i - 60), b = Math.min(n - 1, i + 30); let maxU = 0; for (let k = a; k <= i; k++) maxU = Math.max(maxU, T[k][2]);
          tops.push({ g, nm: X.name, d: L.day(X.ind.t[i]), cs: 1 - cs[i], sold: 1 - T[b][2] / maxU }); } }
      }
    }
    console.log(`1) доля кэша в капитале монеты (медиана по 81): ${pc(med(cashAll))}`);
    const missB = bottoms.filter((b) => b.spent < 0.25 && b.cs > 0.3);
    console.log(`2) крупные дна: ${bottoms.length}; кэш на дне — медиана ${pc(med(bottoms.map((b) => b.cs)))}; потрачено за [−60;+30] — ${pc(med(bottoms.map((b) => b.spent)))}; упущено (кэш > 30%, потрачено < 25%): ${missB.length}`);
    const byM = {}; for (const b of missB) (byM[b.d.slice(0, 7)] = byM[b.d.slice(0, 7)] || []).push(b.nm); console.log('   упущенные дна по месяцам: ' + Object.entries(byM).sort().map(([m, a]) => `${m}: ${a.length} (${a.slice(0, 6).join(',')})`).join('; '));
    const missT = tops.filter((t) => t.sold < 0.2);
    console.log(`3) крупные вершины: ${tops.length}; продано за [−60;+30] — медиана ${pc(med(tops.map((t) => t.sold)))}; упущено (< 20%): ${missT.length}`);
    const byT = {}; for (const b of missT) (byT[b.d.slice(0, 7)] = byT[b.d.slice(0, 7)] || []).push(b.nm); console.log('   упущенные вершины по месяцам: ' + Object.entries(byT).sort().map(([m, a]) => `${m}: ${a.length} (${a.slice(0, 6).join(',')})`).join('; '));
    console.log('4) по годам: медиана прироста ln(капитал/DCA) за год (монет теряли > 0,02) | к combo6 медиана разницы (лучше/хуже):');
    for (const y of Object.keys(yrs).sort()) { const a = yrs[y], b = yrs6[y]; console.log(`   ${y}: ${sg(med(a))} (${a.length} монет, теряли ${a.filter((x) => x < -0.02).length}) | к combo6 ${sg(med(b))} (${b.filter((x) => x > 0.01).length}/${b.filter((x) => x < -0.01).length})`); }
  } else {
    console.log('монеты пользователя: итог к DCA, % (худший из сдвигов 0/1): combo6 → combo7; кэш сейчас (доля капитала); последние 10 дней — номер сработавшего правила combo7');
    for (const nm of C.MINE) { const X = C.BY[nm]; if (!X) { console.log(nm, 'нет'); continue; }
      const e6 = C.E(X, C.S6, C.polW), e7 = C.E(X, C.S7, C.polW), T = trace(X, C.S7, C.polW), [i, cash, u] = T[T.length - 1], V = cash + u * X.c[i];
      const R = C.S7.rules; const dec = (j) => { for (let q = 0; q < R.length; q++) if (R[q].conds.every((cd) => { const v = X.ind[cd.ind] ? X.ind[cd.ind][j] : NaN; return cd.op === '<' ? v < cd.v : v > cd.v; })) return q; return '-'; };
      const last = Array.from({ length: 10 }, (_, k) => dec(X.n - 10 + k)).join(' ');
      const I = X.ind, j = X.n - 1;
      console.log(`${nm.padEnd(9)} ${Math.round(e6)} → ${Math.round(e7)} (${sg(C.L1(e7) - C.L1(e6))}) | дней ${X.n} возраст ${Math.round(I.age[j])} | кэш ${pc(cash / V)} | hvv ${(+I.hvv[j]).toFixed(0)} | сигналы ${last}`);
    }
  }
}
