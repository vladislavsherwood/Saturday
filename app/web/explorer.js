/* Бэктест на экране: симуляция стратегии по истории решений, список стратегий с доходностью, график.
   Данные h: { t: дни от 1970, c: цены закрытия, strategies: [{code, name, about, acts}] }.
   Решение дня i исполняется по цене дня i+1. Единица = unit долларов. */
(function () {
  const CODES = "cba0123";
  const PERIODS = [["1y", "1 год", 1], ["3y", "3 года", 3], ["5y", "5 лет", 5], ["all", "Всё", 0]];

  const css = `
  .ex { --viz-buy: #1baf7a; --viz-sell: #eb6834; --viz-strat: #2a78d6; --viz-ref: #8b9098; --good: #0c8a4a; --badc: #d1483f; }
  :root[data-theme="dark"] .ex { --viz-buy: #199e70; --viz-sell: #d95926; --viz-strat: #3987e5; --viz-ref: #7d858e; --good: #3ecf8e; --badc: #ff7a70; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .ex { --viz-buy: #199e70; --viz-sell: #d95926; --viz-strat: #3987e5; --viz-ref: #7d858e; --good: #3ecf8e; --badc: #ff7a70; } }
  .ex-seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; background: var(--bg); border-radius: 12px; padding: 3px; margin: 18px 0 10px; }
  .ex-seg button { padding: 8px 0; border-radius: 9px; font-weight: 700; font-size: 14px; color: var(--mute); }
  .ex-seg button.on { background: var(--surface); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  .ex-seg button:disabled { opacity: .3; }
  .ex-row { display: grid; grid-template-columns: 18px 1fr auto; align-items: center; gap: 10px; padding: 13px 2px; border-bottom: 1px solid var(--line); cursor: pointer; }
  .ex-row:last-child { border-bottom: 0; }
  .ex-row:active { opacity: .55; }
  .ex-dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--faint); }
  .ex-row.on .ex-dot { border: 6px solid var(--text); }
  .ex-name { font-weight: 750; font-size: 17px; }
  .ex-delta { font-size: 13px; font-weight: 700; margin-top: 1px; color: var(--mute); }
  .ex-delta.up { color: var(--good); } .ex-delta.down { color: var(--badc); }
  .ex-ret { text-align: right; font-weight: 800; font-size: 19px; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .ex-ret small { display: block; font-size: 13px; font-weight: 650; color: var(--mute); letter-spacing: 0; margin-top: 1px; }
  .ex-back { display: inline-flex; align-items: center; gap: 4px; color: var(--mute); font-weight: 700; font-size: 15px; padding: 4px 8px 4px 0; }
  .ex-h { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin-top: 10px; }
  .ex-about { color: var(--mute); font-weight: 600; font-size: 14px; margin-top: 3px; }
  .ex-hero { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin: 16px 0 2px; }
  .ex-hero b { font-size: 46px; font-weight: 800; letter-spacing: -0.035em; line-height: 1; font-variant-numeric: tabular-nums; }
  .ex-hero span { color: var(--mute); font-weight: 700; }
  .ex-cap { font-size: 12px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; color: var(--mute); margin: 18px 0 6px; display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .ex-cap i { font-style: normal; letter-spacing: 0; text-transform: none; display: inline-flex; align-items: center; gap: 5px; margin-left: 10px; }
  .ex-cap i::before { content: ""; width: 10px; height: 10px; border-radius: 3px; background: var(--k); }
  .ex-cap i.ln::before { height: 3px; border-radius: 2px; width: 14px; }
  .ex-cap i.dash::before { height: 0; width: 14px; background: none; border-top: 3px dashed var(--k); border-radius: 0; }
  .ex-plot { position: relative; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
  .ex-plot svg { display: block; width: 100%; overflow: visible; }
  .ex-plot text { font: 600 11px ui-rounded, -apple-system, "Segoe UI", Roboto, sans-serif; fill: var(--mute); font-variant-numeric: tabular-nums; }
  .ex-tip { position: absolute; top: 0; pointer-events: none; background: var(--text); color: var(--surface); border-radius: 12px; padding: 9px 11px; font-size: 12.5px; font-weight: 650;
            line-height: 1.5; white-space: nowrap; display: none; z-index: 3; font-variant-numeric: tabular-nums; box-shadow: 0 6px 18px rgba(0,0,0,.25); }
  .ex-tip b { display: block; font-weight: 800; }
  .ex-tip i { font-style: normal; display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 6px; }
  .ex-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line); border-radius: 16px; overflow: hidden; margin-top: 20px; }
  .ex-grid div { background: var(--bg); padding: 12px 14px; }
  .ex-grid span { display: block; color: var(--mute); font-size: 12.5px; font-weight: 650; }
  .ex-grid b { font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .ex-years { margin-top: 18px; }
  .ex-years summary { font-weight: 750; color: var(--mute); cursor: pointer; padding: 6px 0; list-style-position: inside; }
  .ex-years .scroll { overflow-x: auto; }
  .ex-years table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; font-size: 14px; margin-top: 4px; }
  .ex-years th { text-align: right; color: var(--mute); font-size: 12px; font-weight: 700; padding: 6px 4px; }
  .ex-years td { text-align: right; padding: 8px 4px; border-top: 1px solid var(--line); font-weight: 650; white-space: nowrap; }
  .ex-years th:first-child, .ex-years td:first-child { text-align: left; }
  .ex-use { width: 100%; margin-top: 20px; padding: 16px; border-radius: 16px; background: var(--text); color: var(--surface); font-weight: 800; font-size: 17px; }
  .ex-use:disabled { background: var(--bg); color: var(--mute); }
  .ex-note { color: var(--mute); font-size: 12.5px; font-weight: 600; margin-top: 14px; line-height: 1.4; }
  `;
  let styled = false;
  function style() { if (styled) return; styled = true; const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function money(x, sign) {
    const a = Math.abs(x), s = x < 0 ? "−" : sign ? "+" : "";
    if (a >= 1e6) return s + "$" + (a / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: a >= 1e7 ? 1 : 2 }) + " млн";
    if (a >= 1e4) return s + "$" + (a / 1e3).toLocaleString("ru-RU", { maximumFractionDigits: a >= 1e5 ? 0 : 1 }) + " тыс";
    return s + "$" + a.toLocaleString("ru-RU", { maximumFractionDigits: a >= 100 ? 0 : 2 });
  }
  function pct(x, sign) {
    if (x == null || !isFinite(x)) return "—";
    const a = Math.abs(x);
    return (x < 0 ? "−" : sign ? "+" : "") + a.toLocaleString("ru-RU", { maximumFractionDigits: a >= 100 ? 0 : 1 }) + "%";
  }
  const price = (p) => p.toLocaleString("ru-RU", { maximumSignificantDigits: p >= 1000 ? 5 : 4 });
  const dateOf = (day) => new Date(day * 86400000);
  const fmtDate = (day) => dateOf(day).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  function xirr(ts, vs) {
    let pos = false, neg = false;
    for (const v of vs) { if (v > 0) pos = true; if (v < 0) neg = true; }
    if (!pos || !neg) return null;
    const f = (x) => { let s = 0; for (let i = 0; i < vs.length; i++) s += vs[i] * Math.exp(-x * ts[i]); return s; };
    let lo = -8, hi = 8, flo = f(lo);
    if (flo * f(hi) > 0) return null;
    for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2, fm = f(m); if ((flo > 0) === (fm > 0)) { lo = m; flo = fm; } else hi = m; }
    return Math.expm1((lo + hi) / 2) * 100;
  }

  function startIndex(h, years) {
    const n = h.t.length;
    if (!years) return 0;
    const from = h.t[n - 1] - Math.round(years * 365.25);
    let i = 0;
    while (i < n - 1 && h.t[i] < from) i++;
    return i;
  }
  function hasPeriod(h, years) { return !years || h.t[h.t.length - 1] - h.t[0] >= years * 365.25 - 20; }

  function simulate(h, st, i0, unit) {
    const n = h.t.length, m = n - i0, c = h.c, t = h.t, acts = st.acts;
    const B = Math.min(110, m), buy = new Float64Array(B), sell = new Float64Array(B);
    const profit = new Float64Array(m), dprofit = new Float64Array(m);
    const ts = [], vs = [], dvs = [], spend = new Float64Array(m);
    let units = 0, inv = 0, rec = 0, du = 0, dinv = 0, buys = 0, sells = 0, skips = 0;
    for (let j = 0; j < m; j++) {
      const i = i0 + j, p = c[i];
      const a = i > 0 ? CODES.indexOf(acts[i - 1]) - 3 : 1;
      const b = Math.min(B - 1, Math.floor((j * B) / m));
      let cf = 0;
      if (a > 0) { const amt = a * unit; units += amt / p; inv += amt; cf = -amt; buy[b] += amt; spend[j] = amt; buys++; }
      else if (a < 0) { const amt = Math.min(-a * unit, units * p); if (amt > 0) { units -= amt / p; rec += amt; cf = amt; sell[b] += amt; sells++; } else skips++; }
      else skips++;
      du += unit / p; dinv += unit;
      const yr = (t[i] - t[i0]) / 365.25;
      ts.push(yr); vs.push(cf); dvs.push(-unit);
      profit[j] = units * p + rec - inv;
      dprofit[j] = du * p - dinv;
    }
    const last = c[n - 1], value = units * last, dvalue = du * last;
    vs[m - 1] += value; dvs[m - 1] += dvalue;
    let max30 = 0, run = 0;
    for (let j = 0; j < m; j++) { run += spend[j]; if (j >= 30) run -= spend[j - 30]; if (run > max30) max30 = run; }
    const irr = xirr(ts, vs), dirr = xirr(ts, dvs);
    return { i0, m, B, buy, sell, profit, dprofit, inv, rec, value, units, pnl: value + rec - inv, irr, buys, sells, skips, max30,
             dca: { inv: dinv, value: dvalue, pnl: dvalue - dinv, irr: dirr }, edge: irr != null && dirr != null ? irr - dirr : null };
  }

  /* ---------- список стратегий ---------- */
  function seg(period, h) {
    return '<div class="ex-seg">' + PERIODS.map(([k, name, y]) =>
      `<button data-period="${k}" class="${k === period ? "on" : ""}" ${hasPeriod(h, y) ? "" : "disabled"}>${name}</button>`).join("") + "</div>";
  }
  function yearsOf(period) { return PERIODS.find((p) => p[0] === period)[2]; }
  function fitPeriod(h, period) { return hasPeriod(h, yearsOf(period)) ? period : "all"; }

  function list(el, h, o) {
    style();
    const period = fitPeriod(h, o.period || "all"), i0 = startIndex(h, yearsOf(period));
    const rows = h.strategies.map((st) => ({ st, s: simulate(h, st, i0, o.unit || 10) }));
    const head = rows.filter((r) => r.st.code === "dca");
    const rest = rows.filter((r) => r.st.code !== "dca").sort((a, b) => (b.s.irr ?? -1e9) - (a.s.irr ?? -1e9));
    el.innerHTML = '<div class="ex">' + seg(period, h) + head.concat(rest).map(({ st, s }) => {
      const d = s.edge, cls = st.code === "dca" || d == null || Math.abs(d) < 0.05 ? "" : d > 0 ? "up" : "down";
      const delta = st.code === "dca" ? "эталон" : d == null ? "—" : pct(d, true).replace("%", " п.п.") + " к DCA";
      return `<div class="ex-row ${st.code === o.active ? "on" : ""}" data-code="${st.code}"><div class="ex-dot"></div>
        <div><div class="ex-name">${esc(st.name)}</div><div class="ex-delta ${cls}">${delta}</div></div>
        <div class="ex-ret">${pct(s.irr, true)}<small>${money(s.pnl, true)}</small></div></div>`;
    }).join("") + "</div>";
    el.querySelectorAll("[data-period]").forEach((b) => b.addEventListener("click", () => o.onPeriod && o.onPeriod(b.dataset.period)));
    el.querySelectorAll("[data-code]").forEach((r) => r.addEventListener("click", () => o.onOpen && o.onOpen(r.dataset.code)));
  }

  /* ---------- график ---------- */
  function chart(box, h, s) {
    const W = Math.max(280, box.clientWidth || 340), R = 46, pw = W - R;
    const P = { top: 4, h: 128 }, A = { top: P.top + P.h + 34, h: 56 }, F = { top: A.top + A.h + 38, h: 112 };
    const H = F.top + F.h + 20;
    const m = s.m, i0 = s.i0, c = h.c, t = h.t;
    const X = (j) => (m > 1 ? (j / (m - 1)) * pw : pw / 2);
    const step = Math.max(1, Math.floor(m / 420));
    // цена, логарифмическая шкала
    let pmin = Infinity, pmax = -Infinity;
    for (let j = 0; j < m; j++) { const p = c[i0 + j]; if (p < pmin) pmin = p; if (p > pmax) pmax = p; }
    const lmin = Math.log(pmin), lmax = Math.log(pmax) === lmin ? lmin + 1 : Math.log(pmax);
    const YP = (p) => P.top + P.h - ((Math.log(p) - lmin) / (lmax - lmin)) * P.h;
    let dP = "";
    for (let j = 0; j < m; j += step) dP += (j ? "L" : "M") + X(j).toFixed(1) + " " + YP(c[i0 + j]).toFixed(1);
    dP += "L" + X(m - 1).toFixed(1) + " " + YP(c[i0 + m - 1]).toFixed(1);
    // покупки и продажи
    let bmax = 0, anySell = false;
    for (let b = 0; b < s.B; b++) { bmax = Math.max(bmax, s.buy[b], s.sell[b]); if (s.sell[b] > 0) anySell = true; }
    const base = anySell ? A.top + A.h / 2 : A.top + A.h, span = anySell ? A.h / 2 - 1 : A.h;
    const bw = Math.max(1, pw / s.B - (pw / s.B > 4 ? 2 : 0.6));
    let bars = "";
    for (let b = 0; b < s.B; b++) {
      const x = (b / s.B) * pw + (pw / s.B - bw) / 2, r = Math.min(2, bw / 2);
      if (s.buy[b] > 0) { const hh = Math.max(1.5, (s.buy[b] / bmax) * span); bars += `<rect x="${x.toFixed(1)}" y="${(base - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="${r}" fill="var(--viz-buy)"/>`; }
      if (s.sell[b] > 0) { const hh = Math.max(1.5, (s.sell[b] / bmax) * span); bars += `<rect x="${x.toFixed(1)}" y="${(base + 1).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="${r}" fill="var(--viz-sell)"/>`; }
    }
    // прибыль
    let fmin = 0, fmax = 0;
    for (let j = 0; j < m; j++) { fmin = Math.min(fmin, s.profit[j], s.dprofit[j]); fmax = Math.max(fmax, s.profit[j], s.dprofit[j]); }
    if (fmax === fmin) fmax = fmin + 1;
    const YF = (v) => F.top + F.h - ((v - fmin) / (fmax - fmin)) * F.h;
    const line = (arr) => { let d = ""; for (let j = 0; j < m; j += step) d += (j ? "L" : "M") + X(j).toFixed(1) + " " + YF(arr[j]).toFixed(1); return d + "L" + X(m - 1).toFixed(1) + " " + YF(arr[m - 1]).toFixed(1); };
    // годы по оси
    let ticks = "";
    const marks = [];
    for (let j = 1; j < m; j++) { const y = dateOf(t[i0 + j]).getUTCFullYear(); if (y !== dateOf(t[i0 + j - 1]).getUTCFullYear()) marks.push([j, y]); }
    const every = Math.ceil(marks.length / 6) || 1;
    marks.forEach(([j, y], k) => {
      const x = X(j).toFixed(1);
      ticks += `<line x1="${x}" x2="${x}" y1="${P.top}" y2="${F.top + F.h}" stroke="var(--line)"/>`;
      if (k % every === 0 && X(j) < pw - 22) ticks += `<text x="${(X(j) + 4).toFixed(1)}" y="${H - 5}">${y}</text>`;
    });
    const lab = (y, txt) => `<text x="${pw + 6}" y="${y}">${txt}</text>`;
    const shortMoney = (v) => money(v).replace(" тыс", "k").replace(" млн", "M");
    const sameDca = s.profit.every((v, j) => Math.abs(v - s.dprofit[j]) < 1e-6);
    box.innerHTML = `<div class="ex-cap" style="margin-top:14px"><span>Цена</span></div>
      <div class="ex-plot"><div class="ex-tip"></div>
      <svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Цена, покупки и продажи, прибыль">
        ${ticks}
        <path d="${dP}" fill="none" stroke="var(--text)" stroke-width="1.6" stroke-linejoin="round"/>
        ${lab(P.top + 10, price(pmax))}${lab(P.top + P.h, price(pmin))}
        <foreignObject x="0" y="${A.top - 30}" width="${W}" height="24"><div xmlns="http://www.w3.org/1999/xhtml" class="ex-cap" style="margin:0"><span>Покупки${anySell ? " и продажи" : ""}</span>
          <span><i style="--k:var(--viz-buy)">покупки</i>${anySell ? '<i style="--k:var(--viz-sell)">продажи</i>' : ""}</span></div></foreignObject>
        ${anySell ? `<line x1="0" x2="${pw}" y1="${base + 0.5}" y2="${base + 0.5}" stroke="var(--line)"/>` : ""}
        ${bars}
        ${lab(A.top + 10, shortMoney(bmax))}
        <foreignObject x="0" y="${F.top - 30}" width="${W}" height="24"><div xmlns="http://www.w3.org/1999/xhtml" class="ex-cap" style="margin:0"><span>Прибыль</span>
          <span><i class="ln" style="--k:var(--viz-strat)">стратегия</i>${sameDca ? "" : '<i class="dash" style="--k:var(--viz-ref)">DCA</i>'}</span></div></foreignObject>
        <line x1="0" x2="${pw}" y1="${YF(0).toFixed(1)}" y2="${YF(0).toFixed(1)}" stroke="var(--faint)"/>
        ${sameDca ? "" : `<path d="${line(s.dprofit)}" fill="none" stroke="var(--viz-ref)" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>`}
        <path d="${line(s.profit)}" fill="none" stroke="var(--viz-strat)" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="${X(m - 1).toFixed(1)}" cy="${YF(s.profit[m - 1]).toFixed(1)}" r="4" fill="var(--viz-strat)" stroke="var(--surface)" stroke-width="2"/>
        ${lab(F.top + 10, shortMoney(fmax))}${fmin < 0 ? lab(F.top + F.h, shortMoney(fmin)) : lab(YF(0) + 4, "$0")}
        <g class="cross" style="display:none"><line y1="${P.top}" y2="${F.top + F.h}" stroke="var(--mute)" stroke-width="1"/>
          <circle class="cp" r="4" fill="var(--text)" stroke="var(--surface)" stroke-width="2"/>
          <circle class="cf" r="4" fill="var(--viz-strat)" stroke="var(--surface)" stroke-width="2"/></g>
      </svg></div>`;
    const plot = box.querySelector(".ex-plot"), tip = box.querySelector(".ex-tip"), cross = box.querySelector(".cross");
    function move(ev) {
      const r = plot.getBoundingClientRect(), px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const scale = W / r.width, j = Math.max(0, Math.min(m - 1, Math.round(((px * scale) / pw) * (m - 1))));
      const b = Math.min(s.B - 1, Math.floor((j * s.B) / m)), x = X(j);
      cross.style.display = "";
      cross.querySelector("line").setAttribute("x1", x); cross.querySelector("line").setAttribute("x2", x);
      cross.querySelector(".cp").setAttribute("cx", x); cross.querySelector(".cp").setAttribute("cy", YP(c[i0 + j]));
      cross.querySelector(".cf").setAttribute("cx", x); cross.querySelector(".cf").setAttribute("cy", YF(s.profit[j]));
      const days = Math.round(m / s.B);
      tip.innerHTML = `<b>${fmtDate(t[i0 + j])}</b>Цена ${price(c[i0 + j])}<br>
        <i style="background:var(--viz-buy)"></i>Куплено за ${days} дн: ${money(s.buy[b])}<br>
        ${anySell ? `<i style="background:var(--viz-sell)"></i>Продано за ${days} дн: ${money(s.sell[b])}<br>` : ""}
        <i style="background:var(--viz-strat)"></i>Прибыль ${money(s.profit[j], true)}${sameDca ? "" : `<br><i style="background:var(--viz-ref)"></i>DCA ${money(s.dprofit[j], true)}`}`;
      tip.style.display = "block";
      const tw = tip.offsetWidth, left = x / scale + 12 + tw > r.width ? x / scale - tw - 12 : x / scale + 12;
      tip.style.left = Math.max(0, left) + "px";
    }
    const hide = () => { tip.style.display = "none"; cross.style.display = "none"; };
    plot.addEventListener("pointermove", move); plot.addEventListener("pointerdown", move);
    plot.addEventListener("pointerleave", hide); plot.addEventListener("touchmove", move, { passive: true }); plot.addEventListener("touchend", hide);
  }

  function byYear(h, st, i0, unit) {
    const n = h.t.length, out = [];
    let units = 0, inv = 0, rec = 0, du = 0, dinv = 0, row = null;
    for (let i = i0; i < n; i++) {
      const y = dateOf(h.t[i]).getUTCFullYear(), p = h.c[i];
      if (!row || row.y !== y) { row = { y, buy: 0, sell: 0, pnl: 0, dpnl: 0 }; out.push(row); }
      const a = i > 0 ? CODES.indexOf(st.acts[i - 1]) - 3 : 1;
      if (a > 0) { units += (a * unit) / p; inv += a * unit; row.buy += a * unit; }
      else if (a < 0) { const amt = Math.min(-a * unit, units * p); units -= amt / p; rec += amt; row.sell += amt; }
      du += unit / p; dinv += unit;
      row.pnl = units * p + rec - inv; row.dpnl = du * p - dinv;
    }
    return out;
  }

  /* ---------- экран одной стратегии ---------- */
  function detail(el, h, code, o) {
    style();
    const st = h.strategies.find((x) => x.code === code) || h.strategies[0];
    const period = fitPeriod(h, o.period || "all"), i0 = startIndex(h, yearsOf(period)), unit = o.unit || 10;
    const s = simulate(h, st, i0, unit);
    const d = s.edge, isDca = st.code === "dca";
    const cls = isDca || d == null || Math.abs(d) < 0.05 ? "" : d > 0 ? "up" : "down";
    const anySell = s.rec > 0;
    const yrs = byYear(h, st, i0, unit);
    const cells = [
      ["Вложено", money(s.inv)], ["Стоит сейчас", money(s.value)],
      ["Прибыль", money(s.pnl, true)], isDca ? ["Дней", s.m.toLocaleString("ru-RU")] : ["Прибыль DCA", money(s.dca.pnl, true)],
      ["Дней с покупкой", s.buys.toLocaleString("ru-RU") + " из " + s.m.toLocaleString("ru-RU")], ["Макс. трата за 30 дн", money(s.max30)],
    ];
    if (anySell) cells.push(["Получено от продаж", money(s.rec)], ["Дней с продажей", s.sells.toLocaleString("ru-RU")]);
    el.innerHTML = `<div class="ex">
      ${o.onBack ? '<button class="ex-back" data-back>‹ Стратегии</button>' : ""}
      <div class="ex-h">${esc(st.name)}</div><div class="ex-about">${esc(st.about)}</div>
      ${seg(period, h)}
      <div class="ex-hero"><b>${pct(s.irr, true)}</b><span>в год</span>
        ${isDca ? "" : `<span class="ex-delta ${cls}" style="font-size:15px">${d == null ? "" : pct(d, true).replace("%", " п.п.") + " к DCA"}</span>`}</div>
      <div data-chart></div>
      <div class="ex-grid">${cells.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div>
      <details class="ex-years"><summary>По годам</summary><div class="scroll"><table><thead><tr><th>Год</th><th>Куплено</th>${anySell ? "<th>Продано</th>" : ""}<th>Прибыль</th>${isDca ? "" : "<th>DCA</th>"}</tr></thead>
        <tbody>${yrs.map((r) => `<tr><td>${r.y}</td><td>${money(r.buy)}</td>${anySell ? `<td>${money(r.sell)}</td>` : ""}<td>${money(r.pnl, true)}</td>${isDca ? "" : `<td>${money(r.dpnl, true)}</td>`}</tr>`).join("")}</tbody></table></div></details>
      <div class="ex-note">${fmtDate(h.t[i0])} — ${fmtDate(h.t[h.t.length - 1])}. ×1 = ${money(unit)}. Прибыль на конец каждого года — накопленная с начала периода. Без комиссий и налогов.</div>
      ${o.onSelect ? `<button class="ex-use" data-use ${st.code === o.active ? "disabled" : ""}>${st.code === o.active ? "Выбрана" : "Выбрать"}</button>` : ""}
    </div>`;
    chart(el.querySelector("[data-chart]"), h, s);
    el.querySelectorAll("[data-period]").forEach((b) => b.addEventListener("click", () => o.onPeriod && o.onPeriod(b.dataset.period)));
    const back = el.querySelector("[data-back]"); if (back) back.addEventListener("click", o.onBack);
    const use = el.querySelector("[data-use]"); if (use) use.addEventListener("click", () => o.onSelect(st.code));
  }

  window.Explorer = { simulate, startIndex, list, detail, money, pct };
})();
