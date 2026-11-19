/* wk, круг 5: выбор долей финалиста и устойчивость.
   A — доли при уровнях −25/−40/−60 (раз в 3 дня, once, place): 10/20/30, 12,5/25/37,5, 15/25/35, 10/25/40, 15/30/45;
   B — финалист: соседи по всем параметрам (плато), реальность исполнения, половины, 100 новых;
   C — без 10.10.2025 и без 3 крупнейших дней (по числу исполнений по всем монетам);
   D — монеты пользователя: Yahoo и Binance (свечи Binance подставлены в те дни, где они есть: закрытие, минимум, максимум; правила — по индикаторам как есть).
   Запуск: node wk_r5.js [финалист: доли через запятую, напр. 0.1,0.2,0.3] > scratchpad/wk/r5.log */
const fs = require('fs');
const W = require('./wk_lib.js'), { ev, pol, P, G, S0, pol0, BY, T } = W;
const DIR = '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/wk';
const KS = [0.25, 0.4, 0.6], B = { every: 3, once: 1, size: 'place' };
const LV = (fs_, ks = KS) => ks.map((k, q) => [k, fs_[q]]);
const tag = (lv) => lv.map(([k, f]) => `−${Math.round(k * 100)}:${+(f * 100).toFixed(1)}`).join(' ');
const sec = process.argv[3] || 'ABCD';
W.head();
if (sec.includes('A')) {
  console.log('— A: доли —');
  for (const f of [[0.1, 0.2, 0.3], [0.125, 0.25, 0.375], [0.15, 0.25, 0.35], [0.1, 0.25, 0.4], [0.15, 0.3, 0.45], [0.2, 0.2, 0.2], [0.1, 0.2, 0.5]]) ev(`доли ${tag(LV(f))}`, pol({ ...B, lv: LV(f) }), { n100: true });
}
const FF = (process.argv[2] || '0.1,0.2,0.3').split(',').map(Number), F = { ...B, lv: LV(FF) };
const fin = (o = {}) => pol({ ...F, ...o });
if (sec.includes('B')) {
  console.log(`— B: финалист ${tag(F.lv)}, раз в 3 дня, once, place: соседи и реальность —`);
  ev('ФИНАЛИСТ', fin(), { n100: true });
  ev('исходная ловушка T0 (dcaf)', W.T0, { n100: true });
  const sc = (a, m = 1) => F.lv.map(([k, f]) => [1 - Math.pow(1 - k, a), f * m]);
  for (const a of [0.9, 1.1]) ev(`уровни ×${a} (лог): ${tag(sc(a))}`, fin({ lv: sc(a) }), { n100: true });
  for (const m of [0.8, 1.2]) ev(`доли ×${m}: ${tag(sc(1, m))}`, fin({ lv: sc(1, m) }), { n100: true });
  for (const e of [1, 2, 4, 5]) ev(`раз в ${e} дн`, fin({ every: e }), { n100: true });
  for (const age of [30, 120, 365]) ev(`монете > ${age} дн`, fin({ age }), { n100: true });
  ev('пробой лимита 1%', fin({ tt: 0.01 }), { n100: true });
  ev('фитиль до сделки правила (first)', fin({ first: 1 }), { n100: true });
  ev('мейкер 0,02%', fin({ fee: 0.0002 }), { n100: true });
  ev('всё вместе: пробой 1% + first + мейкер 0,02% + мин. $5/0,01 при $2', fin({ tt: 0.01, first: 1, fee: 0.0002, min: (X, lim) => 5 * Math.max(5, 0.01 * lim), merge: 'down' }), { n100: true });
}
if (sec.includes('C')) {
  console.log('— C: без отдельных дней —');
  const log = []; const p = fin({ log });
  for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) P.edge(X, S0, 0, 'full', false, p);
  const by = {}; for (const [nm, i, k, amt] of log) { const t = BY[nm].ind.t[i]; (by[t] = by[t] || { n: 0, c: new Set(), amt: 0 }).n++; by[t].c.add(nm); }
  const top = Object.entries(by).sort((a, b) => b[1].c.size - a[1].c.size).slice(0, 8);
  console.log('дни с наибольшим числом монет с исполнением (сдвиг 0, 81 монета):', top.map(([t, o]) => `${W.day(+t)} ${o.c.size}`).join(', '));
  const t10 = [T('2025-10-10'), T('2025-10-11')];
  ev('без 10–11.10.2025', fin({ day: (X, i) => !t10.includes(X.ind.t[i]) }), { n100: true });
  const t3 = top.slice(0, 3).map(([t]) => +t);
  ev(`без 3 крупнейших: ${t3.map(W.day).join(', ')}`, fin({ day: (X, i) => !t3.includes(X.ind.t[i]) }), { n100: true });
  const t3b = [...new Set([...t10, ...t3, ...top.slice(3, 6).map(([t]) => +t)])];
  ev(`без 10.10.2025 и 6 крупнейших`, fin({ day: (X, i) => !t3b.includes(X.ind.t[i]) }), { n100: true });
  // доля выгоды по дням: сколько денег ловушка вложила в топ-дни
  const tot = log.reduce((s, x) => s + x[3], 0), inTop = log.filter(([nm, i]) => t3.includes(BY[nm].ind.t[i])).reduce((s, x) => s + x[3], 0);
  console.log(`исполнений всего ${log.length} (монето-уровней), денег в 3 крупнейших днях ${(100 * inTop / tot).toFixed(1)}%`);
}
if (sec.includes('D')) {
  console.log('— D: монеты пользователя: доход к DCA, % (худший из сдвигов 0/1), вся история / с 2024 —');
  const BN = JSON.parse(fs.readFileSync(`${DIR}/bn.json`, 'utf8'));
  const mine = ['BTC', 'ETH', 'SOL', 'DOGE', 'PEPE', 'ENA', 'ZEC', 'PENGU', 'HYPE', 'PUMP', 'XMR', 'FARTCOIN', 'USELESS'];
  const E = (X, p, a0) => Math.min(...[0, 1].map((lag) => edgeFrom(X, p, lag, a0)));
  // доход с дня a0 (индекс) до конца — через временную обрезку ряда
  function edgeFrom(X, p, lag, a0) { if (!a0) return P.edge(X, S0, lag, 'full', false, p).e; const Y = cut(X, a0); return P.edge(Y, S0, lag, 'full', false, p).e; }
  function cut(X, a0) { const Y = { ...X, n: X.n - a0, ind: {} }; for (const k in X.ind) Y.ind[k] = X.ind[k].subarray(a0); Y.c = Y.ind.c; Y.t = Y.ind.t; Y.l = Y.ind.l; Y.h = Y.ind.h; return Y; }
  function binance(X) { // копия ряда с ценами Binance в те дни, где они есть
    const b = BN[X.name]; if (!b) return null; const m = new Map(b.t.map((t, q) => [t, q]));
    const Y = { ...X, ind: { ...X.ind } }; const c = Float64Array.from(X.c), l = Float64Array.from(X.l), h = Float64Array.from(X.h); let n = 0, ld = 0, lu = 0;
    for (let i = 0; i < X.n; i++) { const q = m.get(X.ind.t[i]); if (q == null) continue; n++; const r = b.c[q] / X.c[i]; if (r > 0.8 && r < 1.25) { c[i] = b.c[q]; l[i] = Math.min(b.l[q], b.c[q]); h[i] = Math.max(b.h[q], b.c[q]); if (l[i] < X.l[i] * 0.97) ld++; if (l[i] > X.l[i] * 1.03) lu++; } }
    Y.ind.c = c; Y.ind.l = l; Y.ind.h = h; Y.c = c; Y.l = l; Y.h = h; Y.bn = { n, ld, lu }; return Y;
  }
  const cnt = (X, p) => { const log = []; P.edge(X, S0, 0, 'full', false, { ...p, wick: { ...p.wick, log } }); return log.length; };
  const p1 = fin();
  console.log('монета     с        | Yahoo: combo4 → ловушка (исп.) | Binance: дней, мин. ниже/выше Yahoo >3% | combo4 → ловушка (исп.) | с 2024: Yahoo combo4 → лов. | Binance combo4 → лов.');
  for (const nm of mine) {
    const X = BY[nm]; if (!X) { console.log(nm, 'нет в данных'); continue; }
    const Y = binance(X), a24 = Math.max(0, X.ind.t.findIndex((t) => t >= T('2024-01-01')));
    const f = (v) => `${v.toFixed(0).padStart(6)}%`;
    let s = `${nm.padEnd(9)} ${W.day(X.ind.t[0])} | ${f(E(X, pol0))} → ${f(E(X, p1))} (${cnt(X, p1)})`;
    if (Y) s += ` | ${Y.bn.n} дн, ${Y.bn.ld}/${Y.bn.lu} | ${f(E(Y, pol0))} → ${f(E(Y, p1))} (${cnt(Y, p1)})`; else s += ' | Binance нет';
    if (a24 > 0) s += ` | ${f(E(X, pol0, a24))} → ${f(E(X, p1, a24))}` + (Y ? ` | ${f(E(Y, pol0, a24))} → ${f(E(Y, p1, a24))}` : '');
    console.log(s);
  }
}
