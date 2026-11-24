/* c7: 10 кругов улучшения combo7 (found/combo7-draft.json, 133 правила). Общие помощники (research/c7_journal.md).
   Стенд — op_lib.js (au_lib: combo6 + отложенная паника Boost(2, { k: 0, A: 0 }) + фитили −25/−40/−60 → 15/25/35%, раз в 3 дня; индикаторы золота и опционов),
   основа сравнения — combo7: O.base('c7') → P.setBaseline(S7, polW). Оценщик L.run (r4_lib) + половины + средний лог 81 (op_lib.run).
   Множитель-политика (круг 2): правила без копий (58 правил combo5 + 6 порогов пампа hv2) + pol.c7_act (обратно совместимая добавка в panicx_sim.js):
     доля сработавшего правила умножается по его семье и режиму дня — К1 (покупки ×1,5), К4 (страх ×1,5), К-V (фандинг → 0), К-D (вершина/памп ×1,5), hv2 (×1,5 / ×2).
   Доп. индикаторы (рынок, на днях монеты, ffill, только прошлое): c7_dxy90 / c7_dxy30 — DXY за 90/30 дн, %; c7_tnx90 — доходность 10-летних за 90 дн, п.п.;
     c7_dxy200 — DXY / SMA200 (торговые дни).
   Логи — scratchpad/c7/. Использование: const C = require('./c7_lib.js'); C.run('имя', S, pol). */
const fs = require('fs');
const O = require('./op_lib.js');
const { L, P, c, polW, A } = O;
const S7 = O.S7, S6 = O.S6;
O.base('c7');
const LOG = '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/c7/';
function tee(name) { fs.mkdirSync(LOG, { recursive: true }); const f = LOG + name + '.txt'; fs.writeFileSync(f, ''); const o = console.log; console.log = (...a) => { const s = a.join(' '); o(s); fs.appendFileSync(f, s + '\n'); }; }
const T = O.T;

// ---------- рынок: DXY, ставки ----------
const MK = JSON.parse(fs.readFileSync(__dirname + '/cache/st_mkt.json', 'utf8'));
const TT0 = T('2009-01-01'), NT = T('2027-01-01') - TT0;
function cal(t, v) { const a = new Float64Array(NT).fill(NaN); let k = 0, last = NaN; for (let i = 0; i < NT; i++) { const tt = TT0 + i; while (k < t.length && t[k] <= tt) { last = v[k]; k++; } a[i] = last; } return a; }
const tr = (s) => ({ t: MK[s].d.map(T), c: MK[s].c });
const DX = tr('DX-Y.NYB'), TN = tr('^TNX');
const dxc = cal(DX.t, DX.c), tnc = cal(TN.t, TN.c);
const chg = (a, d, abs) => Float64Array.from(a, (x, i) => (i >= d ? (abs ? x - a[i - d] : (x / a[i - d] - 1) * 100) : NaN));
const sma200 = (() => { const v = DX.c, o = v.map(() => NaN); let s = 0; for (let i = 0; i < v.length; i++) { s += v[i]; if (i >= 200) s -= v[i - 200]; if (i >= 199) o[i] = v[i] / (s / 200); } return cal(DX.t, o); })();
const MC = { c7_dxy90: chg(dxc, 90), c7_dxy30: chg(dxc, 30), c7_tnx90: chg(tnc, 90, 1), c7_tnx30: chg(tnc, 30, 1), c7_dxy200: sma200 };
const at = (a, t) => { const i = t - TT0; return i >= 0 && i < NT ? a[i] : NaN; };
for (const k in MC) L.addInd(k, (X) => Float64Array.from(X.ind.t, (t) => at(MC[k], t)));
// k4_mvmin180 — минимум MVRV BTC за 180 прошлых дней (рынок; NaN → 9): «капитуляция была недавно», если < 1 (правило «К4 и цикл», research/k4_cycle.md)
L.addInd('k4_mvmin180', (X) => { const v = X.ind.mvrv, o = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { let m = Infinity; for (let k = Math.max(0, i - 179); k <= i; k++) if (isFinite(v[k]) && v[k] < m) m = v[k]; o[i] = m === Infinity ? 9 : m; } return o; });

