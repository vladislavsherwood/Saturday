/* Агент «ЛОУКАП»: быстрый оценщик на выборке лоукапов + стандартный стенд (agent_sim.js через combo_sim.js).
   Лоукапы — страницы стенда lc0…lc15 (build_builder.py file:…, CoinMarketCap, skip 20), выгруженные agent_export.js в папку данных;
   к каждой монете по дате добавлены ряды из found/lowcap_data.json: капитализация, объём $ (CMC), объём Hyperliquid, фандинг и OI Binance.
   Монетам стандартного стенда добавлена капитализация (предложение CMC по неделям × цена страницы) — для признака «лоукап» по данным.
   Все индикаторы — только по прошлому (окна назад). Группы: lsel (отбор лоукапов), lchk (проверка лоукапов), sel/ex/rnd/n100 (стенд).
   Использование: const L = require('./lowcap_sim.js'); const G = L.load(); const r = L.evs(G, S); L.cmp(r, rb) */
const fs = require('fs');
const path = require('path');
const SCR = '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad';
const DATA = process.env.LOWCAP_DATA || SCR + '/lowcap/data';         // симлинки на agent_data + выгрузки lc*.bin/json
process.env.AGENT_DATA = DATA;
const K = require('./combo_sim.js');
const A2 = require('./agent2_sim.js');
const S = K;                                                       // edge, E, med, c …
const { c } = K;
const LD = JSON.parse(fs.readFileSync(path.join(__dirname, 'found', 'lowcap_data.json'), 'utf8'));
const PAGES_LC = JSON.parse(fs.readFileSync(SCR + '/lowcap/pages/pages.json', 'utf8'));
const DAY = (s) => Math.round(Date.parse(s + 'T00:00:00Z') / 864e5);
const dstr = (t) => new Date(t * 864e5).toISOString().slice(0, 10);
const SPLIT = DAY(LD.split_date);

// ---------- декодирование ----------
function dec(s, kind) {
  const b = Buffer.from(s, 'base64');
  if (kind === 'f4') { const o = new Float64Array(b.length / 4); for (let i = 0; i < o.length; i++) o[i] = b.readFloatLE(4 * i); return o; }
  const o = new Float64Array(b.length / 2);
  for (let i = 0; i < o.length; i++) { if (kind === 'lg') { const v = b.readUInt16LE(2 * i); o[i] = v === 0 ? NaN : 10 ** (v / 1000 - 3); } else { const v = b.readInt16LE(2 * i); o[i] = v === -32768 ? NaN : v / 1e4; } }
  return o;
}
const dec8 = (s, lo, n, step = 0.03) => { const o = new Float64Array(n); o.fill(NaN); if (!s) return o; const b = Buffer.from(s, 'base64'); for (let i = 0; i < b.length; i++) o[i] = b[i] === 0 ? NaN : 10 ** ((b[i] - 1) * step + lo); return o; };
const weekly = (s, n) => { const w = dec(s, 'lg'), o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = w[Math.min(Math.floor(i / 7), w.length - 1)]; return o; };
const LOW = {};
for (const [k, x] of Object.entries(LD.coins)) LOW[k] = { ...x, t0: DAY(x.first), c: dec(x.c, 'f4'), v: dec8(x.v, x.v_lo, x.n), hv: dec8(x.hv, x.hv_lo, x.n), f: dec(x.f, 'fu'), oi: dec8(x.oi, x.oi_lo, x.n), sup: weekly(x.sup, x.n) };
const STAND = {};
for (const [k, x] of Object.entries(LD.stand || {})) { const nan = new Float64Array(x.n).fill(NaN); STAND[k] = { t0: DAY(x.first), sup: weekly(x.sup, x.n), v: dec8(x.v, x.v_lo, x.n), hv: nan, f: nan, oi: nan }; }

// ---------- окна (только прошлое) ----------
const roll = (a, w, f) => { const n = a.length, o = new Float64Array(n); for (let i = 0; i < n; i++) { let s = [], k = 0; for (let j = Math.max(0, i - w + 1); j <= i; j++) if (!isNaN(a[j])) s.push(a[j]); o[i] = s.length >= Math.ceil(w * 0.6) ? f(s) : NaN; } return o; };
const mean = (s) => s.reduce((x, y) => x + y, 0) / s.length;
const sum = (s) => s.reduce((x, y) => x + y, 0);
function rollMean(a, w, minf = 0.6) { const n = a.length, o = new Float64Array(n); let s = 0, k = 0; for (let i = 0; i < n; i++) { if (!isNaN(a[i])) { s += a[i]; k++; } if (i >= w && !isNaN(a[i - w])) { s -= a[i - w]; k--; } o[i] = k >= Math.ceil(w * minf) ? s / k : NaN; } return o; }
function rollMaxN(a, w) { const n = a.length, o = new Float64Array(n); for (let i = 0; i < n; i++) { let m = -Infinity; for (let j = Math.max(0, i - w + 1); j <= i; j++) if (a[j] > m) m = a[j]; o[i] = m === -Infinity ? NaN : m; } return o; }
function rollMinN(a, w) { const n = a.length, o = new Float64Array(n); for (let i = 0; i < n; i++) { let m = Infinity; for (let j = Math.max(0, i - w + 1); j <= i; j++) if (a[j] < m) m = a[j]; o[i] = m === Infinity ? NaN : m; } return o; }
const ffill = (a) => { const o = Float64Array.from(a); let last = NaN; for (let i = 0; i < o.length; i++) { if (!isNaN(o[i])) last = o[i]; else o[i] = last; } return o; };

