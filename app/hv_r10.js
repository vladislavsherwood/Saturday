/* hv, круг 10: выбор точки в середине плато (T ≥ 115 — строгая ✔ везде, T ≤ 110 — ✗ из-за PUMP) и итоговая проверка:
   по периодам (правила только до / только с 2025-01-01), половины, крупные по монетам, монеты пользователя, 100 новых по сегментам. */
const H = require('./hv_lib.js'), { c, G, L1 } = H;
const { build } = require('./hv_r7.js');
const C = { 'T115 U150 ×1,5': { T: 115, U: 150, mp: 1.5, mw: 1.5, me: 1.5 }, 'T120 U150 ×1,5': { T: 120, U: 150, mp: 1.5, mw: 1.5, me: 1.5 },
  'T120 U200 ×1,5': { T: 120, U: 200, mp: 1.5, mw: 1.5, me: 1.5 }, 'T120 U200 ×2': { T: 120, U: 200, mp: 2, mw: 2, me: 2 }, 'T125 U200 ×2': { T: 125, U: 200, mp: 2, mw: 2, me: 2 } };
const t25 = H.T('2025-01-01');
const addT = (S, cond) => { const T = H.L.clone(S); for (const r of T.rules) if (r.conds.some((x) => x.ind === 'hvv')) r.conds.push(cond); return T; };
H.head();
H.ev('combo5', H.S5);
const { BR, BN } = H.bases();
for (const [nm, o] of Object.entries(C)) {
  const S = build(o), r = H.ev(nm, S);
  H.ev(`   ${nm}: только до 2025`, addT(S, c('t', '<', t25)));
  H.ev(`   ${nm}: только с 2025`, addT(S, c('t', '>', t25 - 0.5)));
  const big = []; r.R.sel.forEach((x, i) => { if (x.seg === 'big') big.push(`${x.name} ${Math.round(BR.sel[i].f)}→${Math.round(x.f)}`); });
  console.log('   крупные:', big.join(', '));
  const segs = ['big', 'alt', 'meme'].map((s) => { const q = H.Z.mlog(r.N, BN, s, ['n100']); return `${s} ${H.sg(q.m, 3)} ${q.u}/${q.d}`; }).join(', ');
  console.log('   100 новых по сегментам:', segs);
  console.log('   монеты пользователя:', H.mine(S, H.polW).map((q) => (q.miss ? q.nm + ' —' : `${q.nm} ${Math.round(q.b)}→${Math.round(q.x)}`)).join(', '));
}
