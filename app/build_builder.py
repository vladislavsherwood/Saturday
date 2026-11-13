"""Собирает страницу-конструктор стратегии: правила слева, свечной график с отметками сделок справа.

Запуск: python3 app/build_builder.py <куда сохранить .html> [gold | sol]
"""
import json
import os
import sys

import data

HERE = os.path.dirname(os.path.abspath(__file__))
FROM = "2008-06-01"          # с запасом на разогрев индикаторов


def r6(values):
    return [None if x != x else float(f"{x:.6g}") for x in values]


PAGE = r"""<title>__PAGETITLE__</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
  /* Телефон: одна колонка — итог, график, правила. Широкий экран: правила слева, график справа. */
  :root {
    --bg: #F3F3EF; --surface: #FFFFFF; --text: #0D0E10; --mute: #7E848C; --faint: #D9DAD6;
    --line: rgba(13, 14, 16, 0.08); --hit: rgba(27, 175, 122, 0.16);
    --sans: ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { --bg: #0A0B0D; --surface: #141619; --text: #F5F6F7; --mute: #8A9199; --faint: #2A2E33;
      --line: rgba(255, 255, 255, 0.08); --hit: rgba(25, 158, 112, 0.22); color-scheme: dark; }
  }
  :root[data-theme="dark"] { --bg: #0A0B0D; --surface: #141619; --text: #F5F6F7; --mute: #8A9199; --faint: #2A2E33;
    --line: rgba(255, 255, 255, 0.08); --hit: rgba(25, 158, 112, 0.22); color-scheme: dark; }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { background: var(--bg); color: var(--text); font: 16px/1.35 var(--sans); -webkit-font-smoothing: antialiased;
         padding-block: 20px 56px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
  button, select, input { font: inherit; color: inherit; }
  button { background: none; border: 0; padding: 0; cursor: pointer; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
  .wrap { max-width: 1180px; margin: 0 auto; }
  h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.03em; margin: 0; }
  h1 span { color: var(--mute); }
  .lead { color: var(--mute); font-weight: 600; margin: 6px 0 0; max-width: 64ch; }
  .main { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; margin-top: 18px; align-items: start; }
  .card { background: var(--surface); border-radius: 22px; padding: 16px 18px 20px; min-width: 0; }
  .rules { display: flex; flex-direction: column; gap: 10px; }
  .cap { font-size: 12px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; color: var(--mute); }
  .rule { background: var(--surface); border-radius: 18px; padding: 12px 14px 14px; border: 2px solid transparent; }
  .rule.focus { border-color: var(--text); }
  .rule.off { opacity: .5; }
  .rhead { display: flex; align-items: center; gap: 8px; }
  .rnum { width: 26px; height: 26px; border-radius: 50%; background: var(--bg); display: grid; place-items: center; font-weight: 800; font-size: 13px; }
  .rhead .sp { flex: 1; color: var(--mute); font-size: 13px; font-weight: 650; text-align: right; font-variant-numeric: tabular-nums; }
  .ib { width: 32px; height: 32px; border-radius: 10px; background: var(--bg); font-weight: 800; color: var(--mute); }
  .ib:disabled { opacity: .3; }
  .sw { width: 40px; height: 24px; border-radius: 12px; background: var(--faint); position: relative; flex: none; }
  .sw::after { content: ""; position: absolute; left: 3px; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--surface); transition: transform .15s; }
  .sw[aria-checked="true"] { background: var(--text); }
  .sw[aria-checked="true"]::after { transform: translateX(16px); }
  .cond { margin-top: 10px; }
  .crow { display: grid; grid-template-columns: auto minmax(0, 1fr) 40px 76px; gap: 6px; align-items: center; }
  .crow > span { color: var(--mute); font-weight: 700; font-size: 14px; width: 34px; }
  select, input[type="number"] { background: var(--bg); border: 0; border-radius: 10px; padding: 9px 10px; font-weight: 700; min-width: 0; width: 100%; }
  input[type="number"] { text-align: right; font-variant-numeric: tabular-nums; }
  .op { height: 38px; border-radius: 10px; background: var(--bg); font-weight: 800; font-size: 18px; }
  input[type="range"] { width: 100%; margin: 8px 0 0; accent-color: var(--text); }
  .link { color: var(--mute); font-weight: 700; font-size: 13px; margin-top: 8px; text-decoration: underline; text-underline-offset: 3px; }
  .acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; align-items: center; }
  .acts > span { color: var(--mute); font-weight: 700; font-size: 14px; width: 34px; }
  .act { padding: 7px 11px; border-radius: 999px; background: var(--bg); font-weight: 750; font-size: 14px; }
  .act.on { background: var(--text); color: var(--surface); }
  .act.sell.on { background: #d95926; color: #fff; }
  .mode { display: grid; grid-template-columns: 1fr 1fr; background: var(--surface); border-radius: 14px; padding: 4px; }
  .mode button { padding: 10px 6px; border-radius: 11px; font-weight: 750; color: var(--mute); }
  .mode button.on { background: var(--text); color: var(--bg); }
  .hint { color: var(--mute); font-size: 13.5px; font-weight: 600; margin: 0 2px 6px; line-height: 1.4; }
  .tools { display: flex; flex-wrap: wrap; gap: 8px; }
  .btn { padding: 11px 16px; border-radius: 14px; background: var(--surface); font-weight: 750; }
  .btn.dark { background: var(--text); color: var(--bg); }
  .copy { width: 100%; margin-top: 8px; background: var(--surface); border: 0; border-radius: 14px; padding: 12px; font: 600 13px/1.45 ui-monospace, Menlo, monospace; color: var(--text); resize: vertical; }
  .bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 4; background: var(--bg); padding: 8px 0; margin-top: 10px;
         display: flex; gap: 14px; align-items: baseline; flex-wrap: wrap; font-weight: 750; font-variant-numeric: tabular-nums; }
  .bar b { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
  .bar .up { color: #0c8a4a; } .bar .down { color: #d1483f; } .bar span { color: var(--mute); }
  .mix { display: flex; height: 8px; border-radius: 4px; overflow: hidden; gap: 2px; margin-top: 4px; background: var(--bg); }
  .mix i { display: block; height: 100%; }
  .mixl { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; color: var(--mute); font-size: 13px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .mixl i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 5px; }
  .knobs { display: flex; flex-wrap: wrap; gap: 14px 10px; margin-top: 14px; }
  .kcell { width: 104px; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 10px 4px 10px; border-radius: 18px; background: var(--surface); border: 2px solid transparent; }
  .kcell.focus { border-color: var(--text); }
  .knob { position: relative; width: 76px; height: 76px; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; border-radius: 50%; }
  .knob:active { cursor: grabbing; }
  .knob svg { display: block; }
  .knob b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; pointer-events: none; }
  .klabel { font-size: 12.5px; font-weight: 700; margin-top: 6px; line-height: 1.2; }
  .kact { font-size: 12px; font-weight: 750; color: var(--mute); margin-top: 2px; }
  .kact.buy { color: #0c8a4a; } .kact.sell { color: #c2511f; }
  .presets { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
  .presets button { text-align: left; padding: 11px 14px; border-radius: 14px; background: var(--surface); font-weight: 700; }
  .ind text { font: 600 11px var(--sans); fill: var(--mute); font-variant-numeric: tabular-nums; }
  .ind svg { display: block; width: 100%; overflow: visible; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .bar .up { color: #3ecf8e; } :root:not([data-theme="light"]) .bar .down { color: #ff7a70; } }
  :root[data-theme="dark"] .bar .up { color: #3ecf8e; } :root[data-theme="dark"] .bar .down { color: #ff7a70; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .kact.buy { color: #3ecf8e; } :root:not([data-theme="light"]) .kact.sell { color: #f08a5b; } }
  :root[data-theme="dark"] .kact.buy { color: #3ecf8e; } :root[data-theme="dark"] .kact.sell { color: #f08a5b; }
  @media (min-width: 940px) {
    .main { grid-template-columns: 400px minmax(0, 1fr); }
    .left { order: -1; position: sticky; top: 12px; max-height: calc(100vh - 24px); overflow: auto; padding-right: 4px; }
    .bar { position: static; }
  }
</style>
<div class="wrap">
  <h1>Конструктор стратегии <span>· __TITLE__</span></h1>
  <p class="lead">Правила проверяются сверху вниз, срабатывает первое подходящее. Крутите пороги — отметки покупок и продаж на графике перестроятся сразу.</p>
  <div class="bar" id="bar"></div>
  <div class="cap" style="margin-top:14px">Крутилки</div>
  <div class="knobs" id="knobs"></div>
  <div class="main">
    <div class="card" id="result"></div>
    <div class="left rules" id="left"></div>
  </div>
</div>
<script>__EXPLORER__</script>
<script>
const RAW = __DATA__;
const KEY = "dca-builder-__SLUG__-v2";

/* ---------- индикаторы (считаются по закрытию дня) ---------- */
function sma(a, n) { const o = new Array(a.length).fill(NaN); let s = 0, c = 0; for (let i = 0; i < a.length; i++) { const v = a[i]; if (v == null || isNaN(v)) { continue; } s += v; c++; if (c > n) { s -= a[i - n]; c = n; } if (c === n) o[i] = s / n; } return o; }
function ratio(a, n) { const m = sma(a, n); return a.map((v, i) => v / m[i]); }
function rsi(a, n) { const o = new Array(a.length).fill(NaN); let up = 0, dn = 0; for (let i = 1; i < a.length; i++) { const d = a[i] - a[i - 1]; up = (up * (n - 1) + Math.max(d, 0)) / n; dn = (dn * (n - 1) + Math.max(-d, 0)) / n; if (i >= n) o[i] = dn === 0 ? 100 : 100 - 100 / (1 + up / dn); } return o; }
function drawdown(a, n) { return a.map((v, i) => { let m = -Infinity; for (let j = Math.max(0, i - n + 1); j <= i; j++) if (a[j] > m) m = a[j]; return i < 60 ? NaN : (1 - v / m) * 100; }); }
function change(a, n) { return a.map((v, i) => (i >= n ? (v / a[i - n] - 1) * 100 : NaN)); }
function boll(a, n) { const m = sma(a, n); return a.map((v, i) => { if (isNaN(m[i])) return NaN; let s = 0; for (let j = i - n + 1; j <= i; j++) s += (a[j] - m[i]) ** 2; const sd = Math.sqrt(s / n); return sd ? (v - m[i]) / sd : 0; }); }
function fill(a) { let last = NaN; return a.map((v) => (v == null ? last : (last = v))); }
const C = RAW.c;
const IND = {
  sma200: { short: "Цена / SMA200", name: "Цена к средней за 200 дней", min: 0.75, max: 1.35, step: 0.01, def: 1.0, v: ratio(C, 200) },
  sma50: { short: "Цена / SMA50", name: "Цена к средней за 50 дней", min: 0.85, max: 1.2, step: 0.01, def: 1.0, v: ratio(C, 50) },
  dd: { short: "Просадка, %", name: "Просадка от годового максимума, %", min: 0, max: 45, step: 1, def: 15, v: drawdown(C, RAW.bpy) },
  rsi: { short: "RSI", name: "RSI за 14 дней", min: 10, max: 90, step: 1, def: 30, v: rsi(C, 14) },
  ret30: { short: "За месяц, %", name: "Изменение за месяц, %", min: -20, max: 20, step: 1, def: -5, v: change(C, RAW.bpy === 365 ? 30 : 21) },
  ret90: { short: "За квартал, %", name: "Изменение за квартал, %", min: -30, max: 40, step: 1, def: -10, v: change(C, RAW.bpy === 365 ? 90 : 63) },
  bbz: { short: "Отклонение, σ", name: "Отклонение от средней за 20 дней, σ", min: -3, max: 3, step: 0.1, def: -2, v: boll(C, 20) },
};
if (RAW.vix) IND.vix = { short: "VIX", name: "VIX — страх на рынке акций", min: 10, max: 60, step: 1, def: 30, v: fill(RAW.vix) };
if (RAW.dxy) IND.dxy = { short: "Доллар / SMA200", name: "Доллар (DXY) к средней за 200 дней", min: 0.9, max: 1.12, step: 0.005, def: 1.0, v: ratio(fill(RAW.dxy), 200) };
if (RAW.fng) IND.fng = { short: "Страх и жадность", name: "Индекс страха и жадности", min: 5, max: 95, step: 1, def: 25, v: fill(RAW.fng) };
if (RAW.usdt) IND.usdt = { short: "USDT.D / SMA200", name: "USDT.D к средней за 200 дней", min: 0.6, max: 1.6, step: 0.01, def: 1.2, v: ratio(fill(RAW.usdt), 200) };
if (RAW.pair) IND.pair = { short: RAW.pairName, name: RAW.pairName + " к средней за 200 дней", min: 0.75, max: 1.35, step: 0.01, def: 1.0, v: ratio(C.map((v, i) => v / fill(RAW.pair)[i]), 200) };

for (const key of ["sma200", "sma50", "dd", "ret30", "ret90", "dxy", "usdt", "pair"]) {
  const d = IND[key]; if (!d) continue;
  const vals = d.v.filter((x) => x != null && !isNaN(x)).sort((x, y) => x - y); if (vals.length < 50) continue;
  const q = (f) => vals[Math.min(vals.length - 1, Math.floor(f * vals.length))];
  const big = d.step >= 1 ? 5 : 0.05;
  const lo = Math.floor(q(0.003) / big) * big, hi = Math.ceil(q(0.997) / big) * big;
  d.min = key === "dd" ? 0 : +Math.min(d.min, lo).toFixed(3); d.max = +Math.max(d.max, hi).toFixed(3);
  if (d.max - d.min > 250 * d.step) d.step = d.step >= 1 ? 5 : 0.05;
}
const SKIP = RAW.skip;                             // разогрев индикаторов не входит в расчёт
const H = { t: RAW.t.slice(SKIP), c: RAW.c.slice(SKIP), o: RAW.o.slice(SKIP), h: RAW.h.slice(SKIP), l: RAW.l.slice(SKIP) };
Object.values(IND).forEach((d) => (d.v = d.v.slice(SKIP)));
const N = H.t.length;

/* ---------- состояние ---------- */
const DEFAULT = { mode: "pct", base: 1, pbase: 1, period: "all", unit: 10, focus: RAW.rules[0].id, rules: RAW.rules };
let S = JSON.parse(JSON.stringify(DEFAULT));
try { const saved = JSON.parse(localStorage.getItem(KEY)); if (saved && Array.isArray(saved.rules)) S = saved; } catch (e) {}
if (!S.mode) S.mode = "pct";
let WIN = null;
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

const W_ACTS = [[0, "пропуск"], [1, "×1"], [2, "×2"], [3, "×3"], [-1, "продать ×1"], [-2, "продать ×2"], [-3, "продать ×3"]];
// доля портфеля: 1 — купить на дневной взнос, 1 + f — ещё и долю f резерва, отрицательное — продать долю позиции
const P_ACTS = [[0, "пропуск"], [1, "взнос"], [1.1, "+10% резерва"], [1.25, "+25%"], [1.5, "+50%"], [2, "весь резерв"],
  [-0.02, "продать 2%"], [-0.05, "продать 5%"], [-0.1, "продать 10%"], [-0.25, "продать 25%"]];
const W2P = { 0: 0, 1: 1, 2: 1.25, 3: 1.5, "-1": -0.02, "-2": -0.05, "-3": -0.1 };
const PCT = () => S.mode === "pct";
const ACTS = () => (PCT() ? P_ACTS : W_ACTS);
const actOf = (r) => (PCT() ? (r.pact ?? W2P[r.act]) : r.act);
const baseAct = () => (PCT() ? (S.pbase ?? 1) : S.base);
function actName(a) {
  if (!PCT()) return a > 0 ? "купить ×" + a : a < 0 ? "продать ×" + -a : "пропуск";
  if (a === 0) return "пропуск";
  if (a < 0) return "продать " + Math.round(-a * 100) + "% позиции";
  if (a === 1) return "купить на взнос";
  return a >= 2 ? "взнос и весь резерв" : "взнос и " + Math.round((a - 1) * 100) + "% резерва";
}
const hit = (c, i) => { const v = IND[c.ind].v[i]; return !(v == null || isNaN(v)) && (c.op === "<" ? v < c.v : v > c.v); };
const fmtV = (c) => String(+c.v.toFixed(3)).replace(".", ",");

function decide() {
  const acts = new Array(N), who = new Int16Array(N);
  const rules = S.rules.filter((r) => r.on && IND[r.a.ind] && (!r.b || IND[r.b.ind]));
  for (let i = 0; i < N; i++) {
    let a = baseAct(), w = 0;
    for (const r of rules) if (hit(r.a, i) && (!r.b || hit(r.b, i))) { a = actOf(r); w = r.id; break; }
    acts[i] = a; who[i] = w;
  }
  return { acts, who };
}

/* ---------- панель индикатора под свечами ---------- */
function indPanel(c, g) {
  const d = IND[c.ind], W = g.W, pw = g.pw, hgt = 96, top = 20, ph = hgt - top - 6;
  let lo = Infinity, hi = -Infinity;
  const pts = [];
  for (let q = 0; q < g.n; q++) {
    const ja = g.a + q * g.k, jb = Math.min(g.b, ja + g.k);
    const v = d.v[g.i0 + jb - 1];
    let any = false;
    for (let j = ja; j < jb; j++) if (hit(c, g.i0 + j)) { any = true; break; }
    pts.push([v, any]);
    if (!isNaN(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
  }
  lo = Math.min(lo, c.v); hi = Math.max(hi, c.v); if (hi === lo) hi = lo + 1;
  const Y = (v) => top + (1 - (v - lo) / (hi - lo)) * ph;
  let path = "", shade = "", pen = false;
  pts.forEach(([v, any], q) => {
    const x = (q + 0.5) * g.cw;
    if (any) shade += `<rect x="${(q * g.cw).toFixed(1)}" y="${top}" width="${(g.cw + 0.3).toFixed(1)}" height="${ph}" fill="var(--hit)"/>`;
    if (isNaN(v)) { pen = false; return; }
    path += (pen ? "L" : "M") + x.toFixed(1) + " " + Y(v).toFixed(1); pen = true;
  });
  const num = (v) => String(+v.toFixed(2)).replace(".", ",");
  return `<div class="ex-cap" style="margin-top:14px"><span>${d.name} ${c.op} ${fmtV(c)}</span><span><i style="--k:var(--hit)">условие выполняется</i></span></div>
    <div class="ind"><svg viewBox="0 0 ${W} ${hgt}" height="${hgt}" role="img" aria-label="${d.name}">
    ${shade}<path d="${path}" fill="none" stroke="var(--text)" stroke-width="1.5" stroke-linejoin="round"/>
    <line x1="0" x2="${pw}" y1="${Y(c.v).toFixed(1)}" y2="${Y(c.v).toFixed(1)}" stroke="var(--viz-sell)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text x="${pw + 6}" y="${Y(c.v) + 4}" style="fill:var(--text)">${fmtV(c)}</text>
    ${Math.abs(Y(hi) - Y(c.v)) > 13 ? `<text x="${pw + 6}" y="${Y(hi) + 8}">${num(hi)}</text>` : ""}
    ${Math.abs(Y(lo) - Y(c.v)) > 13 ? `<text x="${pw + 6}" y="${Y(lo)}">${num(lo)}</text>` : ""}</svg></div>`;
}

/* ---------- результат ---------- */
let LAST = null;
function results() {
  const { acts, who } = decide();
  const codes = Explorer.CODES;
  const mine = PCT() ? { plan: acts } : { acts: acts.map((a) => codes[a + 3]).join("") };
  const h = { ...H, strategies: [{ code: "mine", name: "Моя стратегия", about: summary(), ...mine }] };
  const focus = S.rules.find((r) => r.id === S.focus && r.on);
  Explorer.detail(document.getElementById("result"), h, "mine", { period: S.period, unit: S.unit, win: WIN,
    onPeriod: (p) => { S.period = p; WIN = null; save(); results(); },
    onDraw: (el, g, sim) => {
      WIN = { a: g.a, b: g.b };
      el.innerHTML = focus ? [focus.a, focus.b].filter(Boolean).map((c) => indPanel(c, g)).join("") : "";
    } });
  const years = { "1y": 1, "3y": 3, "5y": 5, all: 0 }[S.period] || 0;
  const i0 = Explorer.startIndex(h, years), s = (PCT() ? Explorer.simulateReserve : Explorer.simulate)(h, h.strategies[0], i0, S.unit);
  LAST = s;
  const d = s.edge, cls = d == null || Math.abs(d) < 0.05 ? "" : d > 0 ? "up" : "down";
  // распределение дней по действиям и сколько дней решает каждое правило
  const mix = {}, per = {};
  for (let i = Math.max(i0 - 1, 0); i < N - 1; i++) { mix[acts[i]] = (mix[acts[i]] || 0) + 1; per[who[i]] = (per[who[i]] || 0) + 1; }
  const total = Object.values(mix).reduce((x, y) => x + y, 0) || 1;
  const tier = (a) => (PCT() ? (a >= 1.5 ? 3 : a > 1 ? 2 : a === 1 ? 1 : a === 0 ? 0 : a <= -0.1 ? -3 : a <= -0.05 ? -2 : -1) : a);
  const COLS = { 3: "#0e7a53", 2: "#1baf7a", 1: "#8fd9bd", 0: "var(--faint)", "-1": "#f0a27f", "-2": "#eb6834", "-3": "#b8431a" };
  const COL = new Proxy({}, { get: (_, a) => COLS[tier(Number(a))] });
  const order = Object.keys(mix).map(Number).sort((x, y) => y - x);
  document.getElementById("bar").innerHTML = `<b>${Explorer.pct(s.irr, true)}</b><span>в год</span>
    <span class="${cls}">${d == null ? "" : Explorer.pct(d, true).replace("%", " п.п.") + " к DCA"}</span>
    ${s.reserve ? `<span class="${cls}">итог ${Explorer.pct(s.wealthEdge, true)} к DCA</span>` : ""}
    <span>прибыль ${Explorer.money(s.pnl, true)} · DCA ${Explorer.money(s.dca.pnl, true)}${s.reserve ? " · в резерве " + Explorer.money(s.cash) : " · вложено " + Explorer.money(s.inv) + " против " + Explorer.money(s.dca.inv)}</span>
    <div style="flex-basis:100%"><div class="mix">${order.map((a) => `<i style="width:${(mix[a] / total) * 100}%;background:${COL[a]}"></i>`).join("")}</div>
    <div class="mixl">${order.map((a) => `<span><i style="background:${COL[a]}"></i>${actName(a)} — ${Math.round((mix[a] / total) * 100)}% дней</span>`).join("")}</div></div>`;
  document.querySelectorAll("[data-count]").forEach((el) => {
    const n = per[el.dataset.count] || 0;
    el.textContent = n ? `решает ${n} дн · ${Math.round((n / total) * 100)}%` : "не срабатывает";
  });
}
function summary() {
  return S.rules.filter((r) => r.on).length + " правил, иначе " + actName(baseAct()) + (PCT() ? ". Денег вносится столько же, сколько у DCA" : "");
}
function asText() {
  const lines = S.rules.filter((r) => r.on).map((r, k) =>
    `${k + 1}. если ${IND[r.a.ind].name} ${r.a.op} ${fmtV(r.a)}${r.b ? ` и ${IND[r.b.ind].name} ${r.b.op} ${fmtV(r.b)}` : ""} → ${actName(actOf(r))}`);
  const s = LAST;
  return `Стратегия для __TITLE__ (режим: ${PCT() ? "доля портфеля, взнос $" + S.unit + " в день" : "веса, ×1 = $" + S.unit}; период: ${S.period})\n${lines.join("\n")}\nиначе → ${actName(baseAct())}\n` +
    (s ? `Результат: ${s.reserve ? "итог " + Explorer.pct(s.wealthEdge, true) + " к DCA, " : ""}${Explorer.pct(s.irr, true)} в год, ${s.edge == null ? "" : Explorer.pct(s.edge, true).replace("%", " п.п.")} к DCA, прибыль ${Explorer.money(s.pnl, true)} против ${Explorer.money(s.dca.pnl, true)}` : "");
}

/* ---------- крутилки ---------- */
function knobSvg(frac, color) {
  const cx = 38, cy = 38, R = 31, pt = (f, r) => { const a = ((-135 + 270 * f) * Math.PI) / 180; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; };
  const arc = (f0, f1) => { const [x0, y0] = pt(f0, R), [x1, y1] = pt(f1, R); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${R} ${R} 0 ${(f1 - f0) * 270 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  const [nx, ny] = pt(frac, R - 9), [mx, my] = pt(frac, R - 2);
  return `<svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true"><path d="${arc(0, 1)}" fill="none" stroke="var(--faint)" stroke-width="6" stroke-linecap="round"/>
    ${frac > 0.005 ? `<path d="${arc(0, frac)}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"/>` : ""}
    <line x1="${nx.toFixed(1)}" y1="${ny.toFixed(1)}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" stroke="var(--text)" stroke-width="3" stroke-linecap="round"/></svg>`;
}
const actColor = (a) => (a > 0 ? "var(--viz-buy, #1baf7a)" : a < 0 ? "var(--viz-sell, #eb6834)" : "var(--mute)");
function knobInner(r, key) {
  const c = r[key], d = IND[c.ind], frac = Math.max(0, Math.min(1, (c.v - d.min) / (d.max - d.min)));
  return knobSvg(frac, actColor(actOf(r))) + `<b>${fmtV(c)}</b>`;
}
function knobs() {
  const el = document.getElementById("knobs");
  const on = S.rules.filter((r) => r.on);
  el.innerHTML = on.length ? on.map((r) => [["a", r.a], ["b", r.b]].filter((x) => x[1]).map(([key, c]) => {
    const d = IND[c.ind];
    return `<div class="kcell ${r.id === S.focus ? "focus" : ""}" data-kr="${r.id}">
      <div class="knob" data-knob="${r.id}:${key}" role="slider" tabindex="0" aria-label="${d.name}, порог" aria-valuemin="${d.min}" aria-valuemax="${d.max}" aria-valuenow="${c.v}">${knobInner(r, key)}</div>
      <div class="klabel">${d.short} ${c.op === ">" ? "выше" : "ниже"}</div>
      <div class="kact ${actOf(r) > 0 ? "buy" : actOf(r) < 0 ? "sell" : ""}">${key === "b" ? "и" : actName(actOf(r))}</div></div>`;
  }).join("")).join("") : '<div class="lead" style="margin:0">Добавьте правило — у него появится крутилка.</div>';
}
function setKnob(el, v) {
  const [rid, key] = el.dataset.knob.split(":"), r = S.rules.find((x) => String(x.id) === rid);
  if (!r) return;
  const d = IND[r[key].ind];
  v = Math.max(d.min, Math.min(d.max, Math.round(v / d.step) * d.step));
  v = +v.toFixed(4);
  if (v === r[key].v && S.focus === r.id) return;
  r[key].v = v; S.focus = r.id;
  el.innerHTML = knobInner(r, key); el.setAttribute("aria-valuenow", v);
  document.querySelectorAll(".kcell").forEach((x) => x.classList.toggle("focus", x.dataset.kr === rid));
  for (const pre of ["n-", "s-"]) { const twin = document.getElementById(pre + rid + "-" + key); if (twin) twin.value = v; }
  left.querySelectorAll(".rule").forEach((x) => x.classList.toggle("focus", x.dataset.rule === rid));
  save(); results();
}
(function () {
  const box = document.getElementById("knobs");
  let drag = null;
  const info = (el) => { const [rid, key] = el.dataset.knob.split(":"), r = S.rules.find((x) => String(x.id) === rid); return r ? { c: r[key], d: IND[r[key].ind] } : null; };
  box.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".knob"); if (!el) return;
    const k = info(el); if (!k) return;
    drag = { el, x: e.clientX, y: e.clientY, v: k.c.v, range: k.d.max - k.d.min };
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    setKnob(el, k.c.v); e.preventDefault();
  });
  box.addEventListener("pointermove", (e) => { if (drag) setKnob(drag.el, drag.v + ((e.clientX - drag.x - (e.clientY - drag.y)) / 170) * drag.range); });
  const end = () => { if (drag) { drag = null; } };
  box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
  box.addEventListener("keydown", (e) => {
    const el = e.target.closest(".knob"); if (!el) return;
    const k = info(el), dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (k && dir) { setKnob(el, k.c.v + dir * k.d.step); e.preventDefault(); }
  });
  box.addEventListener("wheel", (e) => { const el = e.target.closest(".knob"); if (!el) return; const k = info(el); if (k) { setKnob(el, k.c.v + (e.deltaY < 0 ? 1 : -1) * k.d.step); e.preventDefault(); } }, { passive: false });
})();
const PRESETS = [
  ["Не покупать, когда RSI выше…", { a: { ind: "rsi", op: ">", v: 70 }, act: 0 }, "top"],
  ["Не покупать, когда цена выше средней за 200 дней на…", { a: { ind: "sma200", op: ">", v: 1.15 }, act: 0 }, "top"],
  ["Покупать ×3 на просадке больше…", { a: { ind: "dd", op: ">", v: 15 }, act: 3 }, "end"],
  ["Покупать ×2, когда RSI ниже…", { a: { ind: "rsi", op: "<", v: 35 }, act: 2 }, "end"],
  ["Покупать ×2, когда цена ниже средней за 200 дней", { a: { ind: "sma200", op: "<", v: 1.0 }, act: 2 }, "end"],
  ["Продавать, когда RSI выше…", { a: { ind: "rsi", op: ">", v: 80 }, act: -1 }, "top"],
  ["Продавать, когда цена выше средней за 200 дней на…", { a: { ind: "sma200", op: ">", v: 1.25 }, act: -1 }, "top"],
  ["Своё правило", { a: { ind: "ret30", op: "<", v: -5 }, act: 2 }, "end"],
];

/* ---------- правила ---------- */
function condHtml(r, key, label) {
  const c = r[key], d = IND[c.ind];
  return `<div class="cond" data-cond="${key}"><div class="crow"><span>${label}</span>
      <select data-f="ind" aria-label="Индикатор">${Object.entries(IND).map(([k, v]) => `<option value="${k}" ${k === c.ind ? "selected" : ""}>${v.name}</option>`).join("")}</select>
      <button class="op" data-f="op" aria-label="Больше или меньше">${c.op}</button>
      <input type="number" data-f="v" id="n-${r.id}-${key}" value="${c.v}" step="${d.step}" aria-label="Порог"></div>
    <input type="range" data-f="v" id="s-${r.id}-${key}" min="${d.min}" max="${d.max}" step="${d.step}" value="${c.v}" aria-label="Порог"></div>`;
}
function rulesPanel() {
  const el = document.getElementById("left");
  el.innerHTML = `<div class="cap">Как считать</div>
    <div class="mode"><button class="${PCT() ? "on" : ""}" data-mode="pct">Доля портфеля</button><button class="${PCT() ? "" : "on"}" data-mode="w">Веса ×1–×3</button></div>
    <p class="hint">${PCT() ? "Каждый день в резерв приходит взнос — столько же, сколько тратит DCA. Правило решает: купить на взнос, пропустить и копить, добавить часть резерва или продать часть позиции. Разница с DCA — только от правил."
      : "Правило задаёт размер покупки. Стратегия может вложить больше денег, чем DCA, поэтому прибыль в долларах сравнивать нельзя."}</p>
    <div class="cap">Правила</div>` + S.rules.map((r, k) => `
    <div class="rule ${r.id === S.focus ? "focus" : ""} ${r.on ? "" : "off"}" data-rule="${r.id}">
      <div class="rhead"><div class="rnum">${k + 1}</div>
        <button class="sw" role="switch" aria-checked="${r.on}" data-f="on" aria-label="Включить правило"></button>
        <span class="sp" data-count="${r.id}"></span>
        <button class="ib" data-f="up" ${k === 0 ? "disabled" : ""} aria-label="Выше">↑</button>
        <button class="ib" data-f="down" ${k === S.rules.length - 1 ? "disabled" : ""} aria-label="Ниже">↓</button>
        <button class="ib" data-f="del" aria-label="Удалить">×</button></div>
      ${condHtml(r, "a", "если")}${r.b ? condHtml(r, "b", "и") : ""}
      <button class="link" data-f="${r.b ? "delb" : "addb"}">${r.b ? "убрать второе условие" : "+ второе условие"}</button>
      <div class="acts"><span>то</span>${ACTS().map(([a, n]) => `<button class="act ${a < 0 ? "sell" : ""} ${actOf(r) === a ? "on" : ""}" data-act="${a}">${n}</button>`).join("")}</div>
    </div>`).join("") + `
    <div class="rule" data-rule="base"><div class="rhead"><div class="rnum">…</div><span class="sp" data-count="0" style="text-align:left"></span></div>
      <div class="acts"><span>иначе</span>${ACTS().filter(([a]) => a >= 0 && (!PCT() || a <= 1)).map(([a, n]) => `<button class="act ${baseAct() === a ? "on" : ""}" data-base="${a}">${n}</button>`).join("")}</div></div>
    <div class="tools"><button class="btn dark" data-tool="add">+ Правило</button><button class="btn" data-tool="copy">Скопировать правила</button>
      <button class="btn" data-tool="reset">Сбросить</button></div><div id="presets"></div><div id="copybox"></div>`;
  knobs();
}
function ruleOf(target) { const box = target.closest("[data-rule]"); return box ? S.rules.find((r) => String(r.id) === box.dataset.rule) : null; }
const left = document.getElementById("left");
left.addEventListener("input", (e) => {
  const f = e.target.dataset.f, r = ruleOf(e.target);
  if (!r || f !== "v") return;
  const key = e.target.closest("[data-cond]").dataset.cond, v = Number(e.target.value);
  if (isNaN(v)) return;
  r[key].v = v; S.focus = r.id;
  const twin = document.getElementById((e.target.type === "range" ? "n-" : "s-") + r.id + "-" + key); if (twin) twin.value = v;
  left.querySelectorAll(".rule").forEach((x) => x.classList.toggle("focus", x.dataset.rule === String(r.id)));
  knobs(); save(); results();
});
left.addEventListener("change", (e) => {
  const r = ruleOf(e.target);
  if (r && e.target.dataset.f === "ind") { const key = e.target.closest("[data-cond]").dataset.cond; r[key] = { ind: e.target.value, op: r[key].op, v: IND[e.target.value].def }; S.focus = r.id; save(); rulesPanel(); results(); }
});
left.addEventListener("click", (e) => {
  const t = e.target.closest("button"), r = ruleOf(e.target);
  if (!t) { if (r && S.focus !== r.id) { S.focus = r.id; save(); rulesPanel(); results(); } return; }
  const f = t.dataset.f, k = r ? S.rules.indexOf(r) : -1;
  if (t.dataset.tool === "add") {
    const box = document.getElementById("presets");
    box.innerHTML = box.innerHTML ? "" : '<div class="presets">' + PRESETS.map((x, n) => `<button data-preset="${n}">${x[0]}</button>`).join("") + "</div>";
    return;
  }
  else if (t.dataset.preset !== undefined) {
    const [, tpl, where] = PRESETS[Number(t.dataset.preset)], id = Math.max(0, ...S.rules.map((x) => x.id)) + 1;
    const rule = { id, on: true, a: { ...tpl.a }, b: null, act: tpl.act };
    if (where === "top") S.rules.unshift(rule); else S.rules.push(rule);
    S.focus = id;
  }
  else if (t.dataset.tool === "reset") { S = JSON.parse(JSON.stringify(DEFAULT)); WIN = null; }
  else if (t.dataset.tool === "copy") {
    const text = asText(), box = document.getElementById("copybox");
    box.innerHTML = '<textarea class="copy" id="copytext" rows="7" readonly></textarea>'; const ta = document.getElementById("copytext"); ta.value = text;
    const ok = () => { t.textContent = "Скопировано"; setTimeout(() => (t.textContent = "Скопировать правила"), 1600); };
    try { navigator.clipboard.writeText(text).then(ok, () => ta.select()); } catch (err) { ta.select(); }
    return;
  }
  else if (t.dataset.mode) { S.mode = t.dataset.mode; WIN = null; }
  else if (t.dataset.base !== undefined) { if (PCT()) S.pbase = Number(t.dataset.base); else S.base = Number(t.dataset.base); }
  else if (!r) return;
  else if (t.dataset.act !== undefined) { if (PCT()) r.pact = Number(t.dataset.act); else r.act = Number(t.dataset.act); S.focus = r.id; }
  else if (f === "on") r.on = !r.on;
  else if (f === "op") { const key = t.closest("[data-cond]").dataset.cond; r[key].op = r[key].op === "<" ? ">" : "<"; S.focus = r.id; }
  else if (f === "up" && k > 0) { S.rules.splice(k - 1, 0, S.rules.splice(k, 1)[0]); }
  else if (f === "down" && k < S.rules.length - 1) { S.rules.splice(k + 1, 0, S.rules.splice(k, 1)[0]); }
  else if (f === "del") S.rules.splice(k, 1);
  else if (f === "addb") { r.b = { ind: "rsi", op: "<", v: 40 }; S.focus = r.id; }
  else if (f === "delb") r.b = null;
  save(); rulesPanel(); results();
});
document.getElementById("knobs").addEventListener("click", (e) => {
  const cell = e.target.closest(".kcell"); if (!cell || e.target.closest(".knob")) return;
  S.focus = Number(cell.dataset.kr); save(); rulesPanel(); results();
});
let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(results, 150); });
rulesPanel(); results();
</script>
"""


