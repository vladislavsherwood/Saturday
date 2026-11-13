"""Собирает страницу-конструктор стратегии: правила слева, свечной график с отметками сделок справа.

Запуск: python3 app/build_builder.py <куда сохранить .html> [gold | crypto]
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
  .ver { color: var(--mute); font-size: 12px; font-weight: 650; margin-top: 2px; }
  .kmode { flex: none; align-self: center; max-width: 190px; padding: 12px 14px; border-radius: 16px; background: var(--text); color: var(--bg); font-weight: 750; font-size: 13.5px; line-height: 1.25; text-align: left; }
  .tks { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .tks:empty { display: none; }
  .tk { padding: 8px 16px; border-radius: 999px; background: var(--surface); font-weight: 800; font-size: 15px; }
  .tk.on { background: var(--text); color: var(--bg); }
  .setup { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: 12px; color: var(--mute); font-weight: 700; font-size: 14px; }
  .setup label { display: inline-flex; align-items: center; gap: 8px; }
  .setup input { width: 104px; background: var(--surface); padding: 8px 10px; color: var(--text); font-weight: 800; }
  .setup span { font-size: 13px; font-weight: 650; }
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
  .amt { display: inline-flex; align-items: center; gap: 6px; color: var(--mute); font-weight: 700; font-size: 14px; margin-top: 2px; }
  .acts .amt { flex-basis: 100%; }
  .amt input { width: 74px; padding: 7px 8px; }
  .caprow { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .btn.sm { padding: 8px 14px; border-radius: 12px; font-size: 14px; }
  .kadd { flex: none; width: 76px; align-self: stretch; min-height: 96px; border-radius: 18px; border: 2px dashed var(--faint); font-size: 26px; font-weight: 700; color: var(--mute); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; }
  .kadd span { font-size: 12px; font-weight: 750; margin-top: 4px; }
  .modal { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .modal[hidden] { display: none; }
  .sheetm { background: var(--bg); border-radius: 22px; padding: 14px 14px 16px; width: min(440px, 100%); max-height: min(86vh, 720px); overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
  .mhead { display: flex; align-items: center; justify-content: space-between; padding: 2px 4px 8px; } .mhead b { font-size: 18px; font-weight: 800; }
  .tools { display: flex; flex-wrap: wrap; gap: 8px; }
  .btn { padding: 11px 16px; border-radius: 14px; background: var(--surface); font-weight: 750; }
  .btn.dark { background: var(--text); color: var(--bg); }
  .copy { width: 100%; margin-top: 8px; background: var(--surface); border: 0; border-radius: 14px; padding: 12px; font: 600 13px/1.45 ui-monospace, Menlo, monospace; color: var(--text); resize: vertical; }
  .bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 6; background: var(--bg); padding: 8px 0; margin-top: 10px; border-bottom: 1px solid var(--line);
         display: flex; gap: 14px; align-items: baseline; flex-wrap: wrap; font-weight: 750; font-variant-numeric: tabular-nums; }
  .bar b { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
  .bar .up { color: #0c8a4a; } .bar .down { color: #d1483f; } .bar span { color: var(--mute); }
  .avg { flex-basis: 100%; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 6px; font-size: 13px; font-weight: 700; color: var(--mute); padding-bottom: 6px; margin-bottom: 2px; border-bottom: 1px solid var(--line); }
  .bar .avg b { font-size: 19px; font-weight: 800; color: var(--text); letter-spacing: -0.02em; margin-right: 2px; }
  .avg > span { margin-right: 6px; }
  .avg button { padding: 3px 9px; border-radius: 999px; background: var(--surface); font-weight: 750; font-size: 12.5px; color: var(--text); }
  .avg button.on { box-shadow: inset 0 0 0 1.5px var(--text); }
  .avg i { font-style: normal; color: var(--mute); }
  .bar .avg .up { color: #0c8a4a; } .bar .avg .down { color: #d1483f; }
  .mix { display: flex; height: 8px; border-radius: 4px; overflow: hidden; gap: 2px; margin-top: 4px; background: var(--bg); }
  .mix i { display: block; height: 100%; }
  .mixl { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; color: var(--mute); font-size: 13px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .mixl i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 5px; }
  .knobs { display: flex; flex-wrap: nowrap; gap: 8px; overflow-x: auto; padding-bottom: 6px; margin: 0 -4px; scrollbar-width: thin; }
  .kcell { flex: none; width: 98px; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 4px 8px; border-radius: 18px; background: var(--bg); border: 2px solid transparent; }
  .kcell.focus { border-color: var(--text); }
  .knob { position: relative; width: 76px; height: 76px; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; border-radius: 50%; }
  .knob:active { cursor: grabbing; }
  .knob svg { display: block; }
  .knob b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; pointer-events: none; }
  .knob b.sm { font-size: 13.5px; letter-spacing: -0.03em; }
  .klabel { font-size: 12.5px; font-weight: 700; margin-top: 6px; line-height: 1.2; }
  .kact { font-size: 12px; font-weight: 750; color: var(--mute); margin-top: 2px; }
  .kact.buy { color: #0c8a4a; } .kact.sell { color: #c2511f; }
  .presets { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
  .presets button { text-align: left; padding: 11px 14px; border-radius: 14px; background: var(--surface); font-weight: 700; }
  .ind text { font: 600 11px var(--sans); fill: var(--mute); font-variant-numeric: tabular-nums; }
  .ind svg { display: block; width: 100%; overflow: visible; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .bar .up { color: #3ecf8e; } :root:not([data-theme="light"]) .bar .down { color: #ff7a70; } }
  :root[data-theme="dark"] .bar .up, :root[data-theme="dark"] .bar .avg .up { color: #3ecf8e; } :root[data-theme="dark"] .bar .down, :root[data-theme="dark"] .bar .avg .down { color: #ff7a70; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .bar .avg .up { color: #3ecf8e; } :root:not([data-theme="light"]) .bar .avg .down { color: #ff7a70; } }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .kact.buy { color: #3ecf8e; } :root:not([data-theme="light"]) .kact.sell { color: #f08a5b; } }
  :root[data-theme="dark"] .kact.buy { color: #3ecf8e; } :root[data-theme="dark"] .kact.sell { color: #f08a5b; }
  @media (max-width: 939px) {
    body { padding-block: 12px 48px; }
    h1 { font-size: 19px; } .lead, .mixl { display: none; }
    .bar { gap: 2px 10px; font-size: 13.5px; padding: 6px 0; margin-top: 4px; } .bar b { font-size: 21px; }
    .avg { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; white-space: nowrap; } .avg button { flex: none; }
    .main { margin-top: 8px; } .card { padding: 10px 12px 18px; border-radius: 18px; }
    .kcell { width: 88px; padding: 6px 2px; } .klabel { font-size: 11.5px; } .kact { font-size: 11px; }
  }
  @media (min-width: 940px) {
    .main { grid-template-columns: 400px minmax(0, 1fr); }
    .knobs { position: sticky; top: var(--barh, 96px); z-index: 5; background: var(--surface); padding-top: 10px; margin-top: -10px; box-shadow: 0 8px 10px -10px rgba(0,0,0,.25); }
    .left { order: -1; position: sticky; top: calc(var(--barh, 96px) + 8px); max-height: calc(100vh - var(--barh, 96px) - 20px); overflow: auto; padding-right: 4px; }
  }
</style>
<div class="wrap">
  <h1>Конструктор стратегии <span id="asset"></span></h1>
  <div class="ver">версия __STAMP__<span id="src"></span></div>
  <div class="tks" id="tks"></div>
  <div class="setup" id="setup"></div>
  <p class="lead">__LEAD__</p>
  <div class="bar" id="bar"></div>

  <div class="modal" id="modal" hidden></div>
  <div class="main">
    <div class="card"><div class="knobs" id="knobs"></div><div id="result"></div></div>
    <div class="left rules" id="left"></div>
  </div>
</div>
<script>__EXPLORER__</script>
<script>
const SETS = __DATA__;
let RAW, KEY, C, IND, SKIP, H, N, DEFAULT, S;

/* ---------- индикаторы (считаются по закрытию дня) ---------- */
function sma(a, n) { const o = new Array(a.length).fill(NaN), w = []; let s = 0; for (let i = 0; i < a.length; i++) { const v = a[i]; if (v == null || isNaN(v)) continue; w.push(v); s += v; if (w.length > n) s -= w.shift(); if (w.length >= Math.min(n, 20)) o[i] = s / w.length; } return o; }
function ratio(a, n) { const m = sma(a, n); return a.map((v, i) => v / m[i]); }
function rsi(a, n) { const o = new Array(a.length).fill(NaN); let up = 0, dn = 0; for (let i = 1; i < a.length; i++) { const d = a[i] - a[i - 1]; up = (up * (n - 1) + Math.max(d, 0)) / n; dn = (dn * (n - 1) + Math.max(-d, 0)) / n; if (i >= n) o[i] = dn === 0 ? 100 : 100 - 100 / (1 + up / dn); } return o; }
function drawdown(a, n) { return a.map((v, i) => { let m = -Infinity; for (let j = Math.max(0, i - n + 1); j <= i; j++) if (a[j] > m) m = a[j]; return i < 5 ? NaN : (1 - v / m) * 100; }); }
function change(a, n) { return a.map((v, i) => (i >= n ? (v / a[i - n] - 1) * 100 : i >= 7 ? (v / a[0] - 1) * 100 : NaN)); }
function boll(a, n) { const m = sma(a, n); return a.map((v, i) => { if (isNaN(m[i])) return NaN; let s = 0; for (let j = i - n + 1; j <= i; j++) s += (a[j] - m[i]) ** 2; const sd = Math.sqrt(s / n); return sd ? (v - m[i]) / sd : 0; }); }
// расстояние до исторического максимума, %: 0 — сегодняшнее закрытие само стало новым максимумом
function athDist(a, seed) { let m = seed || 0; return a.map((v) => { if (v > m) m = v; return (1 - v / m) * 100; }); }
function fill(a) { let last = NaN; return a.map((v) => (v == null ? last : (last = v))); }
const CTX = {};
function setup(key, quiet) {
  KEY = "dca-builder-" + SETS.key + "-v2";
  if (CTX[key]) { ({ RAW, C, IND, SKIP, H, N } = CTX[key]); if (!quiet) { document.getElementById("asset").textContent = "· " + RAW.title; document.getElementById("src").textContent = " · цены: " + RAW.src + ", по " + RAW.last; } return; }
  RAW = SETS.sets[key];
  C = RAW.c;
  IND = {
    sma200: { need: 200, short: "Цена / SMA200", name: "Цена к средней за 200 дней", min: 0.75, max: 1.35, step: 0.01, def: 1.0, v: ratio(C, 200) },
    sma50: { need: 50, short: "Цена / SMA50", name: "Цена к средней за 50 дней", min: 0.85, max: 1.2, step: 0.01, def: 1.0, v: ratio(C, 50) },
    dd: { short: "Просадка, %", name: "Просадка от годового максимума, %", min: 0, max: 45, step: 1, def: 15, v: drawdown(C, RAW.bpy) },
    ath: { short: "До ATH, %", name: "ATH — до исторического максимума, %", min: 0, max: 30, step: 0.5, def: 1, v: athDist(C, RAW.ath0) },
    rsi: { short: "RSI", name: "RSI за 14 дней", min: 10, max: 90, step: 1, def: 30, v: rsi(C, 14) },
    ret30: { need: RAW.bpy === 365 ? 30 : 21, short: "За месяц, %", name: "Изменение за месяц, %", min: -20, max: 20, step: 1, def: -5, v: change(C, RAW.bpy === 365 ? 30 : 21) },
    ret90: { need: RAW.bpy === 365 ? 90 : 63, short: "За квартал, %", name: "Изменение за квартал, %", min: -30, max: 40, step: 1, def: -10, v: change(C, RAW.bpy === 365 ? 90 : 63) },
    ret1: { short: "За день, %", name: "Изменение за день, %", min: -10, max: 10, step: 0.5, def: 0, v: change(C, 1) },
    bbz: { short: "Отклонение, σ", name: "Отклонение от средней за 20 дней, σ", min: -3, max: 3, step: 0.1, def: -2, v: boll(C, 20) },
  };
  if (RAW.vix) IND.vix = { short: "VIX", name: "VIX — страх на рынке акций", min: 10, max: 60, step: 1, def: 30, v: fill(RAW.vix) };
  if (RAW.dxy) IND.dxy = { short: "Доллар / SMA200", name: "Доллар (DXY) к средней за 200 дней", min: 0.9, max: 1.12, step: 0.005, def: 1.0, v: ratio(fill(RAW.dxy), 200) };
  if (RAW.v) IND.vol = { short: "Объём / средний", name: "Объём к среднему за 20 дней", min: 0.2, max: 6, step: 0.1, def: 2, v: ratio(RAW.v.map((x) => (x > 0 ? x : NaN)), 20) };
  if (RAW.fng) IND.fng = { short: "Страх и жадность", name: "Индекс страха и жадности", min: 5, max: 95, step: 1, def: 25, v: fill(RAW.fng) };
  if (RAW.usdt) IND.usdt = { short: "USDT.D / SMA200", name: "USDT.D к средней за 200 дней", min: 0.6, max: 1.6, step: 0.01, def: 1.2, v: RAW.usdt_r ? fill(RAW.usdt_r) : ratio(fill(RAW.usdt), 200) };
  if (RAW.dom) {
    IND.usdtd = { short: "USDT.D, %", name: "USDT.D — доля USDT на рынке, %", min: 3, max: 8, step: 0.1, def: 6.5, v: fill(RAW.dom.usdt) };
    IND.btcd = { short: "BTC.D, %", name: "BTC.D — доля биткоина, %", min: 40, max: 65, step: 0.5, def: 58, v: fill(RAW.dom.btc) };
    IND.ethd = { short: "ETH.D, %", name: "ETH.D — доля эфира, %", min: 8, max: 20, step: 0.5, def: 12, v: fill(RAW.dom.eth) };
    IND.othd = { short: "Альты, %", name: "Доля альткоинов (без BTC, ETH, USDT), %", min: 20, max: 45, step: 0.5, def: 28, v: fill(RAW.dom.oth) };
  }
  if (RAW.pair) IND.pair = { need: 200, short: RAW.pairName, name: RAW.pairName + " к средней за 200 дней", min: 0.75, max: 1.35, step: 0.01, def: 1.0, v: ratio(C.map((v, i) => v / fill(RAW.pair)[i]), 200) };

  for (const key of ["sma200", "sma50", "dd", "ath", "ret1", "ret30", "ret90", "dxy", "usdt", "pair", "usdtd", "btcd", "ethd", "othd"]) {
    const d = IND[key]; if (!d) continue;
    const vals = d.v.filter((x) => x != null && !isNaN(x)).sort((x, y) => x - y); if (vals.length < 50) continue;
    const q = (f) => vals[Math.min(vals.length - 1, Math.floor(f * vals.length))];
    const big = d.step >= 1 ? 5 : d.step >= 0.1 ? 1 : 0.05;
    const lo = Math.floor(q(0.003) / big) * big, hi = Math.ceil(q(0.997) / big) * big;
    d.min = key === "dd" || key === "ath" ? 0 : +Math.min(d.min, lo).toFixed(3); d.max = +Math.max(d.max, hi).toFixed(3);
    if (d.max - d.min > 250 * d.step) d.step = d.step >= 1 ? 5 : d.step >= 0.1 ? 0.5 : 0.05;
  }
  SKIP = RAW.skip;                             // разогрев индикаторов не входит в расчёт
  H = { t: RAW.t.slice(SKIP), c: RAW.c.slice(SKIP), o: RAW.o.slice(SKIP), h: RAW.h.slice(SKIP), l: RAW.l.slice(SKIP) };
  Object.values(IND).forEach((d) => (d.v = d.v.slice(SKIP)));
  N = H.t.length;

  /* ---------- состояние ---------- */
  if (!S) {
    DEFAULT = SETS.init ? JSON.parse(JSON.stringify(SETS.init)) : { mode: "pct", base: 1, pbase: 1, period: "all", unit: 10, balance: 10000, focus: SETS.rules[0].id, rules: SETS.rules };
    S = JSON.parse(JSON.stringify(DEFAULT));
    try { const saved = JSON.parse(localStorage.getItem(KEY)); if (saved && Array.isArray(saved.rules)) S = saved; } catch (e) {}
    if (!S.mode) S.mode = "pct";
    if (S.balance == null) S.balance = 10000;
  }
  CTX[key] = { RAW, C, IND, SKIP, H, N };
  if (!quiet) { document.getElementById("asset").textContent = "· " + RAW.title; document.getElementById("src").textContent = " · цены: " + RAW.src + ", по " + RAW.last; }
}
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
  if (a < 0) return "продать " + String(+(-a * 100).toFixed(1)).replace(".", ",") + "% позиции";
  if (a === 1) return "купить на взнос";
  return a >= 2 ? "взнос и весь резерв" : "взнос и " + Math.round((a - 1) * 100) + "% резерва";
}
const hit = (c, i) => { const v = IND[c.ind].v[i]; return !(v == null || isNaN(v)) && (c.op === "<" ? v < c.v : v > c.v); };
const fmtV = (c) => String(+c.v.toFixed(3)).replace(".", ",");

function decide() {
  const acts = new Array(N), who = new Int16Array(N);
  const rules = S.rules.filter((r) => r.on && IND[r.a.ind] && (!r.b || IND[r.b.ind]) && (!r.c || IND[r.c.ind]));
  for (let i = 0; i < N; i++) {
    let a = baseAct(), w = 0;
    for (const r of rules) if (hit(r.a, i) && (!r.b || hit(r.b, i)) && (!r.c || hit(r.c, i))) { a = actOf(r); w = r.id; break; }
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
  let path = "", early = "", shade = "", pen = false, pen2 = false, lastEarly = -1;
  const warm = (d.need || 0) - SKIP;                 // с этого дня графика окно индикатора полное
  pts.forEach(([v, any], q) => {
    const x = (q + 0.5) * g.cw, dayIdx = g.i0 + Math.min(g.b, g.a + (q + 1) * g.k) - 1;
    if (any) shade += `<rect x="${(q * g.cw).toFixed(1)}" y="${top}" width="${(g.cw + 0.3).toFixed(1)}" height="${ph}" fill="var(--hit)"/>`;
    if (isNaN(v)) { pen = false; pen2 = false; return; }
    if (dayIdx < warm) { early += (pen2 ? "L" : "M") + x.toFixed(1) + " " + Y(v).toFixed(1); pen2 = true; lastEarly = q; }
    if (dayIdx >= warm || q === lastEarly) { path += (pen && dayIdx >= warm ? "L" : "M") + x.toFixed(1) + " " + Y(v).toFixed(1); pen = true; }
  });
  const earlyX = lastEarly >= 0 ? (lastEarly + 0.5) * g.cw : 0;
  const num = (v) => String(+v.toFixed(2)).replace(".", ",");
  return `<div class="ex-cap" style="margin-top:14px"><span>${d.name} ${c.op} ${fmtV(c)}</span><span><i style="--k:var(--hit)">условие выполняется</i></span></div>
    <div class="ind"><svg viewBox="0 0 ${W} ${hgt}" height="${hgt}" role="img" aria-label="${d.name}">
    ${shade}${early ? `<path d="${early}" fill="none" stroke="var(--mute)" stroke-width="1.5" stroke-dasharray="3 3" stroke-linejoin="round"/>
      <line x1="${earlyX.toFixed(1)}" x2="${earlyX.toFixed(1)}" y1="${top}" y2="${top + ph}" stroke="var(--mute)" stroke-width="1" stroke-dasharray="2 3"/>
      <text x="${Math.max(2, earlyX - 4).toFixed(1)}" y="${top - 6}" text-anchor="${earlyX > 150 ? "end" : "start"}">окно ${d.need} дн ещё не набрано</text>` : ""}
    <path d="${path}" fill="none" stroke="var(--text)" stroke-width="1.5" stroke-linejoin="round"/>
    <line x1="0" x2="${pw}" y1="${Y(c.v).toFixed(1)}" y2="${Y(c.v).toFixed(1)}" stroke="var(--viz-sell)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text x="${pw + 6}" y="${Y(c.v) + 4}" style="fill:var(--text)">${fmtV(c)}</text>
    ${Math.abs(Y(hi) - Y(c.v)) > 13 ? `<text x="${pw + 6}" y="${Y(hi) + 8}">${num(hi)}</text>` : ""}
    ${Math.abs(Y(lo) - Y(c.v)) > 13 ? `<text x="${pw + 6}" y="${Y(lo)}">${num(lo)}</text>` : ""}</svg></div>`;
}

/* ---------- баланс счёта под свечами: какая доля капитала в активе, остальное — резерв ---------- */
function balPanel(g, s) {
  const W = g.W, pw = g.pw, hgt = 96, top = 8, ph = hgt - top - 8, Y = (v) => top + (1 - v / 100) * ph;
  let line = "", last = 0;
  for (let q = 0; q < g.n; q++) {
    const jb = Math.min(g.b, g.a + (q + 1) * g.k), v = s.share[jb - 1], x = (q + 0.5) * g.cw;
    if (q === 0) line += `M0 ${Y(v).toFixed(1)}`;
    line += `L${x.toFixed(1)} ${Y(v).toFixed(1)}`; last = v;
  }
  line += `L${pw} ${Y(last).toFixed(1)}`;
  const cur = Math.round(last), yc = Y(last);
  return `<div class="ex-cap" style="margin-top:14px"><span>Баланс счёта</span><span><i style="--k:var(--viz-buy)">в активе</i><i style="--k:var(--faint)">в резерве</i></span></div>
    <div class="ind"><svg viewBox="0 0 ${W} ${hgt}" height="${hgt}" role="img" aria-label="Доля капитала в активе, от 0 до 100 процентов">
    <rect x="0" y="${Y(100)}" width="${pw}" height="${ph}" fill="var(--faint)" opacity=".45"/>
    <path d="${line}L${pw} ${Y(0)}L0 ${Y(0)}Z" fill="var(--viz-buy)" opacity=".55"/>
    <path d="${line}" fill="none" stroke="var(--viz-buy)" stroke-width="1.5" stroke-linejoin="round"/>
    <line x1="0" x2="${pw}" y1="${Y(50)}" y2="${Y(50)}" stroke="var(--surface)" stroke-width="1" stroke-dasharray="3 4" opacity=".8"/>
    ${yc - Y(100) > 13 ? `<text x="${pw + 6}" y="${Y(100) + 9}">100%</text>` : ""}
    ${Y(0) - yc > 13 ? `<text x="${pw + 6}" y="${Y(0)}">0%</text>` : ""}
    <text x="${pw + 6}" y="${Math.max(Y(100) + 9, Math.min(Y(0), yc + 4))}" style="fill:var(--text)">${cur}%</text></svg></div>`;
}

// какой расчёт идёт: доли портфеля, веса с начальным балансом или веса без ограничения денег
function runSim(h, st, i0) {
  if (PCT()) return Explorer.simulateReserve(h, st, i0, S.unit);
  return S.balance > 0 ? Explorer.simulateBalance(h, st, i0, S.unit, S.balance) : Explorer.simulate(h, st, i0, S.unit);
}
function setupRow() {
  const el = document.getElementById("setup");
  el.innerHTML = PCT()
    ? `<label>Взнос в день, $ <input id="unit1" type="number" min="1" step="1" value="${S.unit}" inputmode="decimal"></label>`
    : `<label>Начальный баланс, $ <input id="bal" type="number" min="0" step="100" value="${S.balance}" inputmode="decimal"></label>
       <label>Размер ×1, $ <input id="unit1" type="number" min="1" step="1" value="${S.unit}" inputmode="decimal"></label>
       <span>${S.balance > 0 ? "баланса хватает на " + Math.floor(S.balance / S.unit).toLocaleString("ru-RU") + " покупок ×1" : "0 — деньги не ограничены"}</span>`;
}
document.getElementById("setup").addEventListener("change", (e) => {
  const v = Number(e.target.value);
  if (e.target.id === "unit1" && v > 0) S.unit = v;
  else if (e.target.id === "bal" && v >= 0) S.balance = v;
  else return;
  snapshot(); BASE = null; save(); setupRow(); results();
});

/* ---------- результат ---------- */
let LAST = null, BASE = null;
// снимок перед каждой правкой: с ним сравнивается график, пока вы меняете правило
function snapshot() { if (LAST) BASE = LAST; }
function results() {
  const { acts, who } = decide();
  const codes = Explorer.CODES;
  const mine = PCT() ? { plan: acts } : { acts: acts.map((a) => codes[a + 3]).join("") };
  const h = { ...H, strategies: [{ code: "mine", name: "Моя стратегия", about: summary(), ...mine }] };
  const focus = S.rules.find((r) => r.id === S.focus && r.on);
  const years0 = { "1y": 1, "3y": 3, "5y": 5, all: 0 }[S.period] || 0, start0 = Explorer.startIndex(h, years0);
  const base = BASE && BASE.i0 === start0 && BASE.m === N - start0 ? BASE : null;
  Explorer.detail(document.getElementById("result"), h, "mine", { period: S.period, unit: S.unit, balance: PCT() ? 0 : S.balance, win: WIN, bare: true, base,
    onPeriod: (p) => { S.period = p; WIN = null; save(); results(); },
    onDraw: (el, g, sim) => {
      WIN = { a: g.a, b: g.b };
      el.innerHTML = balPanel(g, sim) + (focus ? [focus.a, focus.b, focus.c].filter(Boolean).map((c) => indPanel(c, g)).join("") : "");
    } });
  const years = { "1y": 1, "3y": 3, "5y": 5, all: 0 }[S.period] || 0;
  const i0 = Explorer.startIndex(h, years), s = runSim(h, h.strategies[0], i0);
  LAST = s;
  let came = 0, gone = 0;
  if (base) for (let j = 0; j < s.m; j++) {
    const now = s.dbuy[j] > 0 || s.dsell[j] > 0, was = base.dbuy[j] > 0 || base.dsell[j] > 0;
    if (now && !was) came++; else if (!now && was) gone++;
  }
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
    <span>прибыль ${Explorer.money(s.pnl, true)} · DCA ${Explorer.money(s.dca.pnl, true)}${s.fixed ? " · свободно " + Explorer.money(s.cash) : s.reserve ? " · в резерве " + Explorer.money(s.cash) : " · вложено " + Explorer.money(s.inv) + " против " + Explorer.money(s.dca.inv)}</span>
    ${base && (came || gone) ? `<span>к прежнему варианту: появилось ${came} дн со сделкой, ушло ${gone}</span>` : ""}
    <div style="flex-basis:100%"><div class="mix">${order.map((a) => `<i style="width:${(mix[a] / total) * 100}%;background:${COL[a]}"></i>`).join("")}</div>
    <div class="mixl">${order.map((a) => `<span><i style="background:${COL[a]}"></i>${actName(a)} — ${Math.round((mix[a] / total) * 100)}% дней</span>`).join("")}</div></div>`;
  if (SETS.avg && SETS.avg.length > 1) {
    const cur = SETS.order.find((k) => SETS.sets[k] === RAW);
    const rows = SETS.avg.map((k) => {
      setup(k, true);
      const dd = decide(), st = PCT() ? { plan: dd.acts } : { acts: dd.acts.map((a) => codes[a + 3]).join("") };
      const hh = { ...H, strategies: [st] }, sm = runSim(hh, st, Explorer.startIndex(hh, years));
      return { k, name: RAW.ticker, v: sm.reserve ? sm.wealthEdge : sm.edge, w: sm.m };
    });
    setup(cur, true);
    const ok = rows.filter((r) => r.v != null && isFinite(r.v)), mean = ok.reduce((x, r) => x + r.v * r.w, 0) / (ok.reduce((x, r) => x + r.w, 0) || 1);
    const unitTxt = PCT() || S.balance > 0 ? "%" : " п.п.", f = (v) => (v == null || !isFinite(v) ? "—" : Explorer.pct(v, true).replace("%", unitTxt));
    const c = (v) => (v == null || Math.abs(v) < 0.05 ? "" : v > 0 ? "up" : "down");
    document.getElementById("bar").insertAdjacentHTML("afterbegin", `<div class="avg"><b class="${c(mean)}" title="Средневзвешенное: вес актива — длина его истории в расчёте">${f(mean)}</b><span>средневзв. по ${rows.length} к DCA</span>
      ${rows.map((r) => `<button class="${r.k === cur ? "on" : ""}" data-tk="${r.k}">${r.name} <i class="${c(r.v)}">${f(r.v)}</i></button>`).join("")}</div>`);
  }
  document.documentElement.style.setProperty("--barh", document.getElementById("bar").offsetHeight + "px");
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
    `${k + 1}. если ${IND[r.a.ind].name} ${r.a.op} ${fmtV(r.a)}${r.b ? ` и ${IND[r.b.ind].name} ${r.b.op} ${fmtV(r.b)}` : ""}${r.c ? ` и ${IND[r.c.ind].name} ${r.c.op} ${fmtV(r.c)}` : ""} → ${actName(actOf(r))}`);
  const s = LAST;
  return `Стратегия для ${RAW.title} (режим: ${PCT() ? "доля портфеля, взнос $" + S.unit + " в день" : "веса, ×1 = $" + S.unit + (S.balance > 0 ? ", начальный баланс $" + S.balance : "")}; период: ${S.period})\n${lines.join("\n")}\nиначе → ${actName(baseAct())}\n` +
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
// крутилки размера сделки в режиме долей: продажа — процент позиции, покупка — процент резерва сверх дневного взноса
const AMT = { min: 0.5, max: 50, step: 0.5, name: "Сколько продавать, % позиции" };
const AMT_BUY = { min: 0, max: 100, step: 5, name: "Сколько добавить из резерва, %" };
const fmtN = (v) => String(+v.toFixed(2)).replace(".", ",");
function kget(r, key) {
  if (key !== "amt") return { v: r[key].v, d: IND[r[key].ind] };
  const a = actOf(r);
  return a < 0 ? { v: +(-a * 100).toFixed(2), d: AMT } : { v: +((a - 1) * 100).toFixed(2), d: AMT_BUY };
}
function knobInner(r, key) {
  const { v, d } = kget(r, key), frac = Math.max(0, Math.min(1, (v - d.min) / (d.max - d.min)));
  const txt = key === "amt" ? fmtN(v) + "%" : fmtV(r[key]);
  return knobSvg(frac, actColor(actOf(r))) + `<b class="${txt.length > 4 ? "sm" : ""}">${txt}</b>`;
}
function knobs() {
  const el = document.getElementById("knobs");
  const on = S.rules.filter((r) => r.on);
  el.innerHTML = on.length ? on.map((r) => {
    const act = actOf(r), keys = ["a"].concat(r.b ? ["b"] : [], r.c ? ["c"] : [], PCT() && act !== 0 ? ["amt"] : []);
    return keys.map((key) => {
      const { v, d } = kget(r, key), c = r[key];
      const label = key === "amt" ? (act < 0 ? "Продать" : "Из резерва") : `${d.short} ${c.op === ">" ? "выше" : "ниже"}`;
      const sub = key === "amt" ? (act < 0 ? "% позиции" : "% сверх взноса") : key === "b" || key === "c" ? "и" : actName(act);
      return `<div class="kcell ${r.id === S.focus ? "focus" : ""}" data-kr="${r.id}">
        <div class="knob" data-knob="${r.id}:${key}" role="slider" tabindex="0" aria-label="${d.name}" aria-valuemin="${d.min}" aria-valuemax="${d.max}" aria-valuenow="${v}">${knobInner(r, key)}</div>
        <div class="klabel">${label}</div>
        <div class="kact ${act > 0 ? "buy" : act < 0 ? "sell" : ""}">${sub}</div></div>`;
    }).join("");
  }).join("") : '<div class="lead" style="margin:0">Добавьте правило — у него появится крутилка.</div>';
  el.insertAdjacentHTML("beforeend", '<button class="kadd" data-tool="add" aria-label="Добавить правило">+<span>правило</span></button>');
  if (!PCT()) el.insertAdjacentHTML("beforeend", '<button class="kmode" data-mode="pct">Сейчас размер сделки — ×1–×3. Нажмите, чтобы задавать его процентом на крутилке</button>');
}
function setKnob(el, v) {
  const [rid, key] = el.dataset.knob.split(":"), r = S.rules.find((x) => String(x.id) === rid);
  if (!r) return;
  const cur = kget(r, key), d = cur.d;
  v = Math.max(d.min, Math.min(d.max, Math.round(v / d.step) * d.step));
  v = +v.toFixed(4);
  if (v === cur.v && S.focus === r.id) return;
  S.focus = r.id;
  if (key === "amt") {
    r.pact = actOf(r) < 0 ? -v / 100 : +(1 + v / 100).toFixed(4);
    for (const pre of ["amt-", "amts-"]) { const twin = document.getElementById(pre + rid); if (twin) twin.value = v; }
    left.querySelectorAll(`[data-rule="${rid}"] .act`).forEach((x) => x.classList.toggle("on", Number(x.dataset.act) === r.pact));
    // подпись «продать N%» есть и у соседних крутилок этого правила
    document.querySelectorAll(`.kcell[data-kr="${rid}"] .kact`).forEach((x) => { if (!["и", "% позиции", "% сверх взноса"].includes(x.textContent)) x.textContent = actName(r.pact); });
  } else {
    r[key].v = v;
    for (const pre of ["n-", "s-"]) { const twin = document.getElementById(pre + rid + "-" + key); if (twin) twin.value = v; }
  }
  document.querySelectorAll(`[data-knob="${rid}:${key}"]`).forEach((x) => { x.innerHTML = knobInner(r, key); x.setAttribute("aria-valuenow", v); });
  document.querySelectorAll(".kcell").forEach((x) => x.classList.toggle("focus", x.dataset.kr === rid));
  left.querySelectorAll(".rule").forEach((x) => x.classList.toggle("focus", x.dataset.rule === rid));
  save(); results();
}
function bindKnobs(box) {
  let drag = null;
  const info = (el) => { const [rid, key] = el.dataset.knob.split(":"), r = S.rules.find((x) => String(x.id) === rid); if (!r) return null; const k = kget(r, key); return { c: { v: k.v }, d: k.d }; };
  box.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".knob"); if (!el) return;
    const k = info(el); if (!k) return;
    snapshot();
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
    if (k && dir) { snapshot(); setKnob(el, k.c.v + dir * k.d.step); e.preventDefault(); }
  });
  box.addEventListener("wheel", (e) => { const el = e.target.closest(".knob"); if (!el) return; const k = info(el); if (k) { setKnob(el, k.c.v + (e.deltaY < 0 ? 1 : -1) * k.d.step); e.preventDefault(); } }, { passive: false });
}
bindKnobs(document.getElementById("knobs"));
const PRESETS = [
  ["Не покупать, когда RSI выше…", { a: { ind: "rsi", op: ">", v: 70 }, act: 0 }, "top"],
  ["Не покупать, когда цена выше средней за 200 дней на…", { a: { ind: "sma200", op: ">", v: 1.15 }, act: 0 }, "top"],
  ["Покупать ×3 на просадке больше…", { a: { ind: "dd", op: ">", v: 15 }, act: 3 }, "end"],
  ["Покупать ×2, когда RSI ниже…", { a: { ind: "rsi", op: "<", v: 35 }, act: 2 }, "end"],
  ["Покупать ×2, когда цена ниже средней за 200 дней", { a: { ind: "sma200", op: "<", v: 1.0 }, act: 2 }, "end"],
  ["Объём: покупать ×2 при всплеске объёма на падении", { a: { ind: "vol", op: ">", v: 2 }, b: { ind: "ret1", op: "<", v: 0 }, act: 2 }, "end"],
  ["Объём: не покупать при всплеске объёма на росте", { a: { ind: "vol", op: ">", v: 2 }, b: { ind: "ret1", op: ">", v: 0 }, act: 0 }, "top"],
  ["Объём: продавать при всплеске объёма на росте", { a: { ind: "vol", op: ">", v: 2.5 }, b: { ind: "ret1", op: ">", v: 3 }, act: -1 }, "top"],
  ["ATH: продавать на историческом максимуме", { a: { ind: "ath", op: "<", v: 1 }, act: -1 }, "top"],
  ["ATH: не покупать на историческом максимуме", { a: { ind: "ath", op: "<", v: 1 }, act: 0 }, "top"],
  ["Продавать, когда RSI выше…", { a: { ind: "rsi", op: ">", v: 80 }, act: -1 }, "top"],
  ["Продавать, когда цена выше средней за 200 дней на…", { a: { ind: "sma200", op: ">", v: 1.25 }, act: -1 }, "top"],
  ["Покупать ×2, когда USDT.D выше…", { a: { ind: "usdtd", op: ">", v: 6.5 }, act: 2 }, "end"],
  ["Не покупать, когда USDT.D ниже…", { a: { ind: "usdtd", op: "<", v: 4.5 }, act: 0 }, "top"],
  ["Покупать ×2, когда BTC.D выше…", { a: { ind: "btcd", op: ">", v: 60 }, act: 2 }, "end"],
  ["Покупать ×2, когда доля альткоинов ниже…", { a: { ind: "othd", op: "<", v: 24 }, act: 2 }, "end"],
  ["Своё правило", { a: { ind: "ret30", op: "<", v: -5 }, act: 2 }, "end"],
];

function openPresets() {
  const m = document.getElementById("modal");
  m.innerHTML = `<div class="sheetm" role="dialog" aria-label="Новое правило"><div class="mhead"><b>Новое правило</b><button class="ib" data-close aria-label="Закрыть">×</button></div>
    <div class="presets">${PRESETS.map((x, n) => (IND[x[1].a.ind] ? `<button data-preset="${n}">${x[0]}</button>` : "")).join("")}</div></div>`;
  m.hidden = false;
}
function closePresets() { const m = document.getElementById("modal"); m.hidden = true; m.innerHTML = ""; }
document.getElementById("modal").addEventListener("click", (e) => {
  const b = e.target.closest("[data-preset]");
  if (!b) { if (e.target.id === "modal" || e.target.closest("[data-close]")) closePresets(); return; }
  snapshot();
  const [, tpl, where] = PRESETS[Number(b.dataset.preset)], id = Math.max(0, ...S.rules.map((x) => x.id)) + 1;
  const rule = { id, on: true, a: { ...tpl.a }, b: tpl.b ? { ...tpl.b } : null, act: tpl.act };
  if (where === "top") S.rules.unshift(rule); else S.rules.push(rule);
  S.focus = id;
  closePresets(); save(); rulesPanel(); results();
  const card = document.querySelector(`[data-rule="${id}"]`); if (card) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
});

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
  setupRow();
  const el = document.getElementById("left");
  el.innerHTML = `<div class="cap">Как считать</div>
    <div class="mode"><button class="${PCT() ? "on" : ""}" data-mode="pct">Доля портфеля</button><button class="${PCT() ? "" : "on"}" data-mode="w">Веса ×1–×3</button></div>
    <p class="hint">${PCT() ? "Каждый день в резерв приходит взнос — столько же, сколько тратит DCA. Правило решает: купить на взнос, пропустить и копить, добавить часть резерва или продать часть позиции. Разница с DCA — только от правил."
      : S.balance > 0 ? "На счёте сразу лежит начальный баланс. Покупка ×N тратит N размеров ×1, пока деньги есть; продажа возвращает деньги на счёт. DCA тратит по ×1 в день с такого же баланса. Баланс и размер ×1 задаются наверху."
      : "Правило задаёт размер покупки, деньги не ограничены. Стратегия может вложить больше, чем DCA, поэтому прибыль в долларах сравнивать нельзя."}</p>
    <div class="caprow"><div class="cap">Правила</div><button class="btn dark sm" data-tool="add">+ Правило</button></div>` + S.rules.map((r, k) => `
    <div class="rule ${r.id === S.focus ? "focus" : ""} ${r.on ? "" : "off"}" data-rule="${r.id}">
      <div class="rhead"><div class="rnum">${k + 1}</div>
        <button class="sw" role="switch" aria-checked="${r.on}" data-f="on" aria-label="Включить правило"></button>
        <span class="sp" data-count="${r.id}"></span>
        <button class="ib" data-f="up" ${k === 0 ? "disabled" : ""} aria-label="Выше">↑</button>
        <button class="ib" data-f="down" ${k === S.rules.length - 1 ? "disabled" : ""} aria-label="Ниже">↓</button>
        <button class="ib" data-f="del" aria-label="Удалить">×</button></div>
      ${condHtml(r, "a", "если")}${r.b ? condHtml(r, "b", "и") : ""}${r.c ? condHtml(r, "c", "и") : ""}
      <button class="link" data-f="${r.c ? "delc" : r.b ? "delb" : "addb"}">${r.c ? "убрать третье условие" : r.b ? "убрать второе условие" : "+ второе условие"}</button>
      ${r.b && !r.c ? '<button class="link" data-f="addc" style="margin-left:14px">+ третье условие</button>' : ""}
      <div class="acts"><span>то</span>${ACTS().map(([a, n]) => `<button class="act ${a < 0 ? "sell" : ""} ${actOf(r) === a ? "on" : ""}" data-act="${a}">${n}</button>`).join("")}
        ${PCT() && actOf(r) < 0 ? `<label class="amt">или <input type="number" data-f="amt" id="amt-${r.id}" min="0.5" max="50" step="0.5" value="${+(-actOf(r) * 100).toFixed(2)}" aria-label="Сколько продавать, процент позиции"> % позиции</label>` : ""}
        ${PCT() && actOf(r) >= 1 ? `<label class="amt">взнос и <input type="number" data-f="amt" id="amt-${r.id}" min="0" max="100" step="5" value="${+((actOf(r) - 1) * 100).toFixed(2)}" aria-label="Сколько добавить из резерва, процент"> % резерва</label>` : ""}</div>
      ${PCT() && actOf(r) !== 0 ? `<input type="range" data-f="amt" id="amts-${r.id}" min="${kget(r, "amt").d.min}" max="${kget(r, "amt").d.max}" step="${kget(r, "amt").d.step}" value="${kget(r, "amt").v}" aria-label="${actOf(r) < 0 ? AMT.name : AMT_BUY.name}">` : ""}
    </div>`).join("") + `
    <div class="rule" data-rule="base"><div class="rhead"><div class="rnum">…</div><span class="sp" data-count="0" style="text-align:left"></span></div>
      <div class="acts"><span>иначе</span>${ACTS().filter(([a]) => a >= 0 && (!PCT() || a <= 1)).map(([a, n]) => `<button class="act ${baseAct() === a ? "on" : ""}" data-base="${a}">${n}</button>`).join("")}</div></div>
    <div class="tools"><button class="btn dark" data-tool="add">+ Правило</button><button class="btn" data-tool="copy">Скопировать правила</button>
      <button class="btn" data-tool="reset">Сбросить</button>
      ${SETS.best && SETS.best[S.mode] ? '<button class="btn" data-tool="best">Загрузить найденный максимум</button>' : ""}</div><div id="presets"></div><div id="copybox"></div>`;
  knobs();
}
function ruleOf(target) { const box = target.closest("[data-rule]"); return box ? S.rules.find((r) => String(r.id) === box.dataset.rule) : null; }
const left = document.getElementById("left");
left.addEventListener("pointerdown", snapshot, true);
bindKnobs(left);
left.addEventListener("keydown", (e) => { if (e.target.matches("input")) snapshot(); }, true);
left.addEventListener("input", (e) => {
  const f = e.target.dataset.f, r = ruleOf(e.target);
  if (r && f === "amt") {
    const v = Number(e.target.value);
    if (e.target.value === "" || isNaN(v) || v < 0) return;
    if (actOf(r) < 0) { if (!(v > 0)) return; r.pact = -Math.min(50, Math.max(0.1, v)) / 100; }
    else r.pact = +(1 + Math.min(100, v) / 100).toFixed(4);
    S.focus = r.id;
    for (const pre of ["amt-", "amts-"]) { const twin = document.getElementById(pre + r.id); if (twin && twin !== e.target) twin.value = kget(r, "amt").v; }
    left.querySelectorAll(`[data-rule="${r.id}"] .act`).forEach((x) => x.classList.toggle("on", Number(x.dataset.act) === r.pact));
    knobs(); save(); results(); return;
  }
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
  if (t.dataset.tool === "add") { openPresets(); return; }
  else if (t.dataset.preset !== undefined) {
    const [, tpl, where] = PRESETS[Number(t.dataset.preset)], id = Math.max(0, ...S.rules.map((x) => x.id)) + 1;
    const rule = { id, on: true, a: { ...tpl.a }, b: null, act: tpl.act };
    if (where === "top") S.rules.unshift(rule); else S.rules.push(rule);
    S.focus = id;
  }
  else if (t.dataset.tool === "reset") { S = JSON.parse(JSON.stringify(DEFAULT)); WIN = null; }
  else if (t.dataset.tool === "best") {
    if (t.dataset.sure !== "1") { t.dataset.sure = "1"; t.textContent = "Это заменит ваши правила. Нажмите ещё раз"; return; }
    const keep = { period: S.period };
    S = { ...JSON.parse(JSON.stringify(SETS.best[S.mode])), ...keep }; WIN = null; BASE = null;
  }
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
  else if (f === "addc") { r.c = { ind: "rsi", op: "<", v: 40 }; S.focus = r.id; }
  else if (f === "delc") r.c = null;
  save(); rulesPanel(); results();
});
document.getElementById("knobs").addEventListener("click", (e) => {
  if (e.target.closest("[data-tool='add']")) { openPresets(); return; }
  if (e.target.closest("[data-mode]")) { snapshot(); S.mode = "pct"; WIN = null; save(); rulesPanel(); results(); return; }
  const cell = e.target.closest(".kcell"); if (!cell || e.target.closest(".knob")) return;
  S.focus = Number(cell.dataset.kr); save(); rulesPanel(); results();
});
function tickers() {
  const el = document.getElementById("tks");
  el.innerHTML = SETS.order.length > 1 ? SETS.order.map((k) => `<button class="tk ${SETS.sets[k] === RAW ? "on" : ""}" data-tk="${k}">${SETS.sets[k].ticker}</button>`).join("") : "";
}
function pick(e) {
  const b = e.target.closest("[data-tk]"); if (!b) return;
  setup(b.dataset.tk); LAST = null; BASE = null; WIN = null;
  try { localStorage.setItem("dca-builder-ticker", b.dataset.tk); } catch (err) {}
  tickers(); rulesPanel(); results();
}
document.getElementById("tks").addEventListener("click", pick);
document.getElementById("bar").addEventListener("click", pick);
let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(results, 150); });
let first = SETS.order[0];
try { const saved = localStorage.getItem("dca-builder-ticker"); if (saved && SETS.sets[saved]) first = saved; } catch (e) {}
setup(first); tickers(); rulesPanel(); results();
</script>
"""