// общая капитализация рынка = капитализация BTC / доля BTC (btcd, %), по дню
let TOT = null;
function total() {
  if (TOT) return TOT;
  const b = S.loadPage('strategy-builder-sol').find((x) => x.name === 'BTC'), st = STAND.BTC; TOT = new Map();
  for (let i = 0; i < b.n; i++) { const k = b.t[i] - st.t0; if (k >= 0 && k < st.sup.length && b.ind.btcd[i] > 0) TOT.set(b.t[i], b.c[i] * st.sup[k] / (b.ind.btcd[i] / 100)); }
  return TOT;
}

// признаки капитализации для любой монеты по ряду предложения (sup по дням с t0)
function capFeatures(X, sup, t0) {
  const n = X.n, I = X.ind, mc = new Float64Array(n), sh = new Float64Array(n), T = total();
  for (let i = 0; i < n; i++) { const k = X.t[i] - t0; mc[i] = k >= 0 && k < sup.length ? X.c[i] * sup[k] : NaN; const tt = T.get(X.t[i]); sh[i] = tt ? (mc[i] / tt) * 1e4 : NaN; }
  I.mc = mc; I.mcm = Float64Array.from(mc, (v) => v / 1e6);          // капитализация, млн $
  I.mcsh = sh;                                                        // доля в капитализации рынка, б.п. (0,01%)
  I.mcsh90 = rollMean(sh, 90, 0.5);                                   // средняя доля за 90 дней (медленный признак «лоукап»)
  I.mcm90 = rollMean(I.mcm, 90, 0.5);
}

// признаки объёма/деривативов лоукапа (ряды из lowcap_data.json)
function lowFeatures(X, L) {
  const n = X.n, I = X.ind, at = (a) => { const o = new Float64Array(n); for (let i = 0; i < n; i++) { const k = X.t[i] - L.t0; o[i] = k >= 0 && k < a.length ? a[k] : NaN; } return o; };
  const v = at(L.v), hv = at(L.hv), f = at(L.f), oi = ffill(at(L.oi));
  for (let i = 0; i < n; i++) if (!(v[i] > 0)) v[i] = NaN;
  I.vusd = v; I.hv = hv; I.cf = f; I.coi = oi;
  const v7 = rollMean(v, 7), v20 = rollMean(v, 20), v30 = rollMean(v, 30), v90 = rollMean(v, 90), v180 = rollMean(v, 180, 0.5);
  I.vr1 = Float64Array.from(v, (x, i) => x / v20[i]);                 // объём дня к 20-дн. среднему
  I.vr7_90 = Float64Array.from(v7, (x, i) => x / v90[i]);             // неделя к 90 дням: < 0,5 — объём высох, > 2 — всплеск
  I.vr30_180 = Float64Array.from(v30, (x, i) => x / v180[i]);
  const vmax = rollMaxN(v7, 365);
  I.vpk = Float64Array.from(v7, (x, i) => x / vmax[i]);               // недельный объём к максимуму недельного за год (затухание после пампа)
  I.turn = Float64Array.from(v, (x, i) => (x / I.mc[i]) * 100);       // оборот дня, % капитализации
  I.turn30 = rollMean(I.turn, 30);
  I.turn7 = rollMean(I.turn, 7);
  const cf7 = new Float64Array(n), cf30 = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s7 = 0, k7 = 0, s30 = 0, k30 = 0; for (let j = Math.max(0, i - 29); j <= i; j++) if (!isNaN(f[j])) { s30 += f[j]; k30++; if (j > i - 7) { s7 += f[j]; k7++; } } cf7[i] = k7 >= 5 ? s7 : NaN; cf30[i] = k30 >= 20 ? s30 : NaN; }
  I.cf7 = cf7; I.cf30 = cf30;
  const oimx = rollMaxN(oi, 30), oimn = rollMinN(oi, 30);
  I.coidd30 = Float64Array.from(oi, (x, i) => (x / oimx[i] - 1) * 100);   // OI монеты от 30-дн. максимума, %
  I.coic30 = Float64Array.from(oi, (x, i) => (i >= 30 ? (x / oi[i - 30] - 1) * 100 : NaN));
  I.coimc = Float64Array.from(oi, (x, i) => (x / I.mc[i]) * 100);     // OI к капитализации, %
  // OBV по объёму $ и дневному знаку; расхождение: цена на 30-дн. максимуме, OBV нет
  const obv = new Float64Array(n); for (let i = 1; i < n; i++) obv[i] = obv[i - 1] + (isNaN(v[i]) ? 0 : Math.sign(X.c[i] - X.c[i - 1]) * v[i]);
  I.obv = obv;
  I.agel = Float64Array.from(X.t, (t) => t - L.t0);                    // дней с начала истории монеты (CMC)
}