ASSETS = {
    "gold": {
        "symbol": "GC=F", "slug": "gcf", "title": "Золото", "page": "Конструктор стратегии", "bpy": 252, "skip": 260,
        "pair": ("SI=F", "Золото/серебро"), "macro": True,
        "rules": [
            {"id": 4, "on": True, "a": {"ind": "rsi", "op": ">", "v": 75}, "b": None, "act": 0},
            {"id": 1, "on": True, "a": {"ind": "dd", "op": ">", "v": 15}, "b": None, "act": 3},
            {"id": 2, "on": True, "a": {"ind": "sma200", "op": "<", "v": 1.0}, "b": None, "act": 2},
            {"id": 3, "on": True, "a": {"ind": "sma200", "op": ">", "v": 1.15}, "b": None, "act": 0},
        ],
    },
    "sol": {
        "symbol": "SOL-USD", "slug": "sol", "title": "Solana", "page": "Конструктор стратегии SOL", "bpy": 365, "skip": 205,
        "pair": ("BTC-USD", "SOL/BTC"), "crypto": True,
        "rules": [
            {"id": 1, "on": True, "a": {"ind": "rsi", "op": ">", "v": 75}, "b": None, "act": 0},
            {"id": 2, "on": True, "a": {"ind": "sma200", "op": ">", "v": 1.6}, "b": None, "act": 0},
            {"id": 3, "on": True, "a": {"ind": "dd", "op": ">", "v": 50}, "b": None, "act": 3},
            {"id": 4, "on": True, "a": {"ind": "sma200", "op": "<", "v": 1.0}, "b": None, "act": 2},
        ],
    },
}


