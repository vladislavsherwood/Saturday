/* h3, круг 5: проверка лучшего «памп без BTC» (up90 > U, btcr90 < B, возраст > A → продать s, последним): чувствительность к возрасту,
   соседи, основа c4, провалы (продано ≥ 10%, потом ×3 за год), пойманные пропущенные вершины. */
const H = require('./h3_lib.js'), { L, c } = H; H.inds();
const KEY = process.argv[2] === 'c4' ? 'c4' : 'wick';
const pol = H.base(KEY);
const tops = require('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/h3/d1_wick.json');
const miss = tops.filter((t) => t.sold40 < 0.2 && t.sh > 0.3);
const rule = (u, b, a, s) => ({ act: -s, conds: [c('up90', '>', u), c('btcr90', '<', b), ...(a ? [c('age', '>', a)] : [])] });
const V = [];
for (const a of [0, 180, 365, 540]) V.push([250, 20, a, 0.25]);
for (const [u, b] of [[225, 20], [275, 20], [250, 15], [250, 25]]) V.push([u, b, 365, 0.25]);
for (const s of [0.15, 0.35, 0.5]) V.push([250, 20, 365, s]);
for (const v of V) {
  const [u, b, a, s] = v, S = H.ins(H.S57, rule(u, b, a, s), 'end'), r = L.run(`up90>${u} btcr90<${b} age>${a} → −${s * 100}%`, S, pol, { n100: true });
  if (u === 250 && b === 20 && a === 365 && s === 0.25) {
    console.log('  ', H.diffCoins(r, 8));
    const f = H.fails(S, S.rules[S.rules.length - 1], pol);
    console.log(`   эпизодов продаж ${f.ep} (81: ${f.ex.filter((e) => e.g !== 'n100').length}), провалов ${f.bad}: ${f.ex.filter((e) => e.fwd >= 3 && e.sh >= 0.1).map((e) => `${e.g}:${e.nm} ${e.d} ${(e.sh * 100).toFixed(0)}% ×${e.fwd.toFixed(1)}`).join(', ')}`);
    const hit = miss.filter((t) => f.ex.some((e) => e.g === t.g && e.nm === t.nm && e.i >= t.i - 30 && e.i <= t.i + 5));
    console.log(`   пропущенных вершин поймано: ${hit.length} из ${miss.length}: ${hit.map((t) => `${t.nm} ${t.d}`).join(', ')}`);
    console.log('   эпизоды 81:', f.ex.filter((e) => e.g !== 'n100').map((e) => `${e.nm} ${e.d} ${(e.sh * 100).toFixed(0)}% ×${e.fwd.toFixed(1)}`).join(', '));
  }
}