// флаги-индикаторы постоянные по монете
const constInd = (X, k, v) => { const a = new Float64Array(X.n); a.fill(v); X.ind[k] = a; };
function tday(X) { if (!X.ind.tday) X.ind.tday = Float64Array.from(X.t); }

// ---------- загрузка групп ----------
let G0 = null;
const STAND_KEY = (X, g) => (['sel', 'ex'].includes(g) ? X.name : g === 'rnd' ? 'random50:' + X.name : g === 'n100' ? 'random100:' + X.name : null);
function load(list = ['lsel', 'lchk', 'sel', 'ex', 'rnd', 'n100']) {
  if (G0) return G0;
  const std = list.filter((g) => !g.startsWith('l')), G = std.length ? K.groups(std) : {};
  if (list.some((g) => g.startsWith('l'))) {
    const all = Object.keys(PAGES_LC).flatMap((p) => S.loadPage(p));
    for (const X of all) { A2.addBtc(X); X.low = LOW[X.name]; X.part = X.low ? X.low.part : null; X.meme = X.low ? X.low.meme : 0; }
    for (const g of ['lsel', 'lchk']) if (list.includes(g)) G[g] = all.filter((X) => X.low && X.part === (g === 'lsel' ? 'sel' : 'chk'));
  }
  K.prep(G);
  for (const g in G) for (const X of G[g]) {
    X.grp = g; tday(X);
    if (X.low) { capFeatures(X, X.low.sup, X.low.t0); lowFeatures(X, X.low); constInd(X, 'islc', 1); }
    else { const st = STAND[STAND_KEY(X, g)]; if (st) { capFeatures(X, st.sup, st.t0); lowFeatures(X, st); } else { for (const k of ['mc', 'mcm', 'mcsh', 'mcsh90', 'mcm90']) { const a = new Float64Array(X.n); a.fill(NaN); X.ind[k] = a; } } constInd(X, 'islc', 0); }
  }
  return (G0 = G);
}

// ---------- оценка ----------
const evc = (X, St) => ({ f: K.E(X, St, 'full'), h1: K.E(X, St, 'h1'), h2: K.E(X, St, 'h2') });
function evs(G, St, groups = Object.keys(G)) { const o = {}; for (const g of groups) o[g] = G[g].map((X) => ({ name: X.name, ...evc(X, St) })); return o; }
const med = K.med;
function st(arr) { const f = arr.map((x) => x.f), h = arr.flatMap((x) => [x.h1, x.h2]); return { n: f.length, med: med(f), pos: f.filter((v) => v > 0).length, worst: Math.min(...f), hpos: h.filter((v) => v > 0).length, hworst: Math.min(...h), mlog: mean(f.map((v) => Math.log1p(v / 100))) }; }
const okS = (a, b) => a.pos >= b.pos && a.hpos >= b.hpos && a.hworst >= b.hworst - 1e-9 && a.worst >= b.worst - 1e-9;
// строгая проверка на стандартном стенде (как agent_sim.passes) и доход = сумма лог-медиан sel/ex/rnd
function cmpStd(r, b) {
  const R = {}, B = {}; for (const g of ['sel', 'ex', 'rnd', 'n100']) if (r[g]) { R[g] = st(r[g]); B[g] = st(b[g]); }
  const inc = ['sel', 'ex', 'rnd'].reduce((s, g) => s + Math.log1p(R[g].med / 100) - Math.log1p(B[g].med / 100), 0);
  const why = []; for (const g of ['sel', 'ex']) if (!okS(R[g], B[g])) why.push(g); if (!(R.rnd.pos >= B.rnd.pos && R.rnd.hpos >= B.rnd.hpos && R.rnd.hworst >= B.rnd.hworst - 1e-9)) why.push('rnd');
  return { R, B, inc, pass: !why.length, why: why.join(',') };
}
// лоукапы: медиана, средний лог-прирост по монетам, лучше/хуже, половины, худшая половина
function cmpLow(r, b, g) {
  const R = st(r[g]), B = st(b[g]); let u = 0, d = 0, hu = 0, hd = 0, s = 0;
  r[g].forEach((x, i) => { const q = b[g][i]; s += Math.log1p(x.f / 100) - Math.log1p(q.f / 100); if (x.f > q.f + 0.5) u++; else if (x.f < q.f - 0.5) d++; for (const h of ['h1', 'h2']) { if (x[h] > q[h] + 0.5) hu++; else if (x[h] < q[h] - 0.5) hd++; } });
  return { R, B, dmed: Math.log1p(R.med / 100) - Math.log1p(B.med / 100), dlog: s / r[g].length, u, d, hu, hd, strict: okS(R, B) };
}
const sg = (v, k = 3) => (v >= 0 ? '+' : '') + v.toFixed(k);
function line(tag, r, b) {
  const s = [];
  for (const g of process.env.LOWCAP_SHOW_CHK ? ['lsel', 'lchk'] : ['lsel']) if (r[g]) { const o = cmpLow(r, b, g); s.push(`${g === 'lsel' ? 'ЛОтбор' : 'ЛПров'} ${o.R.med.toFixed(0)}/${o.R.pos}/${o.R.hpos}/${o.R.hworst.toFixed(0)} ср.лог ${sg(o.dlog)} мед ${sg(o.dmed)} ${o.u}/${o.d}${o.strict ? '✔' : '·'}`); }
  if (r.sel) { const o = cmpStd(r, b); s.push(`стенд ${sg(o.inc)}${o.pass ? '✔' : '·' + o.why} [${['sel', 'ex', 'rnd', 'n100'].filter((g) => o.R[g]).map((g) => `${o.R[g].med.toFixed(0)}/${o.R[g].pos}/${o.R[g].hpos}/${o.R[g].hworst.toFixed(0)}`).join(' ')}]` + (r.n100 ? ` 100н ${bw(r, b, 'n100').join('/')}` : '')); }
  return `${tag}\n   ${s.join('\n   ')}`;
}
function bw(r, b, g) { let u = 0, d = 0; r[g].forEach((x, i) => { if (x.f > b[g][i].f + 0.5) u++; else if (x.f < b[g][i].f - 0.5) d++; }); return [u, d]; }

