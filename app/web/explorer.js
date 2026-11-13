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
  .ex [hidden] { display: none !important; }
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
  .ex-candles { cursor: crosshair; }
  .ex-cap i.mk::before { display: none; }
  .ex-cap i.mk svg { margin-right: 1px; }
  .ex-tip svg { vertical-align: -1px; margin-right: 3px; }
  .ex-zoom { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .ex-zoom button { width: 40px; height: 36px; border-radius: 11px; background: var(--bg); font-weight: 800; font-size: 19px; line-height: 1; }
  .ex-zoom button.wide { width: auto; padding: 0 14px; font-size: 14px; font-weight: 700; }
  .ex-zoom button:disabled { opacity: .35; }
  .ex-zoom span { margin-left: auto; color: var(--mute); font-size: 12.5px; font-weight: 650; }
  .ex-plot > svg, .ex-plot > [data-svg] > svg { display: block; width: 100%; overflow: visible; }
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
    const ts = [], vs = [], dvs = [], spend = new Float64Array(m), dbuy = new Float32Array(m), dsell = new Float32Array(m);
    let units = 0, inv = 0, rec = 0, du = 0, dinv = 0, buys = 0, sells = 0, skips = 0;
    for (let j = 0; j < m; j++) {
      const i = i0 + j, p = c[i];
      const a = i > 0 ? CODES.indexOf(acts[i - 1]) - 3 : 1;
      const b = Math.min(B - 1, Math.floor((j * B) / m));
      let cf = 0;
      if (a > 0) { const amt = a * unit; units += amt / p; inv += amt; cf = -amt; buy[b] += amt; spend[j] = amt; dbuy[j] = amt; buys++; }
      else if (a < 0) { const amt = Math.min(-a * unit, units * p); if (amt > 0) { units -= amt / p; rec += amt; cf = amt; sell[b] += amt; dsell[j] = amt; sells++; } else skips++; }
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
    return { i0, m, B, buy, sell, dbuy, dsell, profit, dprofit, inv, rec, value, units, pnl: value + rec - inv, irr, buys, sells, skips, max30,
             dca: { inv: dinv, value: dvalue, pnl: dvalue - dinv, irr: dirr }, edge: irr != null && dirr != null ? irr - dirr : null };
  }

  /* Режим «доля портфеля»: каждый день в резерв приходит unit долларов — столько же, сколько тратит DCA.
     План дня: 0 — пропуск (взнос копится); 1 — обычная покупка на дневной взнос; 1 + f — взнос и доля f накопленного резерва;
     -f — продать долю f позиции в резерв. Итог = позиция + резерв. */
  function simulateReserve(h, st, i0, unit) {
    const n = h.t.length, m = n - i0, c = h.c, t = h.t, plan = st.plan;
    const B = Math.min(110, m), buy = new Float64Array(B), sell = new Float64Array(B);
    const profit = new Float64Array(m), dprofit = new Float64Array(m), dbuy = new Float32Array(m), dsell = new Float32Array(m);
    const ts = [], vs = [];
    let units = 0, cash = 0, du = 0, rec = 0, buys = 0, sells = 0, skips = 0, cashShare = 0, spent = 0;
    for (let j = 0; j < m; j++) {
      const i = i0 + j, p = c[i], a = i > 0 ? plan[i - 1] : 1, b = Math.min(B - 1, Math.floor((j * B) / m));
      const before = cash;
      cash += unit;
      if (a < 0) {
        const amt = -a * units * p;
        if (amt > 0) { units -= amt / p; cash += amt; rec += amt; sell[b] += amt; dsell[j] = amt; sells++; } else skips++;
      } else if (a > 0) {
        const amt = Math.min(cash, unit + (a - 1) * before);
        units += amt / p; cash -= amt; spent += amt; buy[b] += amt; dbuy[j] = amt; buys++;
      } else skips++;
      du += unit / p;
      const dep = unit * (j + 1), wealth = units * p + cash;
      cashShare += cash / wealth;
      ts.push((t[i] - t[i0]) / 365.25); vs.push(-unit);
      profit[j] = wealth - dep; dprofit[j] = du * p - dep;
    }
    const last = c[n - 1], inv = unit * m, value = units * last + cash, dvalue = du * last;
    const dvs = vs.slice();
    vs[m - 1] += value; dvs[m - 1] += dvalue;
    let max30 = 0, run = 0;
    for (let j = 0; j < m; j++) { run += dbuy[j]; if (j >= 30) run -= dbuy[j - 30]; if (run > max30) max30 = run; }
    const irr = xirr(ts, vs), dirr = xirr(ts, dvs);
    return { reserve: true, i0, m, B, buy, sell, dbuy, dsell, profit, dprofit, inv, rec, value, units, cash, cashShare: cashShare / m, spent,
             pnl: value - inv, irr, buys, sells, skips, max30, dca: { inv, value: dvalue, pnl: dvalue - inv, irr: dirr },
             edge: irr != null && dirr != null ? irr - dirr : null, wealthEdge: (value / dvalue - 1) * 100 };
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

  /* ---------- свечи с отметками сделок ---------- */
  const TRI_UP = '<svg width="11" height="10" viewBox="0 0 11 10"><path d="M5.5 0L11 10H0z" fill="var(--viz-buy)"/></svg>';
  const TRI_DN = '<svg width="11" height="10" viewBox="0 0 11 10"><path d="M5.5 10L11 0H0z" fill="var(--viz-sell)"/></svg>';

  function candles(box, h, s, unit, opts) {
    opts = opts || {};
    const m = s.m, i0 = s.i0, t = h.t, C = h.c, O = h.o || h.c, Hi = h.h || h.c, Lo = h.l || h.c;
    const base = opts.base && opts.base.m === m && opts.base.i0 === i0 ? opts.base : null;
    const anySell = s.rec > 0 || (base && base.rec > 0);
    const w0 = opts.win;
    const win = w0 && w0.b <= m && w0.a >= 0 && w0.b - w0.a >= 30 ? { a: w0.a, b: w0.b } : { a: 0, b: m };
    box.innerHTML = `<div class="ex-cap"><span>Цена и сделки</span><span>${base ? '<i class="mk"><svg width="11" height="10" viewBox="0 0 11 10"><path d="M5.5 1L10 9H1z" fill="none" stroke="var(--text)" stroke-width="1.6"/></svg>появилось</i><i class="mk"><svg width="11" height="10" viewBox="0 0 11 10"><path d="M5.5 1L10 9H1z" fill="none" stroke="var(--mute)" stroke-width="1.2" stroke-dasharray="2 1.5"/></svg>ушло</i>' : ""}<i class="mk">${TRI_UP}покупка</i>${anySell ? `<i class="mk">${TRI_DN}продажа</i>` : ""}</span></div>
      <div class="ex-plot ex-candles"><div class="ex-tip"></div><div data-svg></div></div>
      <div class="ex-zoom"><button data-z="out" aria-label="Отдалить">−</button><button data-z="in" aria-label="Приблизить">+</button>
        <button data-z="all" class="wide">Весь период</button><span data-range></span></div>`;
    const plot = box.querySelector(".ex-plot"), holder = box.querySelector("[data-svg]"), tip = box.querySelector(".ex-tip");
    let G = null;

    function draw() {
      const W = Math.max(280, box.clientWidth || 340), R = 52, pw = W - R, H = 340, top = 6, axis = 20, pad = 34;
      const len = win.b - win.a, k = Math.max(1, Math.ceil(len / Math.floor(pw / 4.4))), n = Math.ceil(len / k), cw = pw / n;
      const bk = [];
      let lo = Infinity, hi = -Infinity;
      for (let q = 0; q < n; q++) {
        const ja = win.a + q * k, jb = Math.min(win.b, ja + k);
        let hh = -Infinity, ll = Infinity, buy = 0, sell = 0, bd = 0, sd = 0, gb = 0, gs = 0;
        for (let j = ja; j < jb; j++) {
          const i = i0 + j;
          if (Hi[i] > hh) hh = Hi[i]; if (Lo[i] < ll) ll = Lo[i];
          if (s.dbuy[j] > 0) { buy += s.dbuy[j]; bd++; } if (s.dsell[j] > 0) { sell += s.dsell[j]; sd++; }
          if (base) { gb += base.dbuy[j]; gs += base.dsell[j]; }
        }
        bk.push({ ja, jb, o: O[i0 + ja], c: C[i0 + jb - 1], h: hh, l: ll, buy, sell, bd, sd, gb, gs });
        if (hh > hi) hi = hh; if (ll < lo) lo = ll;
      }
      const lmin = Math.log(lo), lmax = Math.log(hi) > lmin ? Math.log(hi) : lmin + 0.01;
      const ph = H - top - axis - 2 * pad;
      const Y = (p) => top + pad + (1 - (Math.log(p) - lmin) / (lmax - lmin)) * ph;
      const bw = Math.max(1, Math.min(cw * 0.68, 14));
      let ticks = "", body = "", marks = "";
      // сетка по годам или месяцам
      const byMonth = len <= 500;
      const labels = [];
      for (let j = win.a + 1; j < win.b; j++) {
        const d1 = dateOf(t[i0 + j]), d0 = dateOf(t[i0 + j - 1]);
        const changed = byMonth ? d1.getUTCMonth() !== d0.getUTCMonth() : d1.getUTCFullYear() !== d0.getUTCFullYear();
        if (changed) labels.push([j, byMonth ? d1.toLocaleDateString("ru-RU", { month: "short", timeZone: "UTC" }).replace(".", "") + (d1.getUTCMonth() === 0 ? " " + d1.getUTCFullYear() : "") : d1.getUTCFullYear()]);
      }
      const every = Math.ceil(labels.length / Math.max(2, Math.floor(pw / 62))) || 1;
      labels.forEach(([j, txt], q) => {
        const x = ((j - win.a) / len) * pw;
        if (q % every) return;
        ticks += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${top}" y2="${H - axis}" stroke="var(--line)"/>`;
        if (x < pw - 30) ticks += `<text x="${(x + 4).toFixed(1)}" y="${H - 5}">${txt}</text>`;
      });
      bk.forEach((b, q) => {
        const x = (q + 0.5) * cw, up = b.c >= b.o, col = up ? "var(--text)" : "var(--mute)";
        const y1 = Y(Math.max(b.o, b.c)), y2 = Y(Math.min(b.o, b.c)), bh = Math.max(1, y2 - y1);
        body += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${Y(b.h).toFixed(1)}" y2="${Y(b.l).toFixed(1)}" stroke="${col}" stroke-width="1"/>`;
        body += `<rect x="${(x - bw / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${bw > 4 ? 1 : 0}" fill="${up && bw >= 4 ? "var(--surface)" : col}" stroke="${col}" stroke-width="1"/>`;
        // число значков = средний размер сделки за свечу: один — ×1, три — ×3
        const days = b.jb - b.ja, r = Math.max(2.2, Math.min(4.6, cw * 0.44)), stepY = r * 1.6 + 1.5;
        const level = (sum) => Math.max(1, Math.min(3, Math.round(sum / (unit * days))));
        const tri = (y, dir, attrs) => `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l${r.toFixed(1)} ${(dir * r * 1.6).toFixed(1)}h${(-2 * r).toFixed(1)}z" ${attrs}/>`;
        const draw = (now, was, y0, dir, col) => {
          if (now > 0) {
            const fresh = base && was === 0 ? ` stroke="var(--text)" stroke-width="1.4"` : "";
            for (let q2 = 0; q2 < level(now); q2++) marks += tri(y0 + dir * q2 * stepY, dir, `fill="${col}"${fresh}`);
          } else if (base && was > 0) {
            for (let q2 = 0; q2 < level(was); q2++) marks += tri(y0 + dir * q2 * stepY, dir, 'fill="none" stroke="var(--mute)" stroke-width="1" stroke-dasharray="2 1.5"');
          }
        };
        draw(b.buy, b.gb, Y(b.l) + 4, 1, "var(--viz-buy)");
        draw(b.sell, b.gs, Y(b.h) - 4, -1, "var(--viz-sell)");
      });
      const last = bk[bk.length - 1];
      holder.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Свечной график цены с отметками покупок и продаж">
        ${ticks}${body}${marks}
        <text x="${pw + 6}" y="${Y(hi) + 4}">${price(hi)}</text><text x="${pw + 6}" y="${Y(lo) + 4}">${price(lo)}</text>
        ${Math.abs(Y(last.c) - Y(hi)) > 14 && Math.abs(Y(last.c) - Y(lo)) > 14 ? `<text x="${pw + 6}" y="${Y(last.c) + 4}" style="fill:var(--text)">${price(last.c)}</text>` : ""}
        <line class="cross" y1="${top}" y2="${H - axis}" stroke="var(--mute)" stroke-width="1" style="display:none"/></svg>`;
      box.querySelector("[data-range]").textContent = (k > 1 ? "1 свеча = " + k + " дн" : "1 свеча = 1 день");
      box.querySelector('[data-z="out"]').disabled = len >= m;
      box.querySelector('[data-z="all"]').disabled = len >= m;
      box.querySelector('[data-z="in"]').disabled = len <= 30;
      G = { W, pw, cw, bk, n, k };
      if (opts.onDraw) opts.onDraw({ a: win.a, b: win.b, k, n, cw, pw, W, R, i0 });
    }

    function show(clientX) {
      const r = plot.getBoundingClientRect(), sc = G.W / r.width;
      const q = Math.max(0, Math.min(G.n - 1, Math.floor(((clientX - r.left) * sc) / G.cw)));
      const b = G.bk[q], x = (q + 0.5) * G.cw, days = b.jb - b.ja;
      const cross = holder.querySelector(".cross");
      cross.style.display = ""; cross.setAttribute("x1", x); cross.setAttribute("x2", x);
      const d1 = fmtDate(t[i0 + b.ja]), d2 = fmtDate(t[i0 + b.jb - 1]);
      tip.innerHTML = `<b>${days > 1 ? d1 + " — " + d2 : d1}</b>Откр ${price(b.o)} · Закр ${price(b.c)}<br>Макс ${price(b.h)} · Мин ${price(b.l)}<br>
        ${b.buy > 0 ? `${TRI_UP} Куплено ${money(b.buy)}${days > 1 ? ` за ${b.bd} дн` : ` (×${Math.round(b.buy / unit)})`}` : "Покупок нет"}
        ${b.sell > 0 ? `<br>${TRI_DN} Продано ${money(b.sell)}${days > 1 ? ` за ${b.sd} дн` : ""}` : ""}`;
      tip.style.display = "block";
      const tw = tip.offsetWidth, px = x / sc, left = px + 12 + tw > r.width ? px - tw - 12 : px + 12;
      tip.style.left = Math.max(0, left) + "px";
    }
    const hide = () => { tip.style.display = "none"; const c = holder.querySelector(".cross"); if (c) c.style.display = "none"; };

    function zoom(f, center) {
      const len = win.b - win.a, nl = Math.max(30, Math.min(m, Math.round(len * f)));
      const c = center == null ? (win.b >= m ? m : (win.a + win.b) / 2) : center;
      let a = Math.round(win.b >= m && center == null ? m - nl : c - nl / 2);
      a = Math.max(0, Math.min(m - nl, a));
      win.a = a; win.b = a + nl; hide(); draw();
    }
    box.querySelector('[data-z="in"]').addEventListener("click", () => zoom(0.5));
    box.querySelector('[data-z="out"]').addEventListener("click", () => zoom(2));
    box.querySelector('[data-z="all"]').addEventListener("click", () => { win.a = 0; win.b = m; hide(); draw(); });

    let drag = null;
    plot.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, a: win.a, moved: false }; try { plot.setPointerCapture(e.pointerId); } catch (err) {} show(e.clientX); });
    plot.addEventListener("pointermove", (e) => {
      if (drag && win.b - win.a < m) {
        const r = plot.getBoundingClientRect(), dx = e.clientX - drag.x;
        if (Math.abs(dx) > 6) drag.moved = true;
        if (drag.moved) {
          const len = win.b - win.a, shift = Math.round((-dx / (r.width * (G.pw / G.W))) * len);
          const a = Math.max(0, Math.min(m - len, drag.a + shift));
          if (a !== win.a) { win.a = a; win.b = a + len; draw(); }
          hide(); return;
        }
      }
      if (e.pointerType === "mouse" || drag) show(e.clientX);
    });
    const end = (e) => { if (drag && e.pointerType !== "mouse" && drag.moved) hide(); drag = null; };
    plot.addEventListener("pointerup", end); plot.addEventListener("pointercancel", end);
    plot.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hide(); });
    plot.addEventListener("wheel", (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoom(e.deltaY > 0 ? 1.5 : 0.67); }, { passive: false });
    draw();
    return { redraw: draw };
  }

  /* ---------- прибыль против DCA ---------- */
  function profitChart(box, h, s) {
    const W = Math.max(280, box.clientWidth || 340), R = 52, pw = W - R, top = 6, ph = 120, H = top + ph + 22;
    const m = s.m, i0 = s.i0, t = h.t;
    const X = (j) => (m > 1 ? (j / (m - 1)) * pw : pw / 2), step = Math.max(1, Math.floor(m / 420));
    let fmin = 0, fmax = 0;
    for (let j = 0; j < m; j++) { fmin = Math.min(fmin, s.profit[j], s.dprofit[j]); fmax = Math.max(fmax, s.profit[j], s.dprofit[j]); }
    if (fmax === fmin) fmax = fmin + 1;
    const Y = (v) => top + ph - ((v - fmin) / (fmax - fmin)) * ph;
    const line = (arr) => { let d = ""; for (let j = 0; j < m; j += step) d += (j ? "L" : "M") + X(j).toFixed(1) + " " + Y(arr[j]).toFixed(1); return d + "L" + X(m - 1).toFixed(1) + " " + Y(arr[m - 1]).toFixed(1); };
    let ticks = "";
    const marks = [];
    for (let j = 1; j < m; j++) { const y = dateOf(t[i0 + j]).getUTCFullYear(); if (y !== dateOf(t[i0 + j - 1]).getUTCFullYear()) marks.push([j, y]); }
    const every = Math.ceil(marks.length / 6) || 1;
    marks.forEach(([j, y], q) => {
      if (q % every) return;
      ticks += `<line x1="${X(j).toFixed(1)}" x2="${X(j).toFixed(1)}" y1="${top}" y2="${top + ph}" stroke="var(--line)"/>`;
      if (X(j) < pw - 22) ticks += `<text x="${(X(j) + 4).toFixed(1)}" y="${H - 5}">${y}</text>`;
    });
    const sm = (v) => money(v).replace(" тыс", "k").replace(" млн", "M");
    const same = s.profit.every((v, j) => Math.abs(v - s.dprofit[j]) < 1e-6);
    box.innerHTML = `<div class="ex-cap"><span>Прибыль</span><span><i class="ln" style="--k:var(--viz-strat)">стратегия</i>${same ? "" : '<i class="dash" style="--k:var(--viz-ref)">DCA</i>'}</span></div>
      <div class="ex-plot"><div class="ex-tip"></div><svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Прибыль стратегии и обычного DCA">
        ${ticks}<line x1="0" x2="${pw}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="var(--faint)"/>
        ${same ? "" : `<path d="${line(s.dprofit)}" fill="none" stroke="var(--viz-ref)" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>`}
        <path d="${line(s.profit)}" fill="none" stroke="var(--viz-strat)" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="${X(m - 1).toFixed(1)}" cy="${Y(s.profit[m - 1]).toFixed(1)}" r="4" fill="var(--viz-strat)" stroke="var(--surface)" stroke-width="2"/>
        <text x="${pw + 6}" y="${top + 10}">${sm(fmax)}</text>${fmin < 0 ? `<text x="${pw + 6}" y="${top + ph}">${sm(fmin)}</text>` : `<text x="${pw + 6}" y="${Y(0) + 4}">$0</text>`}
        <g class="cross" style="display:none"><line y1="${top}" y2="${top + ph}" stroke="var(--mute)" stroke-width="1"/>
          <circle r="4" fill="var(--viz-strat)" stroke="var(--surface)" stroke-width="2"/></g></svg></div>`;
    const plot = box.querySelector(".ex-plot"), tip = box.querySelector(".ex-tip"), cross = box.querySelector(".cross");
    function move(e) {
      const r = plot.getBoundingClientRect(), sc = W / r.width;
      const j = Math.max(0, Math.min(m - 1, Math.round((((e.clientX - r.left) * sc) / pw) * (m - 1)))), x = X(j);
      cross.style.display = "";
      cross.querySelector("line").setAttribute("x1", x); cross.querySelector("line").setAttribute("x2", x);
      cross.querySelector("circle").setAttribute("cx", x); cross.querySelector("circle").setAttribute("cy", Y(s.profit[j]));
      tip.innerHTML = `<b>${fmtDate(t[i0 + j])}</b><i style="background:var(--viz-strat)"></i>Стратегия ${money(s.profit[j], true)}${same ? "" : `<br><i style="background:var(--viz-ref)"></i>DCA ${money(s.dprofit[j], true)}`}`;
      tip.style.display = "block";
      const tw = tip.offsetWidth, px = x / sc, left = px + 12 + tw > r.width ? px - tw - 12 : px + 12;
      tip.style.left = Math.max(0, left) + "px";
    }
    const hide = () => { tip.style.display = "none"; cross.style.display = "none"; };
    plot.addEventListener("pointermove", move); plot.addEventListener("pointerdown", move);
    plot.addEventListener("pointerleave", hide); plot.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") hide(); });
  }

  function byYear(h, s) {
    const out = [];
    let row = null;
    for (let j = 0; j < s.m; j++) {
      const y = dateOf(h.t[s.i0 + j]).getUTCFullYear();
      if (!row || row.y !== y) { row = { y, buy: 0, sell: 0, pnl: 0, dpnl: 0 }; out.push(row); }
      row.buy += s.dbuy[j]; row.sell += s.dsell[j]; row.pnl = s.profit[j]; row.dpnl = s.dprofit[j];
    }
    return out;
  }

  /* ---------- экран одной стратегии ---------- */
  function detail(el, h, code, o) {
    style();
    const st = h.strategies.find((x) => x.code === code) || h.strategies[0];
    const period = fitPeriod(h, o.period || "all"), i0 = startIndex(h, yearsOf(period)), unit = o.unit || 10;
    const s = st.plan ? simulateReserve(h, st, i0, unit) : simulate(h, st, i0, unit);
    const d = s.edge, isDca = st.code === "dca";
    const cls = isDca || d == null || Math.abs(d) < 0.05 ? "" : d > 0 ? "up" : "down";
    const anySell = s.rec > 0;
    const yrs = byYear(h, s);
    const cells = s.reserve ? [
      ["Внесено", money(s.inv)], ["Итог: позиция и резерв", money(s.value)],
      ["Прибыль", money(s.pnl, true)], ["Прибыль DCA", money(s.dca.pnl, true)],
      ["В резерве сейчас", money(s.cash)], ["Резерв в среднем", pct(s.cashShare * 100) + " капитала"],
      ["Дней с покупкой", s.buys.toLocaleString("ru-RU") + " из " + s.m.toLocaleString("ru-RU")], ["Макс. покупка за 30 дн", money(s.max30)],
    ] : [
      ["Вложено", money(s.inv)], ["Стоит сейчас", money(s.value)],
      ["Прибыль", money(s.pnl, true)], isDca ? ["Дней", s.m.toLocaleString("ru-RU")] : ["Прибыль DCA", money(s.dca.pnl, true)],
      ["Дней с покупкой", s.buys.toLocaleString("ru-RU") + " из " + s.m.toLocaleString("ru-RU")], ["Макс. трата за 30 дн", money(s.max30)],
    ];
    if (anySell) cells.push([s.reserve ? "Продано в резерв" : "Получено от продаж", money(s.rec)], ["Дней с продажей", s.sells.toLocaleString("ru-RU")]);
    el.innerHTML = `<div class="ex">
      ${o.onBack ? '<button class="ex-back" data-back>‹ Стратегии</button>' : ""}
      ${o.bare ? "" : `<div class="ex-h">${esc(st.name)}</div><div class="ex-about">${esc(st.about)}</div>`}
      ${o.bare ? "" : seg(period, h)}
      <div class="ex-hero" ${o.bare ? "hidden" : ""}><b>${pct(s.irr, true)}</b><span>в год</span>
        ${isDca ? "" : `<span class="ex-delta ${cls}" style="font-size:15px">${d == null ? "" : pct(d, true).replace("%", " п.п.") + " к DCA"}</span>`}
        ${s.reserve ? `<span class="ex-delta ${cls}" style="font-size:15px">итог ${pct(s.wealthEdge, true)} к DCA</span>` : ""}</div>
      <div data-candles></div>
      <div data-extra></div>
      ${o.bare ? seg(period, h) : ""}
      <div data-profit></div>
      <div class="ex-grid">${cells.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div>
      <details class="ex-years"><summary>По годам</summary><div class="scroll"><table><thead><tr><th>Год</th><th>Куплено</th>${anySell ? "<th>Продано</th>" : ""}<th>Прибыль</th>${isDca ? "" : "<th>DCA</th>"}</tr></thead>
        <tbody>${yrs.map((r) => `<tr><td>${r.y}</td><td>${money(r.buy)}</td>${anySell ? `<td>${money(r.sell)}</td>` : ""}<td>${money(r.pnl, true)}</td>${isDca ? "" : `<td>${money(r.dpnl, true)}</td>`}</tr>`).join("")}</tbody></table></div></details>
      <div class="ex-note">${fmtDate(h.t[i0])} — ${fmtDate(h.t[h.t.length - 1])}. ${s.reserve ? "Взнос " + money(unit) + " в день, как у DCA; резерв не приносит дохода" : "×1 = " + money(unit)}. Значки под свечой — покупки, над свечой — продажи: один значок — ×1, три — ×3. Прибыль по годам — накопленная с начала периода. Без комиссий и налогов.</div>
      ${o.onSelect ? `<button class="ex-use" data-use ${st.code === o.active ? "disabled" : ""}>${st.code === o.active ? "Выбрана" : "Выбрать"}</button>` : ""}
    </div>`;
    candles(el.querySelector("[data-candles]"), h, s, unit, { win: o.win, base: o.base,
      onDraw: o.onDraw ? (g) => o.onDraw(el.querySelector("[data-extra]"), g, s) : null });
    profitChart(el.querySelector("[data-profit]"), h, s);
    el.querySelectorAll("[data-period]").forEach((b) => b.addEventListener("click", () => o.onPeriod && o.onPeriod(b.dataset.period)));
    const back = el.querySelector("[data-back]"); if (back) back.addEventListener("click", o.onBack);
    const use = el.querySelector("[data-use]"); if (use) use.addEventListener("click", () => o.onSelect(st.code));
  }

  window.Explorer = { simulate, simulateReserve, startIndex, list, detail, money, pct, price, fmtDate, CODES };
})();
