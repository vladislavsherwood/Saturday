/* imp2 (агент улучшения №2, простаивающий резерв): быстрый оценщик = копия agent_sim.edge/evalGroup/metrics + расширения:
   S.idle = [{N, f, sh, conds, src}] — «возврат простаивающего резерва»: в день, когда ни одно правило не сработало (обычный взнос),
     если с последнего сигнала стратегии (покупка из резерва или продажа) прошло ≥ N дней, доля резерва в счёте монеты > sh
     и выполнены conds (по вчерашнему дню) — купить на долю f резерва (как правило с act = 1 + f). Список: срабатывает первая подходящая ступень.
   S.yld — доход на резерв (стейблы), годовых: каждый день cash += cash · yld / 365 (только положительный резерв).
   Основа — app/found/combo-best.json (F + C1.25 + C6). Индикаторы — как в combo_sim (rel180, ago_qt, hi90 и др.).
   Использование: const I = require('./imp2_sim.js'); const G = I.groups(); const r = I.ev(G, S); I.row(tag, r, base) */
const K = require('./combo_sim.js');
const fs = require('fs');
const FEE = 0.001, UNIT = 10;
const CB = JSON.parse(fs.readFileSync(__dirname + '/found/combo-best.json', 'utf8'));
const BASE = { base: CB.base, rules: CB.rules };
function groups(list = ['sel', 'ex', 'rnd', 'n100']) { const G = K.groups(list); K.prep(G); return G; }
const compile = (X, rules) => rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])).map((r) => ({ act: r.act, cs: r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v]), r }));
function decide(R, j) {
  for (let q = 0; q < R.length; q++) { const cs = R[q].cs; let ok = true; for (let k = 0; k < cs.length; k++) { const v = cs[k][0][j]; if (!(cs[k][1] ? v < cs[k][2] : v > cs[k][2])) { ok = false; break; } } if (ok) return q; }
  return -1;
}
const okAll = (cs, j) => { for (let k = 0; k < cs.length; k++) { const v = cs[k][0][j]; if (!(cs[k][1] ? v < cs[k][2] : v > cs[k][2])) return false; } return true; };
// trace: массив по дням {share} для разбора
function edge(X, S, lag, part = 'full', rec = false, trace = null) {
  let a0 = 0, b = X.n; if (part === 'h1') b = Math.floor(X.n / 2); if (part === 'h2') a0 = Math.floor(X.n / 2);
  const c = X.c, R = compile(X, S.rules);
  const ID = (S.idle || []).map((s) => ({ ...s, cs: s.conds ? compile(X, [{ act: 1, conds: s.conds }]) : [{ cs: [] }] })).filter((s) => s.cs.length);
  const y = (S.yld || 0) / 365;
  let cash = 0, units = 0, du = 0, last = -1e9, nIdle = 0, idleAmt = 0; const tr = rec ? [] : null;
  for (let i = a0; i < b; i++) {
    const p = c[i], j = i - 1 - lag; du += (UNIT * (1 - FEE)) / p;
    if (y && cash > 0) cash += cash * y;
    const q = j >= 0 ? decide(R, j) : -2, before = cash;
    let a = q >= 0 ? R[q].act : q === -2 ? 1 : S.base, idl = false;
    if (q >= 0 && a !== 1) last = i;
    if (q === -1 && ID.length && j >= 0) {
      const sh = cash / (cash + units * p);
      for (const s of ID) if (i - last >= s.N && sh > (s.sh || 0) && okAll(s.cs[0].cs, j)) { a = 1 + s.f; idl = true; if (s.reset) last = i; break; }
    }
    cash += UNIT;
    if (a < 0) { const amt = -a * units * p; if (amt > 0) { units -= amt / p; cash += amt * (1 - FEE); if (rec) tr.push({ i, s: -1, amt, p, q }); } }
    else if (a > 0) { const amt = Math.min(cash, UNIT + (a - 1) * before); units += (amt * (1 - FEE)) / p; cash -= amt; if (idl) { nIdle++; idleAmt += amt - UNIT; } if (rec && amt > UNIT + 1e-9) tr.push({ i, s: 1, amt: amt - UNIT, p, q, idl }); }
    if (trace) trace.push({ i, sh: cash / (cash + units * p), p });
  }
  const dca = du * c[b - 1], fin = units * c[b - 1] + cash;
  return { e: (fin / dca - 1) * 100, tr, fin, dca, units, cash, nIdle, idleAmt };
}
const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const stat = (full, halves) => ({ n: full.length, pos: full.filter((x) => x > 0).length, worst: Math.min(...full), med: med(full), hpos: halves.filter((x) => x > 0).length, hn: halves.length, hworst: Math.min(...halves) });
const E = (X, S, part) => Math.min(edge(X, S, 0, part).e, edge(X, S, 1, part).e);
function evalGroup(A, S) { const full = A.map((X) => E(X, S, 'full')), halves = A.flatMap((X) => [E(X, S, 'h1'), E(X, S, 'h2')]); return { ...stat(full, halves), e: full }; }
// метрики дна/вершин (как agent_sim.metrics) + доля резерва в счёте: средняя по дням и в бычьих днях (BTC < 20% от максимума)
function metrics(A, S) {
  let bAbove = 0, zW = 0, totB = 0, sw = 0, sTop = 0, bott = 0, bott3 = 0, tops = 0, topsMissed = 0, shSum = 0, shN = 0, bullSum = 0, bullN = 0, idle = 0;
  for (const X of A) {
    const c = X.c, MM = prepM(X), trc = [], { tr, idleAmt } = edge(X, S, 0, 'full', true, trc);
    idle += idleAmt;
    for (const t of tr) {
      if (t.s > 0) { totB += t.amt; bAbove += t.amt * (t.p / MM.minF[t.i] - 1); if (t.p <= 1.15 * MM.minW[t.i]) zW += t.amt; }
      else { sw += t.amt; sTop += t.amt * (t.p / MM.maxW[t.i]); }
    }
    for (const i of MM.bot) { bott++; const days = new Set(tr.filter((t) => t.s > 0 && Math.abs(t.i - i) <= 120 && t.p <= 1.15 * c[i]).map((t) => t.i)); if (days.size >= 3) bott3++; }
    for (const i of MM.top) { tops++; if (!tr.some((t) => t.s < 0 && Math.abs(t.i - i) <= 90 && t.p >= 0.7 * c[i])) topsMissed++; }
    const ba = X.ind.btcath;
    for (const d of trc) { if (d.i < 30 || !isFinite(d.sh)) continue; shSum += d.sh; shN++; if (ba[d.i] < 20) { bullSum += d.sh; bullN++; } }
  }
  return { buyAbove90: (100 * bAbove) / totB, zone15: (100 * zW) / totB, bott3: (100 * bott3) / bott, sellToTop: (100 * sTop) / sw, missedTops: (100 * topsMissed) / tops, cashSh: (100 * shSum) / shN, cashBull: (100 * bullSum) / bullN, idleBuy: idle };
}
function prepM(X) {
  if (X.M2) return X.M2;
  const c = X.c, n = X.n, bot = [], top = [];
  const slide = (w0, w1, f, init) => { const o = new Float64Array(n); for (let i = 0; i < n; i++) { let m = init; for (let j = Math.max(0, i - w0); j <= Math.min(n - 1, i + w1); j++) m = f(m, c[j]); o[i] = m; } return o; };
  const mf = slide(0, 90, Math.min, Infinity), mw = slide(180, 180, Math.min, Infinity), xw = slide(90, 90, Math.max, 0), xw180 = slide(180, 180, Math.max, 0), pmax = slide(365, -1, Math.max, 0), pmin = slide(365, -1, Math.min, Infinity);
  for (let i = 200; i < n - 30; i++) { if (c[i] === mw[i] && c[i] <= 0.5 * pmax[i]) bot.push(i); if (c[i] === xw180[i] && c[i] >= 2 * pmin[i]) top.push(i); }
  return (X.M2 = { minF: mf, minW: mw, maxW: xw, bot, top });
}
function ev(G, S, withM = true) { const o = {}; for (const g in G) o[g] = evalGroup(G[g], S); if (withM) o.m = metrics([...(G.sel || []), ...(G.ex || []), ...(G.rnd || [])], S); return o; }
const inc = (r) => Math.log1p(r.sel.med / 100) + Math.log1p(r.ex.med / 100) + Math.log1p(r.rnd.med / 100);
const d = (r, b) => inc(r) - inc(b);
const stable = (r, b, k) => r[k].pos >= b[k].pos && r[k].worst >= b[k].worst - 1e-9 && r[k].hworst >= b[k].hworst - 1e-9 && r[k].hpos >= b[k].hpos;
const passes = (r, b) => stable(r, b, 'sel') && stable(r, b, 'ex') && r.rnd.pos >= b.rnd.pos && r.rnd.hpos >= b.rnd.hpos && r.rnd.hworst >= b.rnd.hworst - 1e-9;
function why(r, b) { const o = []; for (const k of ['sel', 'ex']) { if (r[k].pos < b[k].pos) o.push(`${k} плюс ${r[k].pos}<${b[k].pos}`); if (r[k].worst < b[k].worst - 1e-9) o.push(`${k} худш ${r[k].worst.toFixed(1)}<${b[k].worst.toFixed(1)}`); if (r[k].hworst < b[k].hworst - 1e-9) o.push(`${k} худш.пол ${r[k].hworst.toFixed(1)}<${b[k].hworst.toFixed(1)}`); if (r[k].hpos < b[k].hpos) o.push(`${k} пол ${r[k].hpos}<${b[k].hpos}`); }
  if (r.rnd.pos < b.rnd.pos) o.push(`rnd плюс ${r.rnd.pos}<${b.rnd.pos}`); if (r.rnd.hpos < b.rnd.hpos) o.push(`rnd пол ${r.rnd.hpos}<${b.rnd.hpos}`); if (r.rnd.hworst < b.rnd.hworst - 1e-9) o.push(`rnd худш.пол ${r.rnd.hworst.toFixed(1)}<${b.rnd.hworst.toFixed(1)}`); return o.join('; '); }
