/* Агент «ЛОУКАП», круг 6: деривативы самой монеты — OI и фандинг Binance, объём перпа Hyperliquid.
   Признаки (только прошлое): coidd30 — OI монеты от 30-дн. максимума, %; coic30 — рост OI за 30 дн, %; coimc — OI к капитализации, %;
   cf7/cf30 — сумма фандинга за 7/30 дн, %; hvr — объём перпа Hyperliquid к объёму CMC (7 дн), %.
   (A) события (пауза 30 дн; сверх медианы лоукапов того же дня; до/после 2025-06):
       вынос плеч на монете (OI −40/−50% от 30-дн. максимума при падении монеты), рост OI на пампе (OI ×2 за 30 дн и up90 > 100),
       толпа в лонгах на пампе (cf7 > 0,1/0,3% и up90 > 100), толпа в шортах (cf7 < −0,3/−1%), перегрузка плечом (OI > 30/50% капитализации),
       V с подтверждением фандинга/OI против V без него.
   (B) правила: V, расширенный «пампом на плечах»; покупка паники лоукапа только после выноса OI монеты (форма «взнос, пока OI не вынесен»).
   Запуск: node app/lowcap_loop6.js */
const L = require('./lowcap_sim.js'), { c } = L;
const G = L.load(), S0 = L.S0;
const H = [30, 90, 180], pct = (v) => (isNaN(v) ? '  -' : ((v >= 0 ? '+' : '') + (100 * v).toFixed(0)).padStart(4));
for (const g in G) for (const X of G[g]) { const I = X.ind, v7 = L.rollMean(I.vusd, 7), h7 = L.rollMean(I.hv, 7); I.hvr = Float64Array.from(v7, (v, i) => (h7[i] / v) * 100);
  const mx = L.rollMaxN(I.coi, 90); I.coidd90 = Float64Array.from(I.coi, (x, i) => (x / mx[i] - 1) * 100); }