CRYPTO_RULES = [
    {"id": 1, "on": True, "a": {"ind": "rsi", "op": ">", "v": 75}, "b": None, "act": 0},
    {"id": 2, "on": True, "a": {"ind": "sma200", "op": ">", "v": 1.6}, "b": None, "act": 0},
    {"id": 3, "on": True, "a": {"ind": "dd", "op": ">", "v": 50}, "b": None, "act": 3},
    {"id": 4, "on": True, "a": {"ind": "sma200", "op": "<", "v": 1.0}, "b": None, "act": 2},
]
ASSETS = {
    "gold": {
        "symbol": "GC=F", "slug": "gcf", "title": "Золото", "ticker": "Золото", "bpy": 252, "skip": 260, "novol": True,
        "pair": ("SI=F", "Золото/серебро"), "macro": True,
        "rules": [
            {"id": 4, "on": True, "a": {"ind": "rsi", "op": ">", "v": 75}, "b": None, "act": 0},
            {"id": 1, "on": True, "a": {"ind": "dd", "op": ">", "v": 15}, "b": None, "act": 3},
            {"id": 2, "on": True, "a": {"ind": "sma200", "op": "<", "v": 1.0}, "b": None, "act": 2},
            {"id": 3, "on": True, "a": {"ind": "sma200", "op": ">", "v": 1.15}, "b": None, "act": 0},
        ],
    },
    "sol": {"symbol": "SOL-USD", "slug": "sol", "title": "Solana", "ticker": "SOL", "bpy": 365, "skip": 205,
            "pair": ("BTC-USD", "SOL/BTC"), "crypto": True, "rules": CRYPTO_RULES},
    "eth": {"symbol": "ETH-USD", "slug": "eth", "title": "Ethereum", "ticker": "ETH", "bpy": 365, "skip": 205,
            "pair": ("BTC-USD", "ETH/BTC"), "crypto": True, "rules": CRYPTO_RULES},
    "btc": {"symbol": "BTC-USD", "slug": "btc", "title": "Bitcoin", "ticker": "BTC", "bpy": 365, "skip": 205, "ath0": 1151.0,
            "crypto": True, "rules": CRYPTO_RULES},
    "doge": {"symbol": "DOGE-USD", "slug": "doge", "title": "Dogecoin", "ticker": "DOGE", "bpy": 365, "skip": 205,
             "pair": ("BTC-USD", "DOGE/BTC"), "crypto": True, "rules": CRYPTO_RULES},
    "xrp": {"symbol": "XRP-USD", "slug": "xrp", "title": "XRP", "ticker": "XRP", "bpy": 365, "skip": 205,
            "pair": ("BTC-USD", "XRP/BTC"), "crypto": True, "rules": CRYPTO_RULES},
    "bnb": {"symbol": "BNB-USD", "slug": "bnb", "title": "BNB", "ticker": "BNB", "bpy": 365, "skip": 205,
            "pair": ("BTC-USD", "BNB/BTC"), "crypto": True, "rules": CRYPTO_RULES},
    # Toncoin в 2026 году переименован в Gram; на Yahoo история оборвана, берём сплошную с CoinMarketCap
    "ton": {"cmc": 11419, "slug": "ton", "title": "Toncoin (теперь Gram)", "ticker": "TON", "bpy": 365, "skip": 205,
            "pair": ("BTC-USD", "TON/BTC"), "crypto": True, "rules": CRYPTO_RULES},
    "useless": {"symbol": "USELESS36828-USD", "slug": "useless", "title": "Useless Coin", "ticker": "USELESS", "bpy": 365, "skip": 20,
                "pair": ("BTC-USD", "USELESS/BTC"), "crypto": True, "rules": CRYPTO_RULES},
    "hype": {"symbol": "HYPE32196-USD", "slug": "hype", "title": "Hyperliquid", "ticker": "HYPE", "bpy": 365, "skip": 20,
             "pair": ("BTC-USD", "HYPE/BTC"), "crypto": True, "rules": CRYPTO_RULES},
    # pump.fun торгуется с июля 2025: история идёт с первых дней, пока индикатор не накопился, его правило молчит
    "pump": {"exchange": ("PUMPUSDT", "PUMP"), "src": "Binance, до 11.09.2025 — Hyperliquid", "slug": "pump", "title": "pump.fun", "ticker": "PUMP", "bpy": 365, "skip": 20,
             "pair": ("BTC-USD", "PUMP/BTC"), "crypto": True, "rules": CRYPTO_RULES},
}
# монеты для проверки: в поиске стратегий не участвуют
for _sym, _t in (("ADA-USD", "ADA"), ("LTC-USD", "LTC"), ("LINK-USD", "LINK"), ("AVAX-USD", "AVAX"), ("TRX-USD", "TRX"),
                 ("XLM-USD", "XLM"), ("DOT-USD", "DOT"), ("BCH-USD", "BCH"),
                 ("ETC-USD", "ETC"), ("XMR-USD", "XMR"), ("ATOM-USD", "ATOM"), ("ALGO-USD", "ALGO"), ("VET-USD", "VET"),
                 ("FIL-USD", "FIL"), ("NEAR-USD", "NEAR"), ("AAVE-USD", "AAVE")):
    ASSETS[_t.lower()] = {"symbol": _sym, "slug": _t.lower(), "title": _t, "ticker": _t, "bpy": 365, "skip": 205,
                          "pair": ("BTC-USD", _t + "/BTC"), "crypto": True, "rules": CRYPTO_RULES}
