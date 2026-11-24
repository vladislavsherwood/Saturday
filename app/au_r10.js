/* au, круг 10: сборка кандидата из К1 (паника ×1,5 при «серебро хуже золота на 6 п.п.») и К4 (страх ×1,5 при «золото +3% за 30 дн»), необязательные К2, К3;
   плато сочетания, порядок, половины, без одного года, 100 новых по сегментам, монеты пользователя, что металлы говорят сейчас; пишет found/au-best.json и scratchpad/au/margin_rules.json.
   Запуск: node au_r10.js > scratchpad/au/r10.txt */
const fs = require('fs');
const A = require('./au_lib.js'), { c, S6, P, Z, T, BY, MINE, E, cut, sg, L1, polW } = A;
A.L.addInd('agau30', (X) => Float64Array.from(X.ind.ag_r30, (v, i) => v - X.ind.au_r30[i]));
const fear = (q) => q >= 11 && q <= 26, buy = (q) => q <= 8, top = (q) => (q >= 39 && q <= 58) || (q >= 60 && q <= 68);
const tag = (r, t) => Object.assign(r, { au: t });
// сборка: o = { k1: {x, m, age}, k4: {x, m, age}, k2: {x}, k3: {x, m}, order: 'k2first'|'k4first' }
function build(o) {
  const T_ = A.L.clone(S6); const out = [];
  S6.rules.forEach((r0, q) => {
    const r = () => JSON.parse(JSON.stringify(r0)), pre = [];
    if (o.k1 && buy(q)) pre.push(tag({ act: +(1 + (r0.act - 1) * o.k1.m).toFixed(6), conds: [...r().conds, c('agau30', '<', -o.k1.x), c('age', '>', o.k1.age)] }, { family: 'К1: паника + серебро хуже золота', before_rule: q + 1, act_was: r0.act }));
    const k4 = o.k4 && fear(q) ? tag({ act: +Math.max(-1, r0.act * o.k4.m).toFixed(6), conds: [...r().conds, c('au_r30', '>', o.k4.x), c('age', '>', o.k4.age)] }, { family: 'К4: страх + золото растёт', before_rule: q + 1, act_was: r0.act }) : null;
    const k2 = o.k2 && fear(q) ? tag({ act: 1, conds: [...r().conds, c('agau30', '<', -o.k2.x), c('btc200', '<', 1)] }, { family: 'К2: страх + металлы падают вместе', before_rule: q + 1, act_was: r0.act }) : null;
    if (o.order === 'k4first') { if (k4) pre.push(k4); if (k2) pre.push(k2); } else { if (k2) pre.push(k2); if (k4) pre.push(k4); }
    if (o.k3 && top(q)) pre.push(tag({ act: +Math.max(-1, r0.act * o.k3.m).toFixed(6), conds: [...r().conds, c('au_c90', '>', o.k3.x)] }, { family: 'К3: вершина + корреляция BTC–золото', before_rule: q + 1, act_was: r0.act }));
    out.push(...pre, r());
  });
  T_.rules = out; return T_;
}
const K1 = { x: 6, m: 1.5, age: 365 }, K4 = { x: 3, m: 1.5, age: 365 }, K2 = { x: 6 }, K3 = { x: 0.1, m: 1.5 };
const res = {};
const R = (nm, o) => { const S = build(o); const r = A.run(nm, S); res[nm] = { r, S, o }; return r; };
console.log('=== сочетания ===');
R('combo6', {});
R('К1 (age>365)', { k1: K1 }); R('К1 (age>180)', { k1: { ...K1, age: 180 } }); R('К4', { k4: K4 });
R('К1+К4', { k1: K1, k4: K4 }); R('К1(180)+К4', { k1: { ...K1, age: 180 }, k4: K4 });
R('К1+К4+К2 (К2 первым)', { k1: K1, k4: K4, k2: K2, order: 'k2first' }); R('К1+К4+К2 (К4 первым)', { k1: K1, k4: K4, k2: K2, order: 'k4first' });
R('К1+К4+К3', { k1: K1, k4: K4, k3: K3 }); R('К1+К4+К2+К3', { k1: K1, k4: K4, k2: K2, k3: K3, order: 'k2first' });
console.log('=== плато сочетания К1+К4 ===');
for (const x1 of [4, 6, 8, 10]) for (const x4 of [2, 3, 4]) R(`К1 ${x1} + К4 +${x4}%`, { k1: { ...K1, x: x1 }, k4: { ...K4, x: x4 } });
for (const [m1, m4] of [[1.25, 1.25], [1.5, 1.25], [1.25, 1.5], [2, 1.5], [1.5, 2], [2, 2]]) R(`К1 ×${m1} + К4 ×${m4}`, { k1: { ...K1, m: m1 }, k4: { ...K4, m: m4 } });
const CAND = { k1: K1, k4: K4 };
const rc = res['К1+К4'].r, Sc = res['К1+К4'].S;
// без одного года
console.log('=== К1+К4 без одного года ===');
for (const y of [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]) { A.L.addInd('au_y' + y, (X) => Float64Array.from(X.ind.t, (t) => (t >= T(y + '-01-01') && t < T(y + 1 + '-01-01') ? 1 : 0)));
  const S = build(CAND); S.rules.forEach((r) => { if (r.au) r.conds.push(c('au_y' + y, '<', 0.5)); }); A.run(`без ${y}`, S); }