const A = G.lsel;
const xs = {}; for (const h of H) { const m = new Map(); for (const X of A) for (let i = 0; i + h < X.n; i++) { const t = X.t[i]; if (!m.has(t)) m.set(t, []); m.get(t).push(X.c[i + h] / X.c[i] - 1); } xs[h] = new Map([...m].map(([t, v]) => [t, L.med(v)])); }
const exr = (X, i, h) => (i + h < X.n && xs[h].has(X.t[i]) ? (X.c[i + h] / X.c[i]) / (1 + xs[h].get(X.t[i])) - 1 : NaN);
function events(name, cond, dir) {
  const P = { pre: [], post: [] }, coins = new Set();
  for (const X of A) { let last = -1e9; for (let i = 0; i < X.n; i++) if (cond(X, i) && i - last >= 30) { last = i; coins.add(X.name); P[X.t[i] < L.SPLIT ? 'pre' : 'post'].push(H.map((h) => exr(X, i, h))); } }
  const s = (E) => `${String(E.length).padStart(3)} эп. ${H.map((h, q) => pct(L.med(E.map((x) => x[q]).filter((v) => !isNaN(v))))).join(' ')} (${(100 * E.filter((x) => x[1] * dir > 0).length / Math.max(1, E.filter((x) => !isNaN(x[1])).length)).toFixed(0)}%)`;
  console.log(`  ${name.padEnd(52)} монет ${String(coins.size).padStart(3)} | ${s([...P.pre, ...P.post])} | ${s(P.pre)} / ${s(P.post)}`);
}
const I = (X) => X.ind;
const have = (k) => A.filter((X) => [...X.ind[k]].some((v) => !isNaN(v) && v !== 0)).length;
console.log(`Отбор лоукапов: OI есть у ${have('coi')} монет, фандинг у ${have('cf')}, объём Hyperliquid у ${have('hv')}.`);
console.log('(A) События: эпизодов | сверх лоукапов дня через 30/90/180 дн (доля в нужную сторону через 90) | до 06.2025 / после');
console.log(' ДНО («+»):');
events('контроль: дни с данными OI', (X, i) => !isNaN(I(X).coidd30[i]), 1);
for (const d of [40, 50, 60]) events(`вынос OI: OI < −${d}% от 30-дн. макс., монета −20% за 14 дн`, (X, i) => I(X).coidd30[i] < -d && I(X).r14[i] < -20, 1);
for (const d of [60, 75]) events(`вынос OI: OI < −${d}% от 90-дн. макс.`, (X, i) => I(X).coidd90[i] < -d, 1);
for (const f of [-0.3, -1, -2]) events(`толпа в шортах: фандинг 7 дн < ${f}%`, (X, i) => I(X).cf7[i] < f, 1);
console.log(' ВЕРШИНА («−»):');
for (const f of [0.1, 0.3]) events(`толпа в лонгах на пампе: cf7 > ${f}%, up90 > 100`, (X, i) => I(X).cf7[i] > f && I(X).up90[i] > 100, -1);
events('памп на плечах: OI ×2 за 30 дн, up90 > 100', (X, i) => I(X).coic30[i] > 100 && I(X).up90[i] > 100, -1);
events('памп на плечах: OI ×3 за 30 дн, up90 > 100', (X, i) => I(X).coic30[i] > 200 && I(X).up90[i] > 100, -1);
for (const k of [30, 50]) events(`перегрузка: OI > ${k}% капитализации`, (X, i) => I(X).coimc[i] > k, -1);
events('перп Hyperliquid > 50% объёма CMC (7 дн), up90 > 100', (X, i) => I(X).hvr[i] > 50 && I(X).up90[i] > 100, -1);
const Vc = (X, i) => I(X).turn[i] > 100 && I(X).up90[i] > 100;
events('V (оборот > 100%, up90 > 100)', Vc, -1);
events('V и фандинг 7 дн > 0,1%', (X, i) => Vc(X, i) && I(X).cf7[i] > 0.1, -1);
events('V и фандинг 7 дн ≤ 0,1% (или нет)', (X, i) => Vc(X, i) && !(I(X).cf7[i] > 0.1), -1);
events('V и OI ×2 за 30 дн', (X, i) => Vc(X, i) && I(X).coic30[i] > 100, -1);
events('памп без V: up90 > 100, оборот 30–100%, cf7 > 0,1%', (X, i) => I(X).up90[i] > 100 && I(X).turn[i] > 30 && I(X).turn[i] <= 100 && I(X).cf7[i] > 0.1, -1);
// (B) правила
const b = L.evs(G, S0), iF = S0.rules.findIndex(L.isPump), LC = c('mcsh90', '<', 1);
const show = (tag, S) => { const r = L.evs(G, S), lo = L.cmpLow(r, b, 'lsel'), sd = L.cmpStd(r, b); console.log(`${tag}: ЛОтбор ср.лог ${L.sg(lo.dlog)} мед ${L.sg(lo.dmed)} ${lo.u}/${lo.d} [${lo.R.pos}/${lo.R.hpos}/${lo.R.hworst.toFixed(0)}] ${lo.strict ? '✔' : '·'} | стенд ${L.sg(sd.inc)} ${sd.pass ? '✔' : '·' + sd.why} [${['sel', 'ex', 'rnd', 'n100'].map((g) => sd.R[g].med.toFixed(0) + '/' + sd.R[g].hworst.toFixed(0)).join(' ')}] 100н ${L.bw(r, b, 'n100').join('/')}`); return r; };
console.log('\n(B) Правила');
const SV = L.addRule(S0, { act: -0.2, conds: [LC, c('turn', '>', 100), c('up90', '>', 100)] }, iF); show('V (20%)', SV);
for (const f of [0.1, 0.3]) for (const s of [0.1, 0.2]) show(`V + памп на фандинге (cf7 > ${f}, up90 > 100, оборот > 30%) → ${s * 100}%`, L.addRule(SV, { act: -s, conds: [LC, c('cf7', '>', f), c('up90', '>', 100), c('turn', '>', 30)] }, iF + 1));
for (const s of [0.1, 0.2]) show(`V + памп на плечах (OI ×2 за 30 дн, up90 > 100) → ${s * 100}%`, L.addRule(SV, { act: -s, conds: [LC, c('coic30', '>', 100), c('up90', '>', 100)] }, iF + 1));
for (const d of [40, 50]) show(`V + лоукап: паника → взнос, пока OI монеты не вынесен (coidd30 > −${d})`, L.pre(SV, L.isPanic, [LC, c('coidd30', '>', -d)], 1, { grp: 0 }));
for (const d of [40, 50]) show(`V + лоукап: вынос OI (coidd30 < −${d}) и монета −20% за 14 дн → купить 10% резерва (в начале)`, L.addRule(SV, { act: 1.1, conds: [LC, c('coidd30', '<', -d), c('r14', '<', -20)] }, 0));
// (C) устойчивость лучших форм: правило разрешено только до / только после 2025-06; плато фандинга и оборота
console.log('\n(C) Только до / только после 2025-06 (добавка к V)');
const add = (S, cd, s, pos) => L.addRule(S, { act: -s, conds: cd }, pos);
const FV = [LC, c('cf7', '>', 0.1), c('up90', '>', 100), c('turn', '>', 30)], OV = [LC, c('coic30', '>', 100), c('up90', '>', 100)];
for (const [nm, cd] of [['памп на фандинге 20%', FV], ['памп на плечах 10%', OV]]) { const s = nm.includes('20') ? 0.2 : 0.1;
  show(`${nm} | только до`, add(SV, L.onlyBefore(cd, '2025-06-01'), s, iF + 1)); show(`${nm} | только после`, add(SV, L.onlyAfter(cd, '2025-06-01'), s, iF + 1)); }
