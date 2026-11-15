/* Круг 5: копия паники при развороте usdt (upk10 / pupk) × m — только в «бычьем» режиме BTC (выше средней 200 дн., или BTC ближе к максимуму, чем d%),
   чтобы не докупать в начале медвежьего рынка (окт–дек 2025: разворот usdt был, а дно — на 40% ниже). Плюс причины по сегментам. Запуск: node panicx_r5.js */
const P = require('./panicx_sim.js'), { c } = P.Z, Z = P.Z;
const G = P.load();
for (const g in G) for (const X of G[g]) if (!X.ind.upk10) { const u = X.ind.usdt, a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { let m = -Infinity; for (let k = Math.max(0, i - 9); k <= i; k++) if (u[k] > m) m = u[k]; a[i] = u[i] / m; } X.ind.upk10 = a; }
const sc = (r, k) => +(1 + Math.min(1, (r.act - 1) * k)).toFixed(6);
const V = (conds, m) => P.mapP((r) => [{ act: sc(r, m), conds: [...r.conds, ...conds.map(([a, b, v]) => c(a, b, v))] }, r]);
const why = (r) => { const { BS } = P.baseline(); return Z.SEGS.map((s) => { const w = Z.strict(r.RS, BS, s); return w.length ? `${s}: ${w.join(',')}` : ''; }).filter(Boolean).join(' | '); };
const out = [];
const run = (nm, S) => { const r = P.report(nm, S, null, { quiet: true }); console.log(r.line.split(' | паника')[0].replace(/ (sel|ex|rnd):.*$/, ''), '| паника' + r.line.split('| паника')[1].split(' sel:')[0].split(' ex:')[0].split(' rnd:')[0], '||', why(r)); out.push([nm, r]); return r; };
P.report('основа', P.base, null);
if (!process.argv[2] || process.argv[2] === 'diag') for (const [ui, uv] of [['upk10', 0.96], ['upk10', 0.97], ['pupk', 0.97]]) for (const [nm, rg] of [['', []], ['BTC>sma200', [['btc200', '>', 1]]], ['BTC<sma200', [['btc200', '<', 1]]], ['btcath<30', [['btcath', '<', 30]]], ['btcath<40', [['btcath', '<', 40]]]]) for (const m of [1.5, 2, 3]) run(`${ui}<${uv} ${nm} ×${m}`, V([[ui, '<', uv], ...rg], m));
if (process.argv[2] === 'diag') {
  const { BR } = P.baseline();
  for (const [nm, r] of out.filter(([n]) => /^(upk10<0.96  ×1.5|pupk<0.97  ×2)$/.test(n))) {
    console.log('—', nm);
    for (const g of ['sel', 'ex', 'rnd']) r.R[g].forEach((x, i) => { const y = BR[g][i]; const w = ['f', 'h1', 'h2'].filter((k) => Math.abs(x[k] - y[k]) > 0.01 && (x[k] < y[k])); if (w.length && (x.seg === 'meme' || g !== 'rnd' || w.some((k) => y[k] < 50))) console.log('   ', g, x.name, x.seg, 'n', G[g][i].n, w.map((k) => `${k} ${y[k].toFixed(2)}→${x[k].toFixed(2)}`).join(' ')); });
  }
}
if (process.argv[2] === 'age') {
  for (const A of [365, 540, 730]) for (const [ui, uv] of [['upk10', 0.95], ['upk10', 0.96], ['upk10', 0.97], ['pupk', 0.96], ['pupk', 0.97], ['pupk', 0.98]]) for (const m of [1.5, 2, 3]) run(`${ui}<${uv} age>${A} ×${m}`, V([[ui, '<', uv], ['age', '>', A]], m));
}
