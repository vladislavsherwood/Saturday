/* tune4: шлифовка вершин и возврата в combo2 (быстрый оценщик combo2_sim.js).
   Параметры моей части (P, по умолчанию — как в combo2):
   qa/qo/qs — узкая тихая вершина: BTC < qa% от максимума, доля альтов за 90 дн > qo п.п. → продать qs (при 10/1,5 совпадает с индикатором qt);
   wa/wo/ws — широкая: BTC < wa%, доля альтов > wo → ws;
   bqq/bqw — множитель «крупной» (B65) на узкой / широкой; a1k — множитель альта (A1) на широкой;
   rD/rf/rs — возврат: ≤ rD дней после тихой вершины (определение вершины — по текущим qa/qo/wa/wo, если agoFix не задан), жадность > rf, новый 90-дн. максимум → купить rs резерва;
   pa/pu/ps — памп в медвежьем: BTC > pa% ниже максимума, монета > pu% от 90-дн. минимума → продать ps;
   asf/aso/asz — AS: альт, жадность > asf, доля альтов за 90 дн > aso → продать asz.
   Использование: const T = require('./tune4_sim.js'); const G = T.load(); const r = T.run(G, { qs: 0.42 }) */
const Z = require('./combo2_sim.js'); const { c } = Z;
const B4 = require('./agent4b_sim.js');
const D0 = { qa: 10, qo: 1.5, qs: 0.4, wa: 15, wo: 1, ws: 0.5, bqq: 1.5, bqw: 1.5, a1k: 1.25, rD: 45, rf: 52, rs: 0.1, pa: 20, pu: 300, ps: 0.1, asf: 65, aso: 1, asz: 0.1 };
const OPT = { a1: true, as: true, cm2: true, b65: 'list' };
const r6 = (v) => +v.toFixed(6);
function agoKey(P) { return P.agoFix ? 'ago_qt' : `ago4_${P.qa}_${P.qo}_${P.wa}_${P.wo}`; }
function ensureAgo(G, P) {
  const k = agoKey(P); if (k === 'ago_qt') return k;
  for (const g in G) for (const X of G[g]) if (!X.ind[k]) { const I = X.ind; X.ind[k] = B4.since(X.n, (i) => (I.btcath[i] < P.qa && I.oth90[i] > P.qo) || (I.btcath[i] < P.wa && I.oth90[i] > P.wo)); }
  return k;
}
function raw(P, ak) {
  const R = Z.RAW.rules.slice(0, 18);
  R.push({ act: -P.qs, conds: [c('btcath', '<', P.qa), c('oth90', '>', P.qo)], q: 'qt' });
  R.push({ act: -P.ws, conds: [c('btcath', '<', P.wa), c('oth90', '>', P.wo)], q: 'wide' });
  R.push({ act: r6(1 + P.rs), conds: [c(ak, '<', P.rD + 0.5), c(ak, '>', 0.5), c('fng', '>', P.rf), c('hi90', '>', 0.5)] });
  R.push({ act: -P.ps, conds: [c('btcath', '>', P.pa), c('up90', '>', P.pu)], q: 'pump' });
  return R;
}
const cls = (r) => r.q || Z.cls(r);
function build(G, p = {}) {
  const P = { ...D0, ...p }; const ak = ensureAgo(G, P);
  const o = { ...OPT, asf: P.asf, asz: P.asz };
  const M = Z.mods(o);
  for (const m of M) { if (m.id === 'B65') { m.k.qt = P.bqq; m.k.wide = P.bqw; } if (m.id === 'A1') m.k.wide = P.a1k; }
  const rules = [];
  for (const r of raw(P, ak)) {
    const q = cls(r);
    if (!q) { rules.push(r); continue; }
    const app = M.filter((m) => (m.k[q] || 1) !== 1);
    const subs = [];
    for (let mask = 1; mask < 1 << app.length; mask++) {
      const sub = app.filter((_, i) => mask & (1 << i));
      if (sub.some((m) => m.req && !sub.some((x) => x.id === m.req))) continue;
      if (sub.some((m) => m.ex && sub.some((x) => m.ex.includes(x.id)))) continue;
      subs.push(sub);
    }
    subs.sort((a, b) => b.length - a.length);
    for (const sub of subs) {
      let k = 1; for (const m of sub) k *= m.k[q] || 1; if (Math.abs(k - 1) < 1e-12) continue;
      const act = Math.max(-1, r6(r.act * k));
      let combos = [[]];
      for (const m of sub) combos = combos.flatMap((cs) => m.sets.map((s) => [...cs, ...s]));
      const SEGF = ['isbig', 'meme', 'isalt'];
      for (const cs of combos) if (new Set(cs.filter((x) => SEGF.includes(x.ind) && x.op === '>').map((x) => x.ind)).size < 2) rules.push({ act, conds: [...r.conds, ...cs] });
    }
    rules.push({ act: r.act, conds: r.conds });
  }
  rules.push({ act: -P.asz, conds: [c('isalt', '>', 0.5), c('fng', '>', P.asf), c('oth90', '>', P.aso)] });
  return { base: Z.RAW.base, rules };
}
let G0 = null;
const load = () => G0 || (G0 = Z.load());
const GR = ['sel', 'ex', 'rnd'];
let BS = null, Bc = null;
function base(G) { if (!BS) { Bc = Z.evc(G, Z.build(OPT), [...GR, 'n100']); BS = Z.sum(Bc); } return { b: Bc, bs: BS }; }
// «мягкая» строгая: те же пункты, но худшая монета/половина с допуском 0,15 п.п. (только для суждения о плато)
function soft(R, B, s, tol = 0.15) { let n = 0; for (const g of GR) { const x = R[g][s], y = B[g][s]; if (!x) continue; if (x.pos < y.pos) n++; if (x.hpos < y.hpos) n++; if (x.hworst < y.hworst - tol) n++; if (g !== 'rnd' && x.worst < y.worst - tol) n++; } return n; }
// оценка варианта к combo2: доход (сумма лог-медиан) всего и сегментов, строгая всего и по сегментам
function run(G, p = {}, list = GR) {
  const { bs } = base(G); const S = build(G, p);
  const r = Z.evc(G, S, list), R = Z.sum(r);
  const d = {}, f = {};
  for (const s of Z.SEGS) { d[s] = +(Z.inc(R, s) - Z.inc(bs, s)).toFixed(4); f[s] = Z.strict(R, bs, s); }
  const nf = Object.values(f).reduce((t, a) => t + a.length, 0);
  let ns = 0; for (const s of Z.SEGS) ns += soft(R, bs, s);
  return { p, d, f, nf, ns, ok: nf === 0, R, r, med: Object.fromEntries(list.map((g) => [g, +R[g].all.med.toFixed(1)])) };
}
const line = (x) => `d=${x.d.all.toFixed(4)} крп ${x.d.big.toFixed(4)} альт ${x.d.alt.toFixed(4)} мем ${x.d.meme.toFixed(4)} ${x.ok ? '✔' : '·' + x.nf + (x.ns ? '' : '(мягк✔)') + ' ' + Object.entries(x.f).filter(([, a]) => a.length).map(([s, a]) => s + ':' + a.slice(0, 2).join(',')).join(' ')} | ${GR.map((g) => x.med[g]).join('/')}`;
// перебор одного параметра (или пары) вокруг P; печать и запись
function sweep(G, name, vals, P = {}) {
  const out = [];
  for (const v of vals) { const x = run(G, { ...P, [name]: v }); out.push({ v, d: x.d, nf: x.nf, ns: x.ns, ok: x.ok, f: x.f, med: x.med }); console.log(`${name}=${String(v).padEnd(7)} ${line(x)}`); }
  return out;
}
const rng = (a, b, s) => { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(+v.toFixed(4)); return o; };
module.exports = { Z, D0, OPT, build, load, run, base, line, sweep, rng, GR };
