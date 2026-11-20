/* panicx: точнее покупки «паники в стейблах» поверх combo3 без tune1 (found/combo3-best.json = combo3_sim.make({simp,t2,t3})).
   Свой движок (копия agent_sim.edge без шортов/модов) с «политикой» для правил паники: можно откладывать часть покупки в «долг»
   и тратить его при подтверждении / в конце эпизода, ограничивать деньги на эпизод и т. п. Всё по прошлым данным, решение по вчерашнему дню.
   Индикаторы эпизода паники (паника = usdt > 1,07 и othd < 25, как panicd; эпизод — дни паники с разрывами ≤ GAP дней):
     pday — день эпизода (0 — не паника), pdrop — падение монеты от закрытия первого дня эпизода, %, bdrop — то же у BTC,
     pmin — рост монеты от минимума эпизода, %, pupk — usdt к максимуму usdt в эпизоде, pend — эпизод закончился (GAP дней без паники).
   Использование: const P = require('./panicx_sim.js'); P.report(имя, S, pol) */
const Z = require('./combo2_sim.js'), C3 = require('./combo3_sim.js');
const FEE = 0.001, UNIT = 10, H = 120, GAP = 10;
const base = C3.make({ simp: 1, t2: 1, t3: 1 });
const isP = (r) => r.act > 1.0001 && r.conds.some((c) => c.ind === 'usdt');
let G = null;
function load() {
  if (G) return G;
  G = Z.load(['sel', 'ex', 'rnd', 'n100']);
  for (const g in G) for (const X of G[g]) episodes(X);
  return G;
}
function rsiOf(c, n, w = 14) {
  const o = new Float64Array(n).fill(NaN); let ag = 0, al = 0;
  for (let i = 1; i < n; i++) {
    const d = c[i] - c[i - 1], g = Math.max(d, 0), l = Math.max(-d, 0);
    if (!isFinite(d)) { o[i] = o[i - 1]; continue; }
    if (i <= w) { ag += g / w; al += l / w; if (i === w) o[i] = 100 - 100 / (1 + ag / (al || 1e-12)); }
    else { ag = (ag * (w - 1) + g) / w; al = (al * (w - 1) + l) / w; o[i] = 100 - 100 / (1 + ag / (al || 1e-12)); }
  }
  return o;
}
function episodes(X) {
  const n = X.n, I = X.ind, c = X.c, b = I.btcp;
  const pday = new Float64Array(n), pdrop = new Float64Array(n).fill(NaN), bdrop = new Float64Array(n).fill(NaN), pmin = new Float64Array(n).fill(NaN), pupk = new Float64Array(n).fill(NaN), pend = new Float64Array(n);
  let st = -1, last = -1e9, mn = Infinity, uk = 0;
  for (let i = 0; i < n; i++) {
    const on = I.usdt[i] > 1.07 && I.othd[i] < 25;
    if (on) { if (i - last > GAP) { st = i; mn = Infinity; uk = 0; } last = i; }
    if (st >= 0 && i - last <= GAP) {
      if (c[i] < mn) mn = c[i]; if (I.usdt[i] > uk) uk = I.usdt[i];
      pday[i] = on ? i - st + 1 : 0; // 0 — в разрыве
      pdrop[i] = (1 - c[i] / c[st]) * 100; bdrop[i] = b && b[st] > 0 ? (1 - b[i] / b[st]) * 100 : NaN;
      pmin[i] = (c[i] / mn - 1) * 100; pupk[i] = I.usdt[i] / uk;
      pend[i] = !on && i - last === GAP ? 1 : 0;
    }
  }
  Object.assign(I, { pday, pdrop, bdrop, pmin, pupk, pend });
  if (b) { const bb = Float64Array.from(b); for (let i = 1; i < n; i++) if (!isFinite(bb[i])) bb[i] = bb[i - 1]; I.brsi = rsiOf(bb, n); }
}
const compile = (X, rules) => rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])).map((r) => ({ act: r.act, p: isP(r), cs: r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v]), r }));
function decide(R, j) { for (let q = 0; q < R.length; q++) { const cs = R[q].cs; let ok = true; for (let k = 0; k < cs.length; k++) { const v = cs[k][0][j]; if (!(cs[k][1] ? v < cs[k][2] : v > cs[k][2])) { ok = false; break; } } if (ok) return q; } return -1; }
/* pol — политика для правил паники (необязательно):
   pol.buy(ctx) → доля резерва, которую правило паники тратит сегодня (share = act − 1 по умолчанию); остаток (share − доля) × before уходит в «долг», $
   pol.release(ctx) → доля долга (0…1), которая тратится сегодня (вызывается в любой день покупки/взноса, не в день продажи)
   pol.extra(ctx) → доля резерва (before), которую докупить сегодня сверх правила (в любой день покупки/взноса).
   pol.other(rule) / buyO / releaseO / expireO — то же для второго «долга» (другие правила покупки, не паника), st.oo $.
   ctx: {X, j (день решения), share, before, st: {owed $, spent $, r0 — резерв на старте эпизода}}. Долг сгорает (остаётся в резерве) в конце эпизода (pend), если release его не потратил. */