const bw = (r, b, g) => [r[g].e.filter((v, i) => v > b[g].e[i] + 0.5).length, r[g].e.filter((v, i) => v < b[g].e[i] - 0.5).length];
const f0 = (x) => x.toFixed(0);
function row(tag, r, b) {
  const g = (k) => `${f0(r[k].med)}/${r[k].hworst.toFixed(1)}/${r[k].pos}/${r[k].hpos}`;
  const n = r.n100 ? ` | 100н ${f0(r.n100.med)}/${r.n100.pos}/${r.n100.hpos} ${b && b.n100 ? bw(r, b, 'n100').join('/') : ''}` : '';
  const m = r.m ? ` | дно ${f0(r.m.buyAbove90)}/${r.m.zone15.toFixed(1)}/${f0(r.m.bott3)} верш ${f0(r.m.sellToTop)}/${r.m.missedTops.toFixed(1)} резерв ${f0(r.m.cashSh)}/${f0(r.m.cashBull)}%` : '';
  return `${b ? (passes(r, b) ? '✔' : '·') + ' ' + (d(r, b) >= 0 ? '+' : '') + d(r, b).toFixed(3) : ''} | ${g('sel')} | ${g('ex')} | ${g('rnd')}${n}${m} | ${tag}${b && !passes(r, b) ? ' [' + why(r, b) + ']' : ''}`;
}
const HDR = 'строго доход | отбор мед/худш.пол/плюс/пол+ | экзамен | 50 случ. | 100н мед/плюс/пол+ лучше/хуже | дно выше мин90/в зоне15/≥3дн, вершины к макс/пропущено, резерв ср/в быке';
const c = K.c;
const slim = (r) => ({ sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med, n100: r.n100 && r.n100.med, hw: [r.sel.hworst, r.ex.hworst, r.rnd.hworst], pos: [r.sel.pos, r.ex.pos, r.rnd.pos, r.n100 && r.n100.pos], hpos: [r.sel.hpos, r.ex.hpos, r.rnd.hpos, r.n100 && r.n100.hpos], m: r.m });
module.exports = { K, CB, BASE, groups, edge, ev, evalGroup, metrics, inc, d, passes, why, bw, row, HDR, c, med, slim, UNIT, FEE };