// ---------- правки правил ----------
// основа — combo-best.json; LOWCAP_BASE=combo2 — combo2-best.json (нужны индикаторы списков combo2: см. lowcap_combo2.js)
const BASE = JSON.parse(fs.readFileSync(path.join(__dirname, 'found', process.env.LOWCAP_BASE === 'combo2' ? 'combo2-best.json' : 'combo-best.json'), 'utf8'));
const S0 = { base: BASE.base, rules: BASE.rules };
const pre = (St, sel, cond, act, extra = {}) => ({ ...St, rules: St.rules.flatMap((r, i) => (sel(r, i) ? [{ ...extra, act: typeof act === 'function' ? act(r) : act, conds: [...r.conds, ...cond] }, r] : [r])) });
const addCond = (St, sel, cond) => ({ ...St, rules: St.rules.map((r, i) => (sel(r, i) ? { ...r, conds: [...r.conds, ...cond] } : r)) });
const addRule = (St, rule, pos = 'end') => { const R = [...St.rules]; if (pos === 'end') R.push(rule); else R.splice(pos, 0, rule); return { ...St, rules: R }; };
const isPanic = (r) => r.act > 1 && r.conds.some((x) => x.ind === 'usdt') && !r.conds.some((x) => x.ind === 'btcr30');
const isBuy = (r) => r.act > 1, isSell = (r) => r.act < 0;
const isFear = (r) => r.act < 0 && r.conds.some((x) => x.ind === 'fng' && x.v === 52);
const isWide = (r) => r.act < 0 && r.conds.some((x) => x.ind === 'oth90');
const isNarrow = (r) => r.act < 0 && r.conds.some((x) => x.ind === 'qt');
const isPump = (r) => r.act < 0 && r.conds.some((x) => x.ind === 'up90');
const isRev = (r) => r.act > 1 && r.conds.some((x) => x.ind === 'btcr30');
const isRet = (r) => r.conds.some((x) => x.ind === 'ago_qt');
// правило действует только до/после даты (по дню решения): добавить условие tday
const onlyBefore = (cond, d) => [...cond, c('tday', '<', DAY(d))];
const onlyAfter = (cond, d) => [...cond, c('tday', '>', DAY(d) - 1)];
const day = (X, i) => dstr(X.t[i]);

module.exports = { K, S, A2, c, LD, LOW, STAND, load, evs, evc, st, cmpStd, cmpLow, line, bw, S0, BASE, pre, addCond, addRule, isPanic, isBuy, isSell, isFear, isWide, isNarrow, isPump, isRev, isRet,
  onlyBefore, onlyAfter, day, dstr, DAY, SPLIT, med, mean, rollMean, rollMaxN, rollMinN, ffill, constInd, sg, PAGES_LC };