// 100 новых по сегментам, крупные по монетам
const BN = A.base100(), N = P.evc(Sc, polW, ['n100']);
console.log('100 новых по сегментам:', ['big', 'alt', 'meme'].map((s) => { const q = Z.mlog(N, BN, s, ['n100']); return `${s} ${sg(q.m)} ${q.u}/${q.d}`; }).join(', '));
const { BR } = P.baseline();
console.log('крупные (отбор):', rc.R.sel.filter((x) => x.seg === 'big').map((x, i) => { const b = BR.sel.find((y) => y.name === x.name); return `${x.name} ${Math.round(b.f)}→${Math.round(x.f)}`; }).join(' '));
const all = []; for (const g of ['sel', 'ex', 'rnd']) rc.R[g].forEach((x, i) => all.push([x.name, L1(x.f) - L1(BR[g][i].f), BR[g][i].f, x.f]));
all.sort((a, b) => a[1] - b[1]); console.log('хуже всех (81):', all.slice(0, 6).map(([n, d, b, x]) => `${n} ${sg(d)} (${b.toFixed(0)}→${x.toFixed(0)})`).join(', '), '| лучше всех:', all.slice(-6).reverse().map(([n, d, b, x]) => `${n} ${sg(d)} (${b.toFixed(0)}→${x.toFixed(0)})`).join(', '));
// сколько дней работают части (81 + 100 новых), по годам
const cnt = { К1: {}, К4: {} };
for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const X of A.G[g]) { const I = X.ind; for (let j = 0; j < X.n; j++) { const q = Sc.rules.findIndex((r) => r.conds.every((cd) => I[cd.ind] && (cd.op === '<' ? I[cd.ind][j] < cd.v : I[cd.ind][j] > cd.v))); const r = Sc.rules[q]; if (r && r.au) { const k = r.au.family.slice(0, 2), y = A.day(I.t[j]).slice(0, 4); cnt[k][y] = (cnt[k][y] || 0) + 1; } } }
console.log('монето-дни срабатывания по годам:', Object.entries(cnt).map(([k, v]) => `${k}: ${Object.entries(v).sort().map(([y, n]) => `${y} ${n}`).join(', ')}`).join(' | '));
// монеты пользователя
console.log('=== монеты пользователя: итог к DCA, % (вся история | 2026 с нуля), combo6 → кандидат ===');
const mine = [];
for (const nm of MINE) { const Y = BY[nm]; if (!Y) { console.log(nm, 'нет'); continue; } const Zc = cut(Y, '2026-01-01');
  const v = [S6, Sc].map((S) => E(Y, S, polW)), w = [S6, Sc].map((S) => E(Zc, S, polW));
  const S2 = res['К1+К4+К2 (К2 первым)'].S, v2 = E(Y, S2, polW), w2 = E(Zc, S2, polW);
  mine.push({ coin: nm, full: v.map((x) => +x.toFixed(1)), y2026: w.map((x) => +x.toFixed(1)), with_K2: { full: +v2.toFixed(1), y2026: +w2.toFixed(1) } });
  console.log(`${nm.padEnd(9)} ${v.map((x) => x.toFixed(1)).join(' → ')} (${sg(L1(v[1]) - L1(v[0]))}) | ${w.map((x) => x.toFixed(1)).join(' → ')} || с К2: ${v2.toFixed(1)} (${sg(L1(v2) - L1(v[0]))}) | ${w2.toFixed(1)}`); }