function edge(X, S, lag, part = 'full', rec = false, pol = null) {
  let a0 = 0, b = X.n; if (part === 'h1') b = Math.floor(X.n / 2); if (part === 'h2') a0 = Math.floor(X.n / 2);
  const c = X.c, R = compile(X, S.rules), I = X.ind;
  let cash = 0, units = 0, du = 0, st = { owed: 0, spent: 0, r0: 0, ep: -1 }; const tr = rec ? [] : null;
  /* wk (2026-11-19): расширения «ловушки для фитилей» pol.wick — все необязательные; без них поведение прежнее (dcaf):
       once  — уровень исполняется не больше одного раза за окно заявок (every > 1: заявка исполнилась — до следующего обновления её нет);
       size: 'place' — размер заявки фиксируется при выставлении: f × резерв на момент обновления (не больше текущего резерва);
       min(X, lim) → минимальная заявка в единицах стенда (или число); merge: 'down' | 'up' — мелкие уровни объединить с более глубоким / мелким (иначе пропустить);
       lv(X, jj) — уровни функцией дня выставления (волатильность, сегмент); ref(X, jj) — опорная цена (по умолчанию закрытие дня jj);
       phase — сдвиг календаря обновлений (every > 1): день выставления — (t + phase) % every == 0;
       first — исполнять до сделки правила (фитиль внутри дня, правило — по закрытию); fee — комиссия заявки (мейкер);
       pan: 'protect' — не тратить долг отложенной паники (резерв − owed) | 'spend' — покупка фитиля гасит долг | 'off' — без заявок, пока есть долг;
       cool — после исполнения N дней без заявок; mult(X, jj) — множитель долей на окно;
       exit: { up | ref, days } — лимит на продажу купленного на фитиле: +up от цены покупки или возврат к опорной цене (со следующего дня), лот держится до days дней. */
  const w = pol && pol.wick ? pol.wick : null, wfee = w && w.fee != null ? w.fee : FEE;
  const wk = w ? { jj: NaN, done: null, base: 0, ref: 0, lv: null, amt: null, lots: [], cool: -1e9 } : null;
  const wickStep = (i, j, before) => {
    if (!(j >= 0 && I.age[j] > (w.age || 60) && (!w.day || w.day(X, i)))) return;
    const ev = w.every || 1, jj = ev > 1 ? j - ((I.t[j] + (w.phase || 0)) % ev) : j, j0 = Math.max(0, jj), cl = w.mode === 'close', tt = w.tt || 0;
    if (jj !== wk.jj) { // новое окно заявок: выставлены после закрытия дня jj
      wk.jj = jj; wk.ref = w.ref ? w.ref(X, j0) : c[j0]; wk.lv = typeof w.lv === 'function' ? w.lv(X, j0) : w.lv; wk.done = new Uint8Array(wk.lv.length);
      const mu = w.mult ? w.mult(X, j0) : 1; wk.mu = mu;
      if (w.size === 'place') {
        wk.base = before; wk.amt = wk.lv.map(([, fr]) => fr * mu * before);
        if (w.min) { const mn = (q) => (typeof w.min === 'function' ? w.min(X, wk.ref * (1 - wk.lv[q][0])) : w.min), n = wk.lv.length, ord = w.merge === 'up' ? [...Array(n).keys()].reverse() : [...Array(n).keys()];
          let carry = 0; for (const q of ord) { const x = wk.amt[q] + carry; if (x < mn(q)) { wk.amt[q] = 0; carry = w.merge ? x : 0; } else { wk.amt[q] = x; carry = 0; } } }
      }
    }
    if (i <= wk.cool || (w.pan === 'off' && st.owed > 0)) return;
    for (let q = 0; q < wk.lv.length; q++) {
      if (w.once && wk.done[q]) continue;
      const k = wk.lv[q][0], fr = wk.lv[q][1] * wk.mu, lim = wk.ref * (1 - k), px = cl ? c[i] : lim;
      if (!((cl ? c[i] : X.l[i] / (1 - tt)) <= lim && cash > 0)) continue;
      const avail = w.pan === 'protect' ? Math.max(0, cash - st.owed) : cash;
      const amt = w.size === 'place' ? Math.min(avail, wk.amt[q]) : fr * avail;
      if (!(amt > 0) || (w.min && w.size !== 'place' && amt < (typeof w.min === 'function' ? w.min(X, lim) : w.min))) continue;
      const du_ = (amt * (1 - wfee)) / px; units += du_; cash -= amt; wk.done[q] = 1;
      if (w.pan === 'spend') st.owed = Math.max(0, st.owed - amt);
      if (w.exit) wk.lots.push({ u: du_, p: px, i, ref: wk.ref });
      if (w.cool) wk.cool = i + w.cool;
      if (w.log) w.log.push([X.name, i, k, amt, lim, c[i]]);
    }
  };
  /* wk, круг 6: «фитильная продажа» — зеркало ловушки, pol.wickS = { lv: [[k, f], …], every, phase, once, size: 'place', mode: 'close', age, day, fee,
       cond(X, jj, a) — режим (решение на окно), minU(X) — минимальная продажа в монетах стенда, rebuy: { d, f, days } — после продажи лимитка на откуп
       ниже цены продажи на d, на долю f выручки, живёт days дней }. Если максимум дня X.h[i] ≥ ref × (1 + k) — продано f позиции по лимиту, выручка в резерв.
       Без pol.wickS поведение прежнее. */
  const ws = pol && pol.wickS ? pol.wickS : null, wsfee = ws && ws.fee != null ? ws.fee : FEE;
  const wks = ws ? { jj: NaN, done: null, ref: 0, lv: null, u: null, on: true, rb: [] } : null;
  const wickSell = (i, j, a) => {
    if (wks.rb.length) { // откуп после фитильной продажи
      for (const R_ of wks.rb) { if (R_.i >= i || !(R_.amt > 0)) continue; if (i > R_.until) { R_.amt = 0; continue; }
        if (X.l[i] <= R_.lim && cash > 0) { const amt = Math.min(R_.amt, cash); units += (amt * (1 - wsfee)) / R_.lim; cash -= amt; R_.amt = 0; if (ws.log) ws.log.push([X.name, i, 'откуп', amt, R_.lim, c[i]]); } }
      wks.rb = wks.rb.filter((R_) => R_.amt > 0);
    }
    if (!(j >= 0 && I.age[j] > (ws.age || 60) && (!ws.day || ws.day(X, i)))) return;
    const ev = ws.every || 1, jj = ev > 1 ? j - ((I.t[j] + (ws.phase || 0)) % ev) : j, j0 = Math.max(0, jj), cl = ws.mode === 'close';
    if (jj !== wks.jj) { wks.jj = jj; wks.ref = ws.ref ? ws.ref(X, j0) : c[j0]; wks.lv = typeof ws.lv === 'function' ? ws.lv(X, j0) : ws.lv; wks.done = new Uint8Array(wks.lv.length); wks.u = wks.lv.map(([, f]) => f * units); wks.on = !ws.cond || ws.cond(X, j0, a); }
    if (!wks.on) return;
    for (let q = 0; q < wks.lv.length; q++) {
      if (ws.once && wks.done[q]) continue;
      const k = wks.lv[q][0], f = wks.lv[q][1], lim = wks.ref * (1 + k), px = cl ? c[i] : lim;
      if (!((cl ? c[i] : X.h[i]) >= lim) || !(units > 0)) continue;
      const dU = ws.size === 'place' ? Math.min(units, wks.u[q]) : f * units;
      if (!(dU > 0) || (ws.minU && dU < ws.minU(X))) continue;
      if (wk) for (const L of wk.lots) L.u *= 1 - dU / units;
      units -= dU; const amt = dU * px * (1 - wsfee); cash += amt; wks.done[q] = 1;
      if (ws.rebuy) wks.rb.push({ amt: amt * (ws.rebuy.f == null ? 1 : ws.rebuy.f), lim: px * (1 - ws.rebuy.d), i, until: i + (ws.rebuy.days || 30) });
      if (ws.log) ws.log.push([X.name, i, k, dU * px, lim, c[i]]);
    }
  };
  for (let i = a0; i < b; i++) {
    const p = c[i], j = i - 1 - lag; du += (UNIT * (1 - FEE)) / p;
    const q = j >= 0 ? decide(R, j) : -2, before = cash;
    const a = q >= 0 ? R[q].act : q === -2 ? 1 : S.base;
    cash += UNIT;
    if (pol && j >= 0 && I.pday[j] === 1 && st.ep !== j) st = { owed: 0, spent: 0, r0: before, ep: j, oo: st.oo || 0 };
    if (wk && wk.lots.length) { // wk: выход из фитильных покупок лимитом на продажу (исполняется внутри дня, до сделки правила)
      for (const L of wk.lots) { if (L.i >= i || !(L.u > 0)) continue; const tg = w.exit.up != null ? L.p * (1 + w.exit.up) : L.ref;
        if (X.h[i] >= tg) { const u = Math.min(L.u, units); units -= u; cash += u * tg * (1 - wfee); L.u = 0; } else if (w.exit.days && i - L.i >= w.exit.days) L.u = 0; }
      wk.lots = wk.lots.filter((L) => L.u > 0);
    }
    if (wk && w.first) wickStep(i, j, before);
    if (q >= 0 && R[q].r.sellU) { const amt = Math.min(units * p, R[q].r.sellU * UNIT); if (amt > 0) { units -= amt / p; cash += amt * (1 - FEE); if (rec) tr.push({ i, s: -1, amt, p, q }); } } // dms: продать на сумму sellU взносов (взнос дня уходит в резерв)
    else if (a < 0) { const amt = -a * units * p; if (amt > 0) { units -= amt / p; cash += amt * (1 - FEE); if (wk) for (const L of wk.lots) L.u *= 1 + a; if (rec) tr.push({ i, s: -1, amt, p, q }); } }
    else if (a > 0) {
      let want, pan = false, rel = 0, oth = false, relO = 0;
      if (pol && pol.buy && q >= 0 && R[q].p) { const share = a - 1, fr = Math.min(share, Math.max(0, pol.buy({ X, j, share, before, st }))); want = UNIT + fr * before; st.owed = Math.min(before + UNIT - want, st.owed + (share - fr) * before); pan = true; }
      else if (pol && pol.other && q >= 0 && pol.other(R[q].r)) { const share = a - 1, fr = Math.min(share, Math.max(0, pol.buyO({ X, j, share, before, st, r: R[q].r }))); want = UNIT + fr * before; st.oo = Math.min(before + UNIT - want, (st.oo || 0) + (share - fr) * before); oth = true; }
      else { want = a < 1 ? a * UNIT : UNIT + (a - 1) * before; pan = q >= 0 && R[q].p; } // 0 < a < 1 — доля взноса (dcaf)
      if (pol && pol.release && st.owed > 0 && j >= 0) { const k = pol.release({ X, j, before, st }); if (k > 0) { rel = Math.min(1, k) * st.owed; st.owed -= rel; } }
      if (pol && pol.releaseO && st.oo > 0 && j >= 0) { const k = pol.releaseO({ X, j, before, st }); if (k > 0) { relO = Math.min(1, k) * st.oo; st.oo -= relO; } }
      if (pol && pol.extra && j >= 0) { const k = pol.extra({ X, j, before, st }); if (k > 0) rel += Math.min(1, k) * before; } // докупка из резерва (доля резерва накануне)
      const amt = Math.min(cash, want + rel + relO); units += (amt * (1 - FEE)) / p; cash -= amt;
      if (pan || rel) st.spent += amt - UNIT;
      if (rec && amt > UNIT + 1e-9) tr.push({ i, s: 1, amt: amt - UNIT, p, q, pan: pan || rel > 0, oth: oth || relO > 0 });
    }
    // dcaf: «ловушка для фитилей» — лимитные заявки ниже вчерашнего закрытия (pol.wick = { lv: [[k, f], …], age }): если минимум дня ≤ ref × (1 − k), куплено f резерва по лимиту
    // (wk: код вынесен в wickStep выше; без новых полей считает ровно как раньше)
    if (wk && !w.first) wickStep(i, j, before);
    if (wks) wickSell(i, j, a); // wk, круг 6: фитильная продажа (после сделки правила и фитильной покупки)
    if (pol && j >= 0 && I.pend[j]) st.owed = 0;
    if (pol && pol.trace) pol.trace.push([i, cash, units, st.owed || 0]); // diag: состояние на конец дня (кэш, монеты, долг паники)
    if (pol && pol.expireO && j >= 0 && st.oo > 0 && pol.expireO({ X, j, st })) st.oo = 0;
  }
  const dca = du * c[b - 1], fin = units * c[b - 1] + cash;
  return { e: (fin / dca - 1) * 100, tr };
}
const E = (X, S, part, pol) => Math.min(edge(X, S, 0, part, false, pol).e, edge(X, S, 1, part, false, pol).e);
function evc(S, pol, lists = ['sel', 'ex', 'rnd']) { load(); const o = {}; for (const g of lists) o[g] = G[g].map((X) => ({ name: X.name, seg: X.seg, f: E(X, S, 'full', pol), h1: E(X, S, 'h1', pol), h2: E(X, S, 'h2', pol) })); return o; }
// метрика точности паники: покупки правил паники и выдачи долга — падение после покупки до минимума следующих 120 дней (взвеш. по деньгам), медиана дней до дна (взвеш.), доля денег при падении > 30%
function metric(S, pol, lists = ['sel', 'ex', 'rnd']) {
  load(); let W = 0, wf = 0, big = 0; const md = [], pc = [], pd = [];
  for (const g of lists) for (const X of G[g]) {
    const { tr } = edge(X, S, 0, 'full', true, pol); let w = 0, s = 0, sd = 0;
    for (const t of tr) if (t.s > 0 && t.pan && t.i + H < X.n) {
      let m = t.p, d = 0; for (let k = t.i; k <= t.i + H; k++) if (X.c[k] < m) { m = X.c[k]; d = k - t.i; }
      const fl = (1 - m / t.p) * 100; W += t.amt; wf += t.amt * fl; if (fl > 30) big += t.amt; md.push([d, t.amt]); w += t.amt; s += t.amt * fl; sd += t.amt * d;
    }
    if (w > 0) { pc.push(s / w); pd.push(sd / w); }
  }
  md.sort((x, y) => x[0] - y[0]); let cc = 0, wd = NaN; for (const [d, w] of md) { cc += w; if (cc >= W / 2) { wd = d; break; } }
  // fallC / daysC — среднее по монетам (у каждой монеты падение и дни взвешены по её деньгам): крупнейшие резервы не решают всё
  return { fall: wf / W, big: (100 * big) / W, days: wd, W, fallC: pc.reduce((a, b) => a + b, 0) / pc.length, daysC: pd.reduce((a, b) => a + b, 0) / pd.length };
}
const f = (s) => `${Math.round(s.med)}/${s.pos}/${s.hpos}/${s.hworst.toFixed(1)}`;
let BR = null, BS = null, BM = null;
let BSt = null, BPol = null, B100 = null;
function baseline() { if (!BR) { BR = evc(BSt || base, BPol); BS = Z.sum(BR); BM = metric(BSt || base, BPol); } return { BR, BS, BM }; }
// сменить основу для сравнения (стратегия + политика паники); null, null — combo3 без tune1
function setBaseline(S, pol) { BSt = S; BPol = pol; BR = BS = BM = B100 = null; return baseline(); }
// сравнение с основой: строка отчёта (медиана/в плюсе/половин/худшая половина по группам | доход по сегментам и строгая | метрика паники)
function report(nm, S, pol, { n100 = false, quiet = false } = {}) {
  baseline();
  const lists = ['sel', 'ex', 'rnd'], R = evc(S, pol, lists), RS = Z.sum(R), M = metric(S, pol);
  const segs = Z.SEGS.map((s) => `${s} ${(Z.inc(RS, s) - Z.inc(BS, s)).toFixed(3)}${Z.strict(RS, BS, s).length ? '✗' : '✔'}`).join(' ');
  let n = '', N = null;
  if (n100) {
    if (!B100) B100 = evc(BSt || base, BPol, ['n100']);
    const R1 = evc(S, pol, ['n100']), s1 = Z.sum(R1), b1 = Z.sum(B100), m = Z.mlog(R1, B100, 'all', ['n100']);
    const sg = ['big', 'alt', 'meme'].map((s) => { const q = Z.mlog(R1, B100, s, ['n100']); return `${s} ${q.m.toFixed(4)} ${q.u}/${q.d}`; }).join(', ');
    N = { s1, b1, m }; n = ` | 100н ${f(s1.n100.all)} (осн ${f(b1.n100.all)}) лог ${m.m.toFixed(4)} лучше/хуже ${m.u}/${m.d} [${sg}]`;
  }
  const line = `${nm.padEnd(30)} ${lists.map((g) => f(RS[g].all)).join(' | ')} | ${segs} | паника ${M.fall.toFixed(1)}%/${M.days}д/${M.big.toFixed(0)}%>30 монеты ${M.fallC.toFixed(1)}%/${M.daysC.toFixed(0)}д${n} ${Z.strict(RS, BS, 'all').join(',')}`;
  if (!quiet) console.log(line);
  return { R, RS, M, N, line, d: Z.inc(RS, 'all') - Z.inc(BS, 'all'), ok: Z.SEGS.every((s) => !Z.strict(RS, BS, s).length) };
}
const clone = C3.clone;
// правила паники: f(r) → массив правил вместо r
function mapP(fn) { const S = clone(base); S.rules = S.rules.flatMap((r) => (isP(r) ? fn(r) : [r])); return S; }
module.exports = { Z, C3, base, isP, load, edge, E, evc, metric, report, baseline, setBaseline, mapP, clone, f, episodes };