# страница: (активы, заголовок вкладки)
PAGES = {"gold": (["gold"], "Конструктор стратегии"), "crypto": (["sol", "eth", "btc", "doge", "xrp", "bnb", "ton", "hype", "pump"], "Конструктор стратегии SOL")}
PAGES["valid"] = (["ada", "ltc", "link", "avax", "trx", "xlm", "dot", "bch"], "Проверочные монеты")
PAGES["exam"] = (["etc", "xmr", "atom", "algo", "vet", "fil", "near", "aave"], "Экзаменационные монеты")
PAGES["found"] = (PAGES["crypto"][0], "Найденная стратегия")
PAGES["simple"] = (PAGES["crypto"][0], "Простая стратегия")        # открывается с простой стратегией, прошедшей проверку на чужих монетах      # та же страница, но открывается с найденным максимумом
STORE = {"gold": "gcf", "crypto": "sol", "found": "found1", "valid": "valid1", "exam": "exam1", "simple": "simple1"}      # ключ, под которым правила хранятся в браузере


STAMP = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime("%d.%m %H:%M UTC")


def build_raw(asset):
    cfg = ASSETS[asset]
    if cfg.get("exchange"):
        df = data.exchange_ohlc(*cfg["exchange"])
    elif cfg.get("cmc"):
        df = data.cmc_ohlc(cfg["cmc"])
    else:
        data.history(cfg["symbol"])
        df = data.ohlc(cfg["symbol"])
    df = df[df.index >= FROM]
    idx = df.index
    epoch = idx[0].__class__("1970-01-01")
    raw = {"t": [int(x) for x in (idx - epoch).days], "bpy": cfg["bpy"], "skip": cfg["skip"], "rules": cfg["rules"],
           "title": cfg["title"], "ticker": cfg["ticker"], "slug": cfg["slug"], "ath0": cfg.get("ath0"),
           "src": cfg.get("src") or ("CoinMarketCap" if cfg.get("cmc") else "Yahoo Finance"), "last": str(idx[-1].date())}
    for k in ("o", "h", "l", "c"):
        raw[k] = r6(df[k].values)
    if not cfg.get("novol") and (df["v"] > 0).mean() > 0.95:      # объёмы есть не у всех инструментов
        raw["v"] = [float(f"{x:.4g}") for x in df["v"].values]
    if cfg.get("macro"):
        raw["vix"] = r6(data.history("^VIX")[0].reindex(idx, method="ffill").values)
        raw["dxy"] = r6(data.history("DX-Y.NYB")[0].reindex(idx, method="ffill").values)
    if cfg.get("crypto"):
        raw["fng"] = r6(data.fear_greed().reindex(idx, method="ffill").values)
        dom = data.dominances().reindex(idx, method="ffill")
        raw["usdt"] = r6(dom["usdt"].values)
        full = data.dominances()["usdt"]
        raw["usdt_r"] = r6((full / full.rolling(200, min_periods=200).mean()).reindex(idx, method="ffill").values)
        raw["dom"] = {k: [None if x != x else round(float(x), 3) for x in dom[k].values] for k in ("usdt", "btc", "eth", "oth")}
    if cfg.get("pair"):
        raw["pair"] = r6(data.history(cfg["pair"][0])[0].reindex(idx, method="ffill").values)
        raw["pairName"] = cfg["pair"][1]
    print(f"{cfg['title']}: {len(idx)} дней с {idx[0].date()}")
    return raw