def main(out, asset="gold"):
    cfg = ASSETS[asset]
    symbol, title = cfg["symbol"], cfg["title"]
    data.history(symbol)
    df = data.ohlc(symbol)
    df = df[df.index >= FROM]
    idx = df.index
    epoch = idx[0].__class__("1970-01-01")
    raw = {"t": [int(x) for x in (idx - epoch).days], "bpy": cfg["bpy"], "skip": cfg["skip"], "rules": cfg["rules"]}
    for k in ("o", "h", "l", "c"):
        raw[k] = r6(df[k].values)
    if cfg.get("macro"):
        raw["vix"] = r6(data.history("^VIX")[0].reindex(idx, method="ffill").values)
        raw["dxy"] = r6(data.history("DX-Y.NYB")[0].reindex(idx, method="ffill").values)
    if cfg.get("crypto"):
        raw["fng"] = r6(data.fear_greed().reindex(idx, method="ffill").values)
        raw["usdt"] = r6(data.usdt_dominance().reindex(idx, method="ffill").values)
    if cfg.get("pair"):
        raw["pair"] = r6(data.history(cfg["pair"][0])[0].reindex(idx, method="ffill").values)
        raw["pairName"] = cfg["pair"][1]
    js = open(os.path.join(HERE, "web", "explorer.js"), encoding="utf-8").read()
    html = (PAGE.replace("__EXPLORER__", js).replace("__DATA__", json.dumps(raw, ensure_ascii=False, separators=(",", ":")))
            .replace("__TITLE__", title).replace("__SLUG__", cfg["slug"]).replace("__PAGETITLE__", cfg["page"]))
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"{title}: {len(idx)} дней с {idx[0].date()}, {os.path.getsize(out) // 1024} КБ")


if __name__ == "__main__":
    main(*sys.argv[1:])
