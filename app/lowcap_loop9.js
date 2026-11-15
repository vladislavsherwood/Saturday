/* Агент «ЛОУКАП», круг 9 (быстрый оценщик): первая проверка на проверочной части лоукапов (79 монет, в отборе не участвовала).
   (A) события V, PF, «памп на плечах», «толпа в шортах» на проверке; (B) кандидаты на проверке: ср. лог по монетам, лучше/хуже, строгая, периоды;
   (C) где проверка хуже: монеты. Запуск: node app/lowcap_loop9.js */
const L = require('./lowcap_sim.js'), { c } = L;
const { build } = require('./lowcap_cands.js');
const G = L.load(), S0 = L.S0, A = G.lchk;
const H = [30, 90, 180], pct = (v) => (isNaN(v) ? '  -' : ((v >= 0 ? '+' : '') + (100 * v).toFixed(0)).padStart(4));
const xs = {}; for (const h of H) { const m = new Map(); for (const X of A) for (let i = 0; i + h < X.n; i++) { const t = X.t[i]; if (!m.has(t)) m.set(t, []); m.get(t).push(X.c[i + h] / X.c[i] - 1); } xs[h] = new Map([...m].map(([t, v]) => [t, L.med(v)])); }
const exr = (X, i, h) => (i + h < X.n && xs[h].has(X.t[i]) ? (X.c[i + h] / X.c[i]) / (1 + xs[h].get(X.t[i])) - 1 : NaN);
function events(name, cond, dir) {
  const P = { pre: [], post: [] }, coins = new Set();
  for (const X of A) { let last = -1e9; for (let i = 0; i < X.n; i++) if (cond(X, i) && i - last >= 30) { last = i; coins.add(X.name); P[X.t[i] < L.SPLIT ? 'pre' : 'post'].push(H.map((h) => exr(X, i, h)), ); } }
  const s = (E) => `${String(E.length).padStart(3)} эп. ${H.map((h, q) => pct(L.med(E.map((x) => x[q]).filter((v) => !isNaN(v))))).join(' ')} (${(100 * E.filter((x) => x[1] * dir > 0).length / Math.max(1, E.filter((x) => !isNaN(x[1])).length)).toFixed(0)}%)`;
  console.log(`  ${name.padEnd(46)} монет ${String(coins.size).padStart(3)} | ${s([...P.pre, ...P.post])} | ${s(P.pre)} / ${s(P.post)}`);
}
const I = (X) => X.ind;
console.log('(A) События на ПРОВЕРКЕ лоукапов: эпизодов | сверх лоукапов дня через 30/90/180 дн (доля в нужную сторону через 90) | до 06.2025 / после');
events('контроль (каждый день, пауза 30)', () => true, -1);
events('V: оборот > 100%, up90 > 100 (ждём «−»)', (X, i) => I(X).turn[i] > 100 && I(X).up90[i] > 100, -1);
events('PF: cf7 > 0,4, оборот > 30%, up90 > 100 («−»)', (X, i) => I(X).cf7[i] > 0.4 && I(X).turn[i] > 30 && I(X).up90[i] > 100, -1);
events('памп на плечах: OI ×2 за 30 дн, up90 > 100 («−»)', (X, i) => I(X).coic30[i] > 100 && I(X).up90[i] > 100, -1);
events('толпа в шортах: cf7 < −1 («−»)', (X, i) => I(X).cf7[i] < -1, -1);
events('капитуляция: vr1 > 3, r14 < −30 («+»)', (X, i) => i > 0 && X.c[i] < X.c[i - 1] && I(X).vr1[i] > 3 && I(X).r14[i] < -30, 1);
// (B) кандидаты
const b = L.evs(G, S0, ['lsel', 'lchk']);
const C = { V: build({ pfs: 0, phi: 1 }), 'V + PF (осторожный)': build({ phi: 1 }), 'V + PF + Ф1,5 (основной)': build({}), 'Ф1,5 один': build({ vs: 0, pfs: 0 }) };
console.log('\n(B) Кандидаты: отбор | ПРОВЕРКА лоукапов (медиана / в плюсе / половин / худшая половина; ср. лог к основе, лучше/хуже, строгая)');
const bs = L.st(b.lchk); console.log(`  основа: проверка ${bs.med.toFixed(0)} / ${bs.pos} / ${bs.hpos} / ${bs.hworst.toFixed(0)}`);
const R = {};
for (const [nm, S] of Object.entries(C)) { const r = (R[nm] = L.evs(G, S, ['lsel', 'lchk']));
  const o = L.cmpLow(r, b, 'lsel'), q = L.cmpLow(r, b, 'lchk');
  console.log(`  ${nm}: отбор ${L.sg(o.dlog)} (${o.u}/${o.d}) ${o.strict ? '✔' : '·'} | проверка ${q.R.med.toFixed(0)} / ${q.R.pos} / ${q.R.hpos} / ${q.R.hworst.toFixed(0)}; ${L.sg(q.dlog)} мед ${L.sg(q.dmed)} (${q.u}/${q.d}, половин ${q.hu}/${q.hd}) ${q.strict ? '✔' : '·'}`);
  for (const [p, f] of [['до', L.onlyBefore], ['после', L.onlyAfter]]) { const fl = f([c('mcsh90', '<', 1)], '2025-06-01'), S2 = nm.startsWith('Ф') ? build({ vs: 0, pfs: 0, fl }) : nm === 'V' ? build({ pfs: 0, phi: 1, fl }) : nm.includes('осторож') ? build({ phi: 1, fl }) : build({ fl });
    const r2 = L.evs(G, S2, ['lchk']), q2 = L.cmpLow(r2, b, 'lchk'); console.log(`      проверка, правила только ${p} 2025-06: ${L.sg(q2.dlog)} (${q2.u}/${q2.d})`); }
}
// (C) по монетам проверки: основной против основы
console.log('\n(C) Проверка, основной вариант против основы — самые большие изменения:');
const rm = R['V + PF + Ф1,5 (основной)'], d = rm.lchk.map((x, i) => ({ n: x.name, a: b.lchk[i].f, z: x.f, h: `${b.lchk[i].h1.toFixed(0)}→${x.h1.toFixed(0)}/${b.lchk[i].h2.toFixed(0)}→${x.h2.toFixed(0)}` })).sort((p, q) => (Math.log1p(q.z / 100) - Math.log1p(q.a / 100)) - (Math.log1p(p.z / 100) - Math.log1p(p.a / 100)));
console.log('  лучше:', d.slice(0, 10).map((x) => `${x.n} ${x.a.toFixed(0)}→${x.z.toFixed(0)}`).join(', '));
console.log('  хуже:', d.slice(-10).reverse().map((x) => `${x.n} ${x.a.toFixed(0)}→${x.z.toFixed(0)} (${x.h})`).join(', '));
