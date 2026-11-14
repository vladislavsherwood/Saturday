/* Агент 2: помощники поверх agent_sim.js — дополнительные индикаторы по цене биткоина (сопоставление по дню с BTC со страницы отбора),
   сравнение кандидата с основой (строгая проверка, доход, 100 новых), правка правил основы.
   Использование: const A = require('./agent2_sim.js'); const G = A.groups(); const base = A.ev(G, A.MAIN); A.show(tag, A.ev(G, S), base) */
const S = require('./agent_sim.js');
const fs = require('fs');
const MAIN = JSON.parse(fs.readFileSync(__dirname + '/found/main-crypto.json', 'utf8'));
const { c } = S;
let BTC = null;
function btcMap() {
  if (BTC) return BTC;
  const X = S.loadPage('strategy-builder-sol').find((x) => x.name === 'BTC');
  BTC = new Map(); for (let i = 0; i < X.n; i++) BTC.set(X.t[i], X.c[i]);
  return BTC;
}
// индикаторы по цене биткоина на днях монеты (только прошлое)
const EXTRA = [];
function addBtc(X) {
  if (X.ind.btcp) return;
  const M = btcMap(), n = X.n, b = new Float64Array(n);
  for (let i = 0; i < n; i++) { const v = M.get(X.t[i]); b[i] = v == null ? NaN : v; }
  X.ind.btcp = b;
  const up = (w) => { const a = new Float64Array(n); for (let i = 0; i < n; i++) { let m = Infinity; for (let j = Math.max(0, i - w + 1); j <= i; j++) if (b[j] < m) m = b[j]; a[i] = i >= w - 1 ? (b[i] / m - 1) * 100 : NaN; } return a; };
  for (const w of [30, 60, 90]) X.ind['btcup' + w] = up(w);
  const sma = (w) => { const a = new Float64Array(n); let s = 0; for (let i = 0; i < n; i++) { s += b[i]; if (i >= w) s -= b[i - w]; a[i] = i >= w - 1 ? b[i] / (s / w) : NaN; } return a; };
  for (const w of [20, 50, 100, 200]) X.ind['bsma' + w] = sma(w);
  for (const f of EXTRA) f(X);
}
function groups(list = ['sel', 'ex', 'rnd', 'n100']) { const G = S.groups(list); for (const g in G) for (const X of G[g]) addBtc(X); return G; }
// оценка: отбор, экзамен, 50 случайных (+100 новых, если есть в G) и метрики на 81 монете
function ev(G, X, withM = true) { return S.evalAll(G, X, withM); }
const d = (r, b) => S.inc(r) - S.inc(b);
function show(tag, r, b) {
  const pass = S.passes(r, b) ? '✔' : '·';
  const n = r.n100 ? ` | 100н ${r.n100.med.toFixed(0)}/${r.n100.pos}/${r.n100.hpos}` : '';
  const m = r.m ? ` | дно ${r.m.buyAbove90.toFixed(0)}/${r.m.zone15.toFixed(0)}/${r.m.bott3.toFixed(0)} вершины ${r.m.sellToTop.toFixed(0)}/${r.m.missedTops.toFixed(0)}` : '';
  return `${pass} ${d(r, b) >= 0 ? '+' : ''}${d(r, b).toFixed(3)} | ${S.line(r)} | худш. отбор ${r.sel.worst.toFixed(0)} 50сл ${r.rnd.worst.toFixed(0)}${n}${m} | ${tag}`;
}
// почему не прошла строгую проверку: список пунктов с цифрами
function why(r, b) { const o = []; for (const k of ['sel', 'ex']) { if (r[k].pos < b[k].pos) o.push(`${k} в плюсе ${r[k].pos}<${b[k].pos}`); if (r[k].worst < b[k].worst - 1e-9) o.push(`${k} худшая ${r[k].worst.toFixed(2)}<${b[k].worst.toFixed(2)}`); if (r[k].hworst < b[k].hworst - 1e-9) o.push(`${k} худш.пол. ${r[k].hworst.toFixed(2)}<${b[k].hworst.toFixed(2)}`); if (r[k].hpos < b[k].hpos) o.push(`${k} половин ${r[k].hpos}<${b[k].hpos}`); }
  if (r.rnd.pos < b.rnd.pos) o.push(`rnd в плюсе ${r.rnd.pos}<${b.rnd.pos}`); if (r.rnd.hpos < b.rnd.hpos) o.push(`rnd половин ${r.rnd.hpos}<${b.rnd.hpos}`); if (r.rnd.hworst < b.rnd.hworst - 1e-9) o.push(`rnd худш.пол. ${r.rnd.hworst.toFixed(2)}<${b.rnd.hworst.toFixed(2)}`); return o.join('; '); }
const HDR = 'строго доход | ' + S.HDR + ' | 100н мед/плюс/пол+ | дно: выше мин90/в зоне/≥3 дней; вершины: к макс/пропущено';
// правка правил: заменить порог/действие по условию
const mapRules = (X, f) => ({ ...X, rules: X.rules.flatMap((r, i) => { const o = f(r, i); return o == null ? [] : Array.isArray(o) ? o : [o]; }) });
const has = (r, ind) => r.conds.some((cd) => cd.ind === ind);
module.exports = { ...S, S, MAIN, groups, ev, show, why, HDR, d, mapRules, has, EXTRA, addBtc, c };