def main(out, page="gold"):
    assets, title = PAGES[page]
    best_path = os.path.join(HERE, f"best_{'crypto' if page in ('found', 'simple') else page}.json")
    simple_path = os.path.join(HERE, "simple_crypto.json")
    best = json.load(open(best_path, encoding="utf-8")) if os.path.exists(best_path) else None
    if best and "rules" in best:              # старый формат: одна стратегия для режима весов
        best = {"w": best}
    sets = {"order": assets, "avg": assets if len(assets) > 1 else [], "key": STORE[page], "best": best, "init": (best["pct"] if page == "found" and best else json.load(open(simple_path, encoding="utf-8")) if page == "simple" else None), "rules": ASSETS[assets[0]]["rules"], "sets": {a: build_raw(a) for a in assets}}
    js = open(os.path.join(HERE, "web", "explorer.js"), encoding="utf-8").read()
    html = (PAGE.replace("__EXPLORER__", js).replace("__DATA__", json.dumps(sets, ensure_ascii=False, separators=(",", ":")))
            .replace("__PAGETITLE__", title).replace("__STAMP__", STAMP)
            .replace("__LEAD__", "Стратегия, которую нашёл перебор 1,2 млн вариантов на всей истории. Это подгонка под прошлое: на данных, которых поиск не видел, от результата остаётся от +23% до +55%. Правила можно менять — основная страница конструктора при этом не затрагивается." if page == "found"
                     else "Два правила, найденные с ограничением на сложность. В плюсе к DCA на всех 9 наших активах и на 16 монетах, которых поиск не видел. Сигналы общерыночные, поэтому это одна удачная схема за четыре рыночных цикла, а не 25 независимых подтверждений. Основная страница конструктора не затрагивается." if page == "simple"
                     else "Правила проверяются сверху вниз, срабатывает первое подходящее. Крутите пороги над графиком: обведённые отметки появились, пунктирные ушли."))
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"{out}: {os.path.getsize(out) // 1024} КБ")


if __name__ == "__main__":
    main(*sys.argv[1:])
