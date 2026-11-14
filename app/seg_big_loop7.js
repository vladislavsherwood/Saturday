/* Круг 7. Устойчивость B65 и «список ИЛИ B65» по периодам: крупные по монетам и годам; остальные 72 монеты по годам и годам старта; метрики дна/вершин */
const Z = require('./seg_big_sim.js'); const { K } = Z;
const G = Z.load(); Z.addBig(G); const S = Z.BASE_S;
const V = { B65: Z.B65(), 'список|B65': Z.LB65() };
const all = [...G.sel, ...G.ex, ...G.rnd];
const wins = new Map(all.map((X) => [X, Z.windows(X)]));
const val = (S0) => new Map(all.map((X) => [X, Object.fromEntries(wins.get(X).map((w) => [w.k, Z.Ew(X, S0, w.a, w.b)]))]));
const b = val(S);
console.log('метрики основы: ' + K.fmtM(K.metrics(all, S)));
for (const nm in V) {
  const v = val(V[nm]);
  console.log(`\n=== ${nm}`);
  console.log('крупные: монета | вся | h1 | h2 | годы (Δ п.п. итога к DCA)');
  for (const X of all.filter((X) => Z.BIG.includes(X.name))) {
    const d = (k) => (v.get(X)[k] - b.get(X)[k]);
    const ys = Object.keys(b.get(X)).filter((k) => k[0] === 'y').map((k) => `${k.slice(3)}:${d(k) >= 0 ? '+' : ''}${d(k).toFixed(1)}`).join(' ');
    console.log(`${X.name} | ${d('full').toFixed(0)} | ${d('h1').toFixed(1)} | ${d('h2').toFixed(1)} | ${ys}`);
  }
  // по годам: крупные и остальные
  for (const [tag, F] of [['крупные', (X) => Z.BIG.includes(X.name)], ['остальные 72', (X) => !Z.BIG.includes(X.name)]]) {
    const yr = {}, st = {};
    for (const X of all.filter(F)) for (const k in b.get(X)) {
      const d = Z.l1(v.get(X)[k]) - Z.l1(b.get(X)[k]); const T = k[0] === 'y' ? yr : k[0] === 's' ? st : null; if (!T) continue;
      const y = k.slice(1); T[y] = T[y] || [0, 0, 0, 0]; T[y][0] += d; if (d > 0.002) T[y][1]++; if (d < -0.002) T[y][2]++; T[y][3]++;
    }
    console.log(`${tag}, календарные годы (Σлог, лучше/хуже из N): ` + Object.keys(yr).sort().map((y) => `${y} ${yr[y][0] >= 0 ? '+' : ''}${yr[y][0].toFixed(2)} (${yr[y][1]}/${yr[y][2]} из ${yr[y][3]})`).join('; '));
    console.log(`${tag}, с года старта: ` + Object.keys(st).sort().map((y) => `${y} ${st[y][0] >= 0 ? '+' : ''}${st[y][0].toFixed(2)} (${st[y][1]}/${st[y][2]})`).join('; '));
  }
  // худшие изменения у остальных (вся история)
  const oth = all.filter((X) => !Z.BIG.includes(X.name)).map((X) => [X.name, v.get(X).full - b.get(X).full, b.get(X).full]).filter((x) => Math.abs(x[1]) > 0.5).sort((a, c) => a[1] - c[1]);
  console.log('остальные, изменение итога (вся история), хуже: ' + oth.filter((x) => x[1] < 0).map((x) => `${x[0]} ${x[1].toFixed(0)} (из ${x[2].toFixed(0)})`).join(', '));
  console.log('остальные, лучше: ' + oth.filter((x) => x[1] > 0).map((x) => `${x[0]} +${x[1].toFixed(0)}`).join(', '));
  console.log('метрики: ' + K.fmtM(K.metrics(all, V[nm])));
}