show('паника → взнос, пока OI не вынесен (−50) | только до', L.pre(SV, L.isPanic, L.onlyBefore([LC, c('coidd30', '>', -50)], '2025-06-01'), 1, { grp: 0 }));
show('паника → взнос, пока OI не вынесен (−50) | только после', L.pre(SV, L.isPanic, L.onlyAfter([LC, c('coidd30', '>', -50)], '2025-06-01'), 1, { grp: 0 }));
console.log('\n(C) Плато «памп на фандинге» (добавка к V): cf7 × оборот × доля');
for (const f of [0.05, 0.1, 0.2]) for (const t of [0, 30, 50]) for (const s of [0.1, 0.2, 0.3]) show(`cf7 > ${f}, оборот > ${t}%, up90 > 100 → ${s * 100}%`, add(SV, [LC, c('cf7', '>', f), c('up90', '>', 100), ...(t ? [c('turn', '>', t)] : [])], s, iF + 1));
for (const u of [50, 200]) show(`cf7 > 0.1, оборот > 30%, up90 > ${u} → 20%`, add(SV, [LC, c('cf7', '>', 0.1), c('up90', '>', u), c('turn', '>', 30)], 0.2, iF + 1));
show('то же без флага лоукапа (все монеты)', add(SV, [c('cf7', '>', 0.1), c('up90', '>', 100), c('turn', '>', 30)], 0.2, iF + 1));
console.log('\n(C) Край по фандингу (строгая стенда ломается на 2-й половине ARIA при cf7 ≤ 0,2)');
for (const f of [0.25, 0.3, 0.4, 0.5]) for (const s of [0.1, 0.2, 0.3]) show(`cf7 > ${f}, оборот > 30%, up90 > 100 → ${s * 100}%`, add(SV, [LC, c('cf7', '>', f), c('up90', '>', 100), c('turn', '>', 30)], s, iF + 1));
for (const [nm, cd] of [['cf7 > 0,3 20% | только до', L.onlyBefore([LC, c('cf7', '>', 0.3), c('up90', '>', 100), c('turn', '>', 30)], '2025-06-01')], ['cf7 > 0,3 20% | только после', L.onlyAfter([LC, c('cf7', '>', 0.3), c('up90', '>', 100), c('turn', '>', 30)], '2025-06-01')]]) show(nm, add(SV, cd, 0.2, iF + 1));