// ---------- семьи правил combo7 ----------
const has = (r, ind) => r.conds.some((x) => x.ind === ind);
const LAY = ['agau30', 'au_r30', 'op_vvix', 'op_dvp', 'hvv']; // признаки слоёв-копий
// семья правила combo7: по исходному правилу combo6 (без условий слоёв); слой — какой копией оно является
function fam7(r) {
  const core = { act: r.act, conds: r.conds.filter((x) => !['agau30', 'au_r30', 'op_vvix', 'op_dvp'].includes(x.ind) && !(x.ind === 'age' && (has(r, 'agau30') || has(r, 'au_r30')))) };
  let f = O.famOf(core);
  if (f === 'other') { // копия с изменённой долей — по условиям
    const ids = r.conds.map((x) => x.ind);
    if (ids.includes('fund30')) f = 'fund'; else if (ids.includes('qt')) f = 'qt'; else if (ids.includes('btcath') && ids.includes('oth90')) f = 'top'; else if (ids.includes('up90')) f = 'pump';
    else if (ids.includes('usdt') && r.act < 0) f = 'euph'; else if (ids.includes('usdtd') && r.act < 0) f = 'fear'; else if (r.act > 1) f = 'buy'; else f = '?';
  }
  return f;
}
const lay7 = (r) => (has(r, 'agau30') ? 'K1' : has(r, 'au_r30') ? 'K4' : has(r, 'op_vvix') ? 'KV' : has(r, 'op_dvp') ? 'KD' : has(r, 'hvv') ? 'hv' : '');
const FAM7 = S7.rules.map(fam7), LAY7 = S7.rules.map(lay7);
// убрать копии слоя (или нескольких): правило‑копия, содержащая признак слоя, удаляется
function drop(S, inds) { const Q = L.clone(S); Q.rules = S.rules.filter((r) => !inds.some((k) => has(r, k))).map((r) => JSON.parse(JSON.stringify(r))); return Q; }

// ---------- множитель‑политика (круг 2) ----------
/* ядро: правила combo7 без копий слоёв (58 = combo5) + 6 порогов пампа hv2 (up90 > 275 при hvv > 110, > 250 при hvv > 130) с исходной долей;
   у каждого правила поле f — семья. */
const core = (() => {
  const Q = L.clone(S7); const out = [];
  for (const r of S7.rules) {
    const r0 = JSON.parse(JSON.stringify(r)), f = fam7(r);
    if (['agau30', 'au_r30', 'op_vvix', 'op_dvp'].some((k) => has(r, k))) continue;
    if (has(r, 'hvv')) {
      if (f !== 'pump') continue; // hv2: доли вершины/эйфории → множитель
      const up = r.conds.find((x) => x.ind === 'up90').v, hv = r.conds.find((x) => x.ind === 'hvv').v;
      if ((up === 275 && hv === 110) || (up === 250 && hv === 130)) { r0.act = +(r.act / (hv === 130 ? 2 : 1.5)).toFixed(6); r0.f = 'pump'; r0.thr = 1; out.push(r0); }
      continue;
    }
    r0.f = f; out.push(r0);
  }
  Q.rules = out; return Q;
})();
const buyAct = O.buyAct, sellAct = O.sellAct;
/* опции множителя: k1 (1,5), k4 (1,5), kv (true), kd (1,5), hv ([1,5, 2]); каждую можно выключить 0/false; extra(ctx, f, a) → своя поправка (после всех) */
const MP0 = { k1: 1.5, k1t: -6, k4: 1.5, k4t: 3, kv: 1, kvt: 120, kd: 1.5, kdt: 0.3, hv: [1.5, 2], age: 365 };
function mkAct(o = {}) {
  const p = { ...MP0, ...o };
  return (ctx) => {
    const { X, j, r } = ctx; let a = ctx.a; const I = X.ind, f = r.f;
    if (f === 'buy' && p.k1 && I.agau30[j] < p.k1t && I.age[j] > p.age) a = buyAct(a, p.k1);
    else if (f === 'fear' && p.k4 && I.au_r30[j] > p.k4t && I.age[j] > p.age) a = sellAct(a, p.k4);
    else if (f === 'fund' && p.kv && I.op_vvix[j] > p.kvt) a = 1e-6;
    else if (f === 'top' || f === 'pump' || f === 'euph') {
      if (p.hv && f !== 'pump' && I.isbig[j] < 0.5) { const h = I.hvv[j]; if (h > 130) a = sellAct(a, p.hv[1]); else if (h > 110) a = sellAct(a, p.hv[0]); }
      if (p.hv && f === 'pump' && I.isbig[j] < 0.5) { const h = I.hvv[j]; if (h > 130) a = sellAct(a, p.hv[1]); else if (h > 110) a = sellAct(a, p.hv[0]); }
      if (p.kd && f !== 'euph' && I.op_dvp[j] < p.kdt) a = sellAct(a, p.kd);
    }
    if (p.extra) a = p.extra(ctx, f, a, p);
    return a;
  };
}
const polM = (o = {}) => ({ ...polW, c7_act: mkAct(o) });
// ядро без порогов пампа hv2 (если hv выключен)
function coreNoThr() { const Q = L.clone(core); Q.rules = core.rules.filter((r) => !r.thr); return Q; }

