/* imp7, круг 4: устойчивость кандидата «в медвежьем режиме разворот не возвращает весь резерв» (разворот ×0 / ×0,5).
   (а) плато по определению режима: rb200 < x (с наклоном средней 200 < 0 и без), rw50 < x, просадка BTC > y, «медведь старше N дней»;
   (б) при разных порогах разворота btcr30 (18/19/20/22/25 — край обрыва агента 2): помогает ли фильтр на каждом пороге;
   (в) события: дни первого срабатывания разворота в режиме МЕДВЕДЬ, BTC тогда и через 30/90/180 дней.
   Запуск: node app/imp7_loop4.js */
const M = require('./imp7_sim.js');
const G = M.groups(['sel', 'ex', 'rnd']); M.prep(G);
const DEF = [];
for (const x of [0.9, 0.95, 1.0, 1.05, 1.1]) { DEF.push([`rb200<${x} & наклон<0`, (I, i) => I.rb200[i] < x && I.rsl[i] < 0]); DEF.push([`rb200<${x}`, (I, i) => I.rb200[i] < x]); }
for (const x of [0.9, 1.0, 1.1]) DEF.push([`rw50<${x}`, (I, i) => I.rw50[i] < x]);
for (const s of [-2, 2]) DEF.push([`rb200<1 & наклон<${s}`, (I, i) => I.rb200[i] < 1 && I.rsl[i] < s]);
for (const y of [30, 40, 50, 60]) DEF.push([`rath>${y}`, (I, i) => I.rath[i] > y]);
for (const y of [40, 50]) DEF.push([`rath>${y} & rb200<1`, (I, i) => I.rath[i] > y && I.rb200[i] < 1]);
for (const nd of [90, 180, 365]) DEF.push([`rdays>${nd} & rb200<1`, (I, i) => I.rdays[i] > nd && I.rb200[i] < 1]);
DEF.push(['наклон<0 (только)', (I, i) => I.rsl[i] < 0]);
DEF.forEach(([, f], q) => M.addFlag(G, 'bf' + q, f));
const CS = M.cycSlices(G), base = M.ev(G, M.B0, false), cb = M.cycEv(CS, M.B0);
const isRev = (k) => k === 'rev';
const out = { a: [], b: [] };
console.log('(а) определение медведя | разворот ×0: доход, строгая, циклы | ×0,5: доход, строгая, циклы');
DEF.forEach(([nm], q) => {
  const row = [nm];
  for (const k of [0, 0.5]) {
    const S = M.scaleK(M.B0, 'bf' + q, k, isRev), r = M.ev(G, S, false), cc = M.cycCmp(M.cycEv(CS, S), cb);
    row.push(`${M.d(r, base) >= 0 ? '+' : ''}${M.d(r, base).toFixed(3)} ${M.passes(r, base) ? '✔' : '✘(' + M.why(r, base) + ')'} ${M.cycStr(cc)} ${M.sameSign(cc)}`);
    out.a.push({ nm, k, d: M.d(r, base), pass: M.passes(r, base), cyc: cc });
  }
  console.log(row.join(' || '));
});
// (б) порог разворота
console.log('\n(б) порог разворота btcr30 (во всех правилах разворота) — без фильтра к основе; с фильтром (rb200<1 & наклон<0, ×0) к тому же порогу без фильтра');
const qb = DEF.findIndex(([nm]) => nm === 'rb200<1 & наклон<0');
const thr = (S, v) => ({ ...S, rules: S.rules.map((r) => ({ ...r, conds: r.conds.map((cd) => (cd.ind === 'btcr30' ? { ...cd, v } : cd)) })) });
for (const v of [17, 18, 19, 20, 21, 22, 25]) {
  const S0 = thr(M.B0, v), r0 = M.ev(G, S0, false), S1 = M.scaleK(S0, 'bf' + qb, 0, isRev), r1 = M.ev(G, S1, false);
  const c0 = M.cycEv(CS, S0), cc = M.cycCmp(M.cycEv(CS, S1), c0);
  console.log(`btcr30>${v}: без фильтра к основе ${M.d(r0, base).toFixed(3)} | фильтр к тому же порогу ${M.d(r1, r0) >= 0 ? '+' : ''}${M.d(r1, r0).toFixed(3)} ${M.passes(r1, r0) ? '✔' : '✘(' + M.why(r1, r0) + ')'} | ${M.cycStr(cc)} | к основе ${M.d(r1, base).toFixed(3)}`);
  out.b.push({ v, d0: M.d(r0, base), d1: M.d(r1, r0), pass: M.passes(r1, r0), cyc: cc });
}
// (в) события
console.log('\n(в) разворот (BTC +20% за 30 дн) в режиме МЕДВЕДЬ (rb200<1 & наклон<0): первый день серии, BTC, через 30/90/180 дн; был ли раньше в серии день вне режима');
const B = G.sel.find((X) => X.name === 'BTC'), I = B.ind, d = (t) => new Date(t * 864e5).toISOString().slice(0, 10);
let prev = -99;
for (let i = 1; i < B.n; i++) {
  const on = I.btcr30[i] > 20;
  if (on && !(I.btcr30[i - 1] > 20) && i - prev > 20) {
    const bear = I.rb200[i] < 1 && I.rsl[i] < 0, f = (h) => (i + h < B.n ? ((B.c[i + h] / B.c[i] - 1) * 100).toFixed(0) : '—');
    console.log(`${d(B.t[i])} BTC ${B.c[i].toFixed(0)} rb200 ${I.rb200[i].toFixed(2)} наклон ${I.rsl[i].toFixed(1)} rath ${I.rath[i].toFixed(0)} ${bear ? 'МЕДВЕДЬ' : '       '} через 30/90/180: ${f(30)}/${f(90)}/${f(180)}%`);
  }
  if (on) prev = i;
}
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp7/loop4.json', JSON.stringify(out));
