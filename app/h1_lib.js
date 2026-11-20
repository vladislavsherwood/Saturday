/* h1: простаивающий резерв поверх combo4 + «ловушка для фитилей». Общие помощники.
   Основа — combo4 из found/combo4-best.json (57 правил) + отложенная паника Boost(2, { k: 0, A: 0 }) + фитили (wick-best: −25/−40/−60 → 15/25/35%, раз в 3 дня).
   Вторая точка отсчёта — combo4 без фитилей. Решение — по вчерашнему дню, худший из сдвигов исполнения 0/1 (P.E).
   Свои «крючки» в стенде — pol.h1 (panicx_sim.js): grow (рост резерва: процент / кэрри / хранение в BTC), trade (своя сделка резерва), end (издержки).
   Использование: const H = require('./h1_lib.js'); H.ev('имя', H.mk(H.yFix(4.5)), { n100: true }) */
const L = require('./r4_lib.js'), { P, Z, G } = L;
const S57 = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
const WICK = { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place' };
const polC = L.pol0, polW = { ...L.pol0, wick: WICK };
P.setBaseline(S57, polW);
const G3 = ['sel', 'ex', 'rnd'], sg = L.sg, med = Z.med, L1 = Z.L1;
const mk = (h1, base = polW) => ({ ...base, h1 });
let BW = null, BC = null, BWS = null, BCS = null, NW = null, NC = null;
function bases() { if (!BW) { BW = P.evc(S57, polW); BC = P.evc(S57, polC); BWS = Z.sum(BW); BCS = Z.sum(BC); } return { BW, BC, BWS, BCS }; }
function bases100() { if (!NW) { NW = P.evc(S57, polW, ['n100']); NC = P.evc(S57, polC, ['n100']); } return { NW, NC }; }
const incH = (R, h, s = 'all') => G3.reduce((t, g) => { const a = R[g].filter((x) => s === 'all' || x.seg === s).map((x) => x[h]); return t + (a.length ? L1(med(a)) : 0); }, 0);
const whyS = (RS, BS) => Z.SEGS.map((s) => { const x = Z.strict(RS, BS, s); return x.length ? `${s}: ${x.join(',')}` : ''; }).filter(Boolean).join(' | ');
const rows = [];
/* оценка: медианы отбор/экзамен/50 сл. (к DCA, %); доход к основе W (всё/к/а/м) и строгая к W; доход и строгая к combo4 (C);
   81 — средний лог по 81 монете к W (лучше/хуже); половины — Σ лог-медиан h1/h2 к W; 100н — средний лог к W (лучше/хуже) и к C */
function ev(nm, pol, { S = S57, n100 = false, quiet = false, w = 44 } = {}) {
  bases();
  const R = P.evc(S, pol), RS = Z.sum(R);
  const d = (s, B) => Z.inc(RS, s) - Z.inc(B, s);
  const why = whyS(RS, BWS), whyC = whyS(RS, BCS);
  const m = Z.mlog(R, BW, 'all', G3);
  const o = { nm, sel: RS.sel.all.med, ex: RS.ex.all.med, rnd: RS.rnd.all.med, all: d('all', BWS), big: d('big', BWS), alt: d('alt', BWS), meme: d('meme', BWS), ok: !why, why,
    allC: d('all', BCS), okC: !whyC, whyC, m81: m.m, m81u: m.u, m81d: m.d, h1: incH(R, 'h1') - incH(BW, 'h1'), h2: incH(R, 'h2') - incH(BW, 'h2'), R, RS };
  if (n100) {
    const { NW: nw, NC: nc } = bases100(), N = P.evc(S, pol, ['n100']), a = Z.mlog(N, nw, 'all', ['n100']), b = Z.mlog(N, nc, 'all', ['n100']), s1 = Z.sum(N).n100.all;
    Object.assign(o, { n: a.m, nu: a.u, nd: a.d, nC: b.m, nCu: b.u, nCd: b.d, nmed: s1.med, npos: s1.pos, nhpos: s1.hpos, N });
  }
  o.txt = `${nm.padEnd(w)} ${Math.round(o.sel)}/${Math.round(o.ex)}/${Math.round(o.rnd)} | ${sg(o.all)} к${sg(o.big, 2)} а${sg(o.alt, 2)} м${sg(o.meme, 2)} ${o.ok ? '✔' : '✗'} | кC4 ${sg(o.allC)} ${o.okC ? '✔' : '✗'} | 81 ${sg(o.m81)} ${o.m81u}/${o.m81d} | пол ${sg(o.h1, 2)}/${sg(o.h2, 2)}` +
    (n100 ? ` | 100н ${Math.round(o.nmed)}/${o.npos}/${o.nhpos} ${sg(o.n)} ${o.nu}/${o.nd} (кC4 ${sg(o.nC)} ${o.nCu}/${o.nCd})` : '') + (why ? ` | ${why.slice(0, 150)}` : '');
  if (!quiet) console.log(o.txt);
  rows.push(o);
  return o;
}
const head = () => console.log(`${'вариант'.padEnd(44)} отбор/экз/50сл | доход к combo4+фитили: всё к а м строгая | к combo4 | 81 монета: ср. лог лучше/хуже | половины h1/h2 | 100 новых: медиана/в плюсе/половин, лог лучше/хуже (к combo4)`);
const year = (t) => new Date(t * 864e5).getUTCFullYear();
// 3-мес. казначейские векселя США, % годовых (средние за год, приблизительно; 2026 — оценка) — нижняя граница «безрискового» дохода стейблов (токенизированные векселя, фонды денежного рынка)
const TB = { 2014: 0.03, 2015: 0.05, 2016: 0.32, 2017: 0.93, 2018: 1.94, 2019: 2.06, 2020: 0.36, 2021: 0.05, 2022: 2.02, 2023: 5.07, 2024: 4.97, 2025: 4.2, 2026: 3.9 };
const tbd = (X, i) => (TB[year(X.ind.t[i])] || 0) / 100 / 365;
// доход на резерв: постоянный (ann % годовых) / по векселям (× k + add)
const yFix = (ann) => ({ grow: () => 1 + ann / 100 / 365 });
const yTB = (k = 1, add = 0) => ({ grow: (X, i) => 1 + k * tbd(X, i) + add / 100 / 365 });
/* кэрри: доля e резерва — спот BTC + шорт перпа BTC того же номинала (дельта-нейтрально), получает фандинг BTC (fund7 — сумма за 7 дн, %; до 2020 данных нет);
   остаток и всё вне кэрри — сбережения (save: 'tb' векселя | число % | 0). gate(X, j) — держать кэрри (по вчерашним данным); cost — издержки входа/выхода на изменение суммы в кэрри */
function carry({ e = 0.9, cost = 0.0015, save = 'tb', pre = 'save', gate = null } = {}) {
  const rs = (X, i) => (save === 'tb' ? tbd(X, i) : save / 100 / 365);
  const rc = (X, i) => { const f = X.ind.fund7[i]; return isFinite(f) ? f / 7 / 100 : NaN; };
  return {
    grow: (X, i, s) => { if (!(s.cash > 0)) return 1; const r = rc(X, i), h = s.held || 0; const g = h * (isFinite(r) ? r : rs(X, i)) + (s.cash - h) * rs(X, i); return 1 + g / s.cash; },
    end: ({ X, j, cash, s }) => {
      const has = j >= 0 && isFinite(rc(X, j)), on = has && (!gate || gate(X, j)), tg = on ? e * cash : 0;
      const k = has || pre !== 'save' ? cost * Math.abs(tg - (s.held || 0)) : 0; s.held = on ? e * (cash - k) : 0; s.cash = cash - k; return k;
    },
  };
}
/* хранение резерва в активе: доля w(X, j) резерва — в BTC ('btc') или в самой монете ('coin'), остальное — сбережения (save % годовых или 'tb');
   комиссия fee на перестройку (изменение суммы в активе за день) */
function store({ w = () => 0.5, asset = 'btc', fee = 0.001, save = 0 } = {}) {
  const rs = (X, i) => (save === 'tb' ? tbd(X, i) : save / 100 / 365);
  return {
    grow: (X, i, s) => {
      s.h0 = 0; if (!(s.cash > 0)) return 1;
      const A = asset === 'btc' ? X.ind.btcp : X.c, r = i > 0 ? A[i] / A[i - 1] : NaN, h = s.held || 0;
      const hr = isFinite(r) && r > 0 ? h * r : h; s.h0 = hr; return (hr + (s.cash - h) * (1 + rs(X, i))) / s.cash;
    },
    end: ({ X, j, cash, s }) => { const f = j >= 0 ? Math.max(0, Math.min(1, w(X, j))) : 0, tg = f * cash, k = fee * Math.abs(tg - (s.h0 || 0)); s.cash = cash - k; s.held = f * s.cash; return k; },
  };
}
// объединить несколько крючков h1 (grow перемножается, trade — первый ненулевой, end — сумма)
function both(...hs) {
  return {
    grow: (X, i, s) => hs.reduce((g, h, k) => (h.grow ? g * h.grow(X, i, (s['k' + k] = s['k' + k] || {})) : g), 1),
    trade: (ctx) => { for (let k = 0; k < hs.length; k++) if (hs[k].trade) { const v = hs[k].trade({ ...ctx, s: (ctx.s['k' + k] = ctx.s['k' + k] || {}) }); if (v && (Array.isArray(v) ? v[0] : v)) return v; } return 0; },
    end: (ctx) => hs.reduce((t, h, k) => (h.end ? t + h.end({ ...ctx, s: (ctx.s['k' + k] = ctx.s['k' + k] || {}) }) : t), 0),
  };
}
// доля резерва в капитале монеты (сдвиг 0, вся история, 81 монета): медиана средней доли с 60-го дня; при монете выше / ниже своей 200д
function cashShare(pol, S = S57, lists = G3) {
  const all = [], up = [], dn = [];
  for (const g of lists) for (const X of G[g]) {
    const p = { ...pol, trace: [] }; P.edge(X, S, 0, 'full', false, p);
    let sa = 0, na = 0, su = 0, nu = 0, sd = 0, nd = 0;
    for (const [i, cash, u] of p.trace) { if (i < 60) continue; const v = cash + u * X.c[i], cs = v > 0 ? cash / v : 0; sa += cs; na++; const x = X.ind.sma200[i]; if (x > 1) { su += cs; nu++; } else if (x < 1) { sd += cs; nd++; } }
    if (na) all.push(sa / na); if (nu) up.push(su / nu); if (nd) dn.push(sd / nd);
  }
  const m = (a) => (100 * med(a)).toFixed(0) + '%';
  return `резерв в капитале: ${m(all)} (выше 200д ${m(up)}, ниже ${m(dn)})`;
}
module.exports = { L, P, Z, G, S57, WICK, polC, polW, mk, bases, bases100, ev, head, rows, sg, TB, tbd, year, yFix, yTB, carry, store, both, cashShare, incH, whyS };
/* потолок резерва: в день без сигнала, если с последнего сигнала (правило с act ≠ 1) прошло ≥ N дней и when(X, j), излишек резерва сверх k × позиция
   (резерв без долга отложенной паники) тратится по r в день на покупку монеты по закрытию */
function cap({ k = 1, r = 0.02, N = 30, when = null, protect = true } = {}) {
  return {
    trade: ({ X, i, j, a, q, p, cash, units, st, s }) => {
      if (s.last == null) s.last = i;
      if (q >= 0 && a !== 1) { s.last = i; return 0; }
      if (q >= 0 || i - s.last < N || (when && !when(X, j))) return 0;
      const ex = cash - (protect ? st.owed || 0 : 0) - k * units * p;
      return ex > 0 ? r * ex : 0;
    },
  };
}
module.exports.cap = cap;
/* мелкая лестница лимиток на покупку из резерва (своя, поверх фитилей): уровни lv [[k, f]] от закрытия дня обновления (раз в every дней), сумма f × база при выставлении,
   база — резерв без долга паники (cap: только излишек сверх cap × позиция); исполнение — минимум дня ≤ лимита, по цене лимита, раз за окно; when(X, jj) — режим на окно;
   exit: 'ref' — продать купленное при возврате к опорной цене, число — при +exit от цены покупки (лимит на продажу, со следующего дня); age — возраст монеты */
function ladder({ lv = [[0.1, 0.05], [0.15, 0.08], [0.2, 0.1]], every = 3, when = null, exit = null, cap = null, age = 60, close = false } = {}) {
  return {
    trade: ({ X, i, j, p, cash, units, st, s }) => {
      const I = X.ind; if (!(I.age[j] > age)) return 0;
      s.lots = s.lots || [];
      if (exit && s.lots.length) { // выход лимитом на продажу
        let u = 0, v = 0; for (const L of s.lots) if (L.i < i && X.h[i] >= L.tg) { u += L.u; v += L.u * L.tg; L.u = 0; }
        s.lots = s.lots.filter((L) => L.u > 0); if (u > 0) return [-v, v / u];
      }
      const jj = every > 1 ? j - (I.t[j] % every) : j, j0 = Math.max(0, jj);
      if (jj !== s.jj) { s.jj = jj; s.ref = X.c[j0]; s.on = !when || when(X, j0); const b0 = Math.max(0, cash - (st.owed || 0) - (cap != null ? cap * units * X.c[j0] : 0)); s.amt = lv.map(([, f]) => f * b0); s.done = lv.map(() => 0); }
      if (!s.on) return 0;
      let buy = 0, un = 0, avail = Math.max(0, cash - (st.owed || 0));
      for (let q = 0; q < lv.length; q++) {
        if (s.done[q]) continue; const lim = s.ref * (1 - lv[q][0]);
        if (!((close ? p : X.l[i]) <= lim)) continue;
        const px = close ? p : lim, amt = Math.min(s.amt[q], avail - buy); s.done[q] = 1; if (!(amt > 0)) continue;
        buy += amt; un += amt / px; if (exit) s.lots.push({ u: (amt * 0.999) / px, tg: exit === 'ref' ? s.ref : px * (1 + exit), i });
      }
      return buy > 0 ? [buy, buy / un] : 0;
    },
  };
}
module.exports.ladder = ladder;
/* продажа путов на резерв (расчётные европейские, как на Deribit): раз в T дней продать пут со страйком S × (1 − k) на номинал f × резерв (без долга паники),
   премия по Блэку—Шоулзу с IV = vrp × реализованная волатильность 30 дн (vol30 — дневная, %), ставка 0; комиссия 0,03% номинала;
   при экспирации резерв платит max(0, K − S_T) × количество; не хватает резерва — продаётся монета на следующий день. from — {монета: первый день опционов}. */
const ncdf = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
const bsPut = (S, K, sig, T) => { const v = sig * Math.sqrt(T), d1 = (Math.log(S / K) + v * v / 2) / v, d2 = d1 - v; return K * ncdf(-d2) - S * ncdf(-d1); };
function puts({ k = 0.2, T = 30, f = 0.5, vrp = 1.2, fee = 0.0003, from = { BTC: '2017-01-01', ETH: '2019-03-01', SOL: '2023-01-01' } } = {}) {
  const F = {}; for (const nm in from) F[nm] = Math.round(Date.parse(from[nm]) / 864e5);
  return {
    trade: ({ p, s }) => { if (s.debt > 0) { const v = s.debt; s.debt = 0; return [-v, p]; } return 0; },
    end: ({ X, i, j, cash, st, s }) => {
      let cost = 0; const I = X.ind;
      if (s.put && i >= s.put.exp) { cost += s.put.q * Math.max(0, s.put.K - X.c[i]); s.put = null; s.n = (s.n || 0) + 1; }
      if (!s.put && j >= 0 && F[X.name] != null && I.t[i] >= F[X.name] && isFinite(I.vol30[j])) {
        const S = X.c[i], K = S * (1 - k), N = f * Math.max(0, cash - cost - (st.owed || 0)), q = N / K, sig = (vrp * I.vol30[j] * Math.sqrt(365)) / 100;
        if (q > 0 && sig > 0) { cost -= q * bsPut(S, K, sig, T / 365) - fee * q * S; s.put = { K, q, exp: i + T }; }
      }
      if (cost > cash) { s.debt = (s.debt || 0) + cost - cash; cost = cash; }
      return cost;
    },
  };
}
Object.assign(module.exports, { puts, bsPut, ncdf });
/* доход только на свободную часть резерва: заявки ловушки (WICK: 15/25/35% резерва, раз в 3 дня, раз за окно) на споте блокируют деньги — на них дохода нет.
   Блокировка считается по той же схеме окон, что и ловушка (сумма при выставлении — от резерва на конец дня выставления; уровень исполнился — снят). r(X, i) — дневная ставка */
function yFree(r, wick = WICK) {
  return {
    grow: (X, i, s) => { if (!(s.cash > 0)) return 1; const fr = Math.max(0, s.cash - (s.lock || 0)); return 1 + (fr * r(X, i)) / s.cash; },
    end: ({ X, i, j, cash, s }) => {
      s.cash = cash; s.lock = 0; const I = X.ind; if (!(j >= 0 && I.age[j] > (wick.age || 60))) return 0;
      const ev = wick.every || 1, jj = ev > 1 ? j - (I.t[j] % ev) : j, j0 = Math.max(0, jj);
      if (jj !== s.jj) { s.jj = jj; s.ref = X.c[j0]; s.amt = wick.lv.map(([, f]) => f * cash); s.done = wick.lv.map(() => 0); }
      for (let q = 0; q < wick.lv.length; q++) if (!s.done[q] && X.l[i] <= s.ref * (1 - wick.lv[q][0])) s.done[q] = 1;
      s.lock = Math.min(cash, wick.lv.reduce((t, _, q) => t + (s.done[q] ? 0 : s.amt[q]), 0)); return 0;
    },
  };
}
module.exports.yFree = yFree;
