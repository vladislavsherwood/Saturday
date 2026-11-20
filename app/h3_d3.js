/* h3, диагностика 3: «мелкие альты» — шум данных или настоящие вершины? Для каждой крупной вершины (d1_wick.json):
   шип (закрытие вершины > 1,5 × медианы ±3 дн), «тонкий» ряд (доля дней без изменения цены за ±90 дн > 10%), дневной ход > 50% в ±10 дн,
   разрывы дат, возраст монеты < 365 дн, вершина за 1–3 дня до −40%. Сравнение пропущенных и остальных; оракул без «шумных». */
const H = require('./h3_lib.js'), { G, L } = H;
const tops = require('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/h3/d1_wick.json');
const byName = {}; for (const g in G) for (const X of G[g]) byName[g + ':' + X.name] = X;
for (const t of tops) {
  const X = byName[t.g + ':' + t.nm], c = X.c, n = X.n, i = t.i;
  let flat = 0, k0 = Math.max(1, i - 90), k1 = Math.min(n - 1, i + 90); for (let k = k0; k <= k1; k++) if (c[k] === c[k - 1]) flat++;
  t.flat = flat / (k1 - k0 + 1);
  let jump = 0; for (let k = Math.max(1, i - 10); k <= Math.min(n - 1, i + 10); k++) jump = Math.max(jump, Math.abs(Math.log(c[k] / c[k - 1])));
  t.jump = jump; let gap = 0; for (let k = Math.max(1, i - 90); k <= k1; k++) if (X.ind.t[k] - X.ind.t[k - 1] > 1) gap++; t.gap = gap;
  t.young = X.ind.age[i] < 365; t.fast = t.d40 <= 3;
  t.noisy = t.spike || t.flat > 0.1 || t.jump > Math.log(1.5) || t.gap > 0;
}
const miss = (t) => t.sold40 < 0.2 && t.sh > 0.3;
const pc = (a, f) => `${a.filter(f).length}/${a.length} (${((100 * a.filter(f).length) / Math.max(a.length, 1)).toFixed(0)}%)`;
for (const [nm, A] of [['пропущенные', tops.filter(miss)], ['остальные', tops.filter((t) => !miss(t))]]) for (const [gn, gl] of [['81', ['sel', 'ex', 'rnd']], ['100н', ['n100']]]) {
  const B = A.filter((t) => gl.includes(t.g));
  console.log(`${nm} ${gn}: шип ${pc(B, (t) => t.spike)}; тонкий ряд ${pc(B, (t) => t.flat > 0.1)}; ход > 50%/день ${pc(B, (t) => t.jump > Math.log(1.5))}; разрывы ${pc(B, (t) => t.gap > 0)}; молодая < 365 дн ${pc(B, (t) => t.young)}; −40% за ≤ 3 дн ${pc(B, (t) => t.fast)}; хоть что-то из шума ${pc(B, (t) => t.noisy)}`);
}
const M = tops.filter(miss), s = (a) => a.reduce((x, t) => x + t.orc, 0).toFixed(3);
console.log(`оракул 50% по пропущенным: всего ${s(M)}; шумные ${s(M.filter((t) => t.noisy))}; −40% за ≤ 3 дн ${s(M.filter((t) => t.fast))}; молодые ${s(M.filter((t) => t.young))}; чистые (не шум, не быстрые) ${s(M.filter((t) => !t.noisy && !t.fast))} — ${M.filter((t) => !t.noisy && !t.fast).length} вершин`);
console.log('сегменты пропущенных:', ['big', 'alt', 'meme'].map((sg) => `${sg} ${M.filter((t) => t.seg === sg).length}`).join(', '), '| группы:', ['sel', 'ex', 'rnd', 'n100'].map((g) => `${g} ${M.filter((t) => t.g === g).length}`).join(', '));
console.log('чистые пропущенные на 81 монете:', M.filter((t) => !t.noisy && !t.fast && t.g !== 'n100').map((t) => `${t.nm} ${t.d} ${t.typ} ${t.orc.toFixed(3)}`).join('; '));
