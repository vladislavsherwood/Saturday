/* Круг 9: плато вокруг «A540 s t0,98 k0,25 rv0,96» (долг паники при росте usdt, выдача на развороте; сильную панику не откладывать)
   и вариант без состояния (только правила: у пика usdt доля × k, на развороте — копия × m), который проще перенести в движок.
   Запуск: node panicx_r9.js [plateau|rules] → сводка: доля вариантов ✔, диапазон дохода и метрики */
const P = require('./panicx_sim.js'), Z = P.Z, { c } = Z;
const { Pol } = require('./panicx_r8.js');
const why = (r) => { const { BS } = P.baseline(); return Z.SEGS.map((s) => { const w = Z.strict(r.RS, BS, s); return w.length ? `${s}: ${w.join(',')}` : ''; }).filter(Boolean).join(' | '); };
const rows = [];
const run = (nm, S, pol) => { const r = P.report(nm, S, pol, { quiet: true }); const w = why(r); console.log(`${nm.padEnd(36)} ${['sel', 'ex', 'rnd'].map((g) => Math.round(r.RS[g].all.med)).join(' / ')} доход ${r.d.toFixed(3)} ${w ? '✗' : '✔'} паника ${r.M.fall.toFixed(1)}%/${r.M.days}д/${r.M.big.toFixed(0)}% монеты ${r.M.fallC.toFixed(1)}%/${r.M.daysC.toFixed(0)}д ${w.slice(0, 140)}`); rows.push({ nm, d: r.d, ok: !w, M: r.M }); return r; };
const mode = process.argv[2] || 'plateau';
P.report('основа', P.base, null);
if (mode === 'plateau') {
  for (const A of [450, 540, 630, 730]) for (const t of [0.97, 0.975, 0.98, 0.985, 0.99]) for (const k of [0, 0.25, 0.5]) for (const rv of [0.955, 0.96, 0.965]) run(`A${A} t${t} k${k} rv${rv}`, P.base, Pol({ A, t, k, rv, strong: true }));
  for (const su of [1.15, 1.25, 1.3]) run(`A540 t0.98 k0.25 rv0.96 сильная>${su}`, P.base, Pol({ A: 540, t: 0.98, k: 0.25, rv: 0.96, strong: true, su }));
  const ok = rows.filter((x) => x.ok), ds = rows.map((x) => x.d).sort((a, b) => a - b);
  console.log(`\nвсего ${rows.length}, ✔ ${ok.length}; доход мин ${ds[0].toFixed(3)} медиана ${ds[ds.length >> 1].toFixed(3)} макс ${ds[ds.length - 1].toFixed(3)}; в плюсе ${rows.filter((x) => x.d > 0).length}; метрика лучше основы ${rows.filter((x) => x.M.fall < 24.73 && x.M.fallC < 32.9).length}`);
  for (const key of ['A', 't', 'k', 'rv']) { const g = {}; for (const x of rows) { const m = x.nm.match(new RegExp(`${key}([0-9.]+)`)); if (!m) continue; (g[m[1]] = g[m[1]] || []).push(x); } console.log(key, Object.entries(g).map(([v, a]) => `${v}: ✔${a.filter((x) => x.ok).length}/${a.length} ср.доход ${(a.reduce((s, x) => s + x.d, 0) / a.length).toFixed(3)}`).join(' | ')); }
}
if (mode === 'rules') {
  const G = P.load(); const sc = (r, k) => +(1 + Math.min(1, (r.act - 1) * k)).toFixed(6);
  // без состояния: [разворот upk10 < rv → × m], [usdt ≤ 1,2 и age > A и upk10 ≥ t → × k], исходное
  const R = (k, m, t = 0.98, rv = 0.96, A = 540) => P.mapP((r) => {
    const strong = r.conds.filter((x) => x.ind === 'usdt').length === 2, out = [];
    if (m > 1) out.push({ act: sc(r, m), conds: [...r.conds, c('upk10', '<', rv), c('age', '>', A)] });
    if (!strong) out.push({ act: sc(r, k), conds: [...r.conds, c('upk10', '>', t - 1e-9), c('age', '>', A)] });
    out.push(r); return out;
  });
  for (const k of [0.25, 0.5]) for (const m of [1, 2, 3, 4]) run(`правила k${k} разворот×${m}`, R(k, m), null);
}