// что сейчас
const B = BY.BTC, i = B.n - 1, I = B.ind;
const mk = A.MK; const last = (s) => [mk[s].d[mk[s].d.length - 1], mk[s].c[mk[s].c.length - 1]];
const now = { stand_day: A.day(B.t[i]), au_r30: +I.au_r30[i].toFixed(2), ag_r30: +I.ag_r30[i].toFixed(2), agau30: +I.agau30[i].toFixed(2), au_ath: +I.au_ath[i].toFixed(1), ag_ath: +I.ag_ath[i].toFixed(1), au_c90: +I.au_c90[i].toFixed(2), bg: +I.bg[i].toFixed(2), bg_s200: +I.bg_s200[i].toFixed(3), btc200: +I.btc200[i].toFixed(3), fng: I.fng[i], gold_last: last('GC=F'), silver_last: last('SI=F') };
console.log('сейчас:', JSON.stringify(now));
// последние 60 дней стенда BTC: какие правила кандидата сработали бы
const hits = []; for (let j = Math.max(0, B.n - 90); j < B.n; j++) { const q = Sc.rules.findIndex((r) => r.conds.every((cd) => I[cd.ind] && (cd.op === '<' ? I[cd.ind][j] < cd.v : I[cd.ind][j] > cd.v))); const r = Sc.rules[q]; if (r && r.au) hits.push(`${A.day(I.t[j])} ${r.au.family.slice(0, 2)} (правило ${r.au.before_rule})`); }
console.log('BTC, последние 90 дней — дни, где решает добавка кандидата:', hits.join(', ') || 'нет');
const H = {}; for (const nm of MINE) { const Y = BY[nm]; if (!Y) continue; const J = Y.ind; for (let j = Math.max(0, Y.n - 90); j < Y.n; j++) { const q = Sc.rules.findIndex((r) => r.conds.every((cd) => J[cd.ind] && (cd.op === '<' ? J[cd.ind][j] < cd.v : J[cd.ind][j] > cd.v))); const r = Sc.rules[q]; if (r && r.au) { const k = `${nm} ${r.au.family.slice(0, 2)}`; H[k] = H[k] || []; H[k].push(A.day(J.t[j]).slice(5)); } } }
console.log('монеты пользователя, последние 90 дней:', Object.entries(H).map(([k, v]) => `${k}: ${v.length} дн. (${v[0]}…${v[v.length - 1]})`).join('; ') || 'нет');
// файлы
const pack = (r) => ({ sel: Math.round(r.RS.sel.all.med), ex: Math.round(r.RS.ex.all.med), rnd: Math.round(r.RS.rnd.all.med), income: { all: +r.dseg.all.toFixed(3), big: +r.dseg.big.toFixed(3), alt: +r.dseg.alt.toFixed(3), meme: +r.dseg.meme.toFixed(3) }, strict: !r.w, strict_fail: r.w || null,
  n100: { mlog: +r.n100.m.toFixed(4), better: r.n100.u, worse: r.n100.d, median: Math.round(r.n100.med) }, halves_income: [+r.hv.h1.toFixed(3), +r.hv.h2.toFixed(3)], mlog81: +r.m81.m.toFixed(4), better_worse81: `${r.m81.u}/${r.m81.d}` });
const SD = '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/au';
const S2 = res['К1+К4+К2 (К2 первым)'].S;
fs.writeFileSync(SD + '/margin_rules.json', JSON.stringify({ combo6: S6.rules, 'au-best': Sc.rules.map(({ act, conds }) => ({ act, conds })), 'au-best+К2': S2.rules.map(({ act, conds }) => ({ act, conds })) }));
fs.writeFileSync(SD + '/r10.json', JSON.stringify({ results: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, pack(v.r)])), mine, now }, null, 1));
module.exports = { build, CAND, res, Sc, mine, now, pack };