// ---------- отчёт ----------
const run = (nm, S, pol = polW, o = {}) => { if (S.rules.some((r) => r.f) && !(pol && pol.c7_act) && !o.raw) throw new Error('ядро/мини без множителя: передайте polM/polM2 (или o.raw)'); return O.run(nm, S, pol, o); };
const sg = O.sg, L1 = O.L1, G3 = O.G3;
const MINE = O.MINE, BY = O.BY, E = O.E;
function mine(S, pol = polW, S0 = S7, pol0 = polW) { return MINE.map((nm) => { const X = BY[nm]; if (!X) return { nm, miss: 1 }; return { nm, b: E(X, S0, pol0), x: E(X, S, pol) }; }); }
const mineTxt = O.mineTxt;
// по эпизодам: обнулить действия политики/правил в окне дат нельзя напрямую — используем «без эпизода» по датам: доход считаем на обрезанных монетах? —
// здесь: «без эпизода» = отключить новое изменение в окне [a, b] (условие на t вне окна) через индикатор c7_out (1 вне окна, 0 внутри)
function setWindow(a, b) { const ta = T(a), tb = T(b); L.addInd('c7_out', (X) => Float64Array.from(X.ind.t, (t) => (t >= ta && t <= tb ? 0 : 1))); }
setWindow('1900-01-01', '1900-01-02');
const EPS = { '2020-03': ['2020-02-20', '2020-04-30'], '2021-05': ['2021-04-15', '2021-07-31'], '2022': ['2022-01-01', '2022-12-31'], '2024-08': ['2024-07-20', '2024-09-15'], '2025-10': ['2025-10-01', '2025-11-30'] };
module.exports = { O, L, P, A, c, S6, S7, polW, LOG, tee, T, MC, fam7, lay7, FAM7, LAY7, drop, has, core, coreNoThr, mkAct, polM, MP0, buyAct, sellAct, run, sg, L1, G3, MINE, BY, E, mine, mineTxt, setWindow, EPS };

// ---------- круг 2: 23 правила + таблица множителей (сегменты combo2/B65/CM2 + слои) ----------
/* мини: из ядра 64 оставить одно базовое правило на семью (копии сегментов — множителем). Индексы ядра: 0–8 покупки, 9 охрана, 10 удержание, 18 страх (страх < 40),
   26 страх (< 52), 27 разворот, 30 фандинг, 38 qt, 50 вершина, 51 покупка 60, 58/59/60 памп (250 при hvv > 130 / 275 при hvv > 110 / 300), 61 альтсезон, 62 эйфория (без meme < 0,5). */
const mini = (() => { const Q = L.clone(core); const keep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 18, 26, 27, 30, 38, 50, 51, 58, 59, 60, 61, 62];
  Q.rules = keep.map((k) => { const r = JSON.parse(JSON.stringify(core.rules[k])); if (r.f === 'euph') r.conds = r.conds.filter((x) => x.ind !== 'meme'); return r; }); return Q; })();
// сегментный множитель семьи (как копии combo5): rel = rel180 < −15; мем при rel — ×2 вместо ×1,25; cb = (corr180 > 0,6 и vol180 < 90) или крупная
const SEG0 = { rel: 1.25, relMeme: 2, cbFear: 1.25, cbQt: 1.5, cbTop: 1.5, altTop: 1.25, euphMeme: 2 };
function segMult(f, I, j, s = SEG0) {
  const rel = I.rel180[j] < -15, meme = I.meme[j] > 0.5, cb = (I.corr180[j] > 0.6 && I.vol180[j] < 90) || I.isbig[j] > 0.5;
  const mr = rel ? (meme ? s.relMeme : s.rel) : 1;
  if (f === 'fear') return mr * (cb ? s.cbFear : 1);
  if (f === 'qt') return mr * (cb ? s.cbQt : 1);
  if (f === 'top') return mr * (cb ? s.cbTop : 1) * (I.isalt[j] > 0.5 ? s.altTop : 1);
  if (f === 'pump' || f === 'fund') return mr;
  if (f === 'euph') return meme ? s.euphMeme : 1;
  return 1;
}
// политика для мини: сначала сегментный множитель, потом слои (mkAct)
function mkAct2(o = {}, s = SEG0) { const lay = mkAct(o); return (ctx) => { const { X, j, r } = ctx; const m = segMult(r.f, X.ind, j, s); const a = m !== 1 && ctx.a < 0 ? sellAct(ctx.a, m) : ctx.a; return lay({ ...ctx, a }); }; }
const polM2 = (o = {}, s = SEG0) => ({ ...polW, c7_act: mkAct2(o, s) });
Object.assign(module.exports, { mini, SEG0, segMult, mkAct2, polM2 });
