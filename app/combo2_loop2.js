/* Объединение 2, круг 2: аддитивность (пары), пересечения (B65 × A1 у альтов «с поведением крупных», B65 × CM2 у DOGE/FLOKI), соседи параметров
   выбранного сочетания «все три (список|B65)». Быстрый оценщик. Запуск: node app/combo2_loop2.js [выход.json] */
const Z = require('./combo2_sim.js'); const { K } = Z; const fs = require('fs');
const G = Z.load();
const ALL3 = { a1: true, as: true, cm2: true, b65: 'list' };
const V = {
  'основа': {},
  'альты + мемы': { a1: true, as: true, cm2: true },
  'альты + список|B65': { a1: true, as: true, b65: 'list' },
  'мемы + список|B65': { cm2: true, b65: 'list' },
  'ВСЕ ТРИ (список|B65)': ALL3,
  'все три, B65 только у списка крупных': { ...ALL3, b65: 'listonly' },
  'все три, потолок тихих ×1,5 (не-C)': { ...ALL3, cap: { qt: 1.5, wide: 1.5 } },
  'соседи: B65 тихие ×1,25': { ...ALL3, bq: 1.25 }, 'соседи: B65 тихие ×1,75': { ...ALL3, bq: 1.75 },
  'соседи: B65 страх ×1,1': { ...ALL3, bf: 1.1 }, 'соседи: B65 страх ×1,5': { ...ALL3, bf: 1.5 },
  'соседи: corr > 0,6': { ...ALL3, bc: 0.6 }, 'соседи: corr > 0,7': { ...ALL3, bc: 0.7 },
  'соседи: vol < 80': { ...ALL3, bv: 80 }, 'соседи: vol < 100': { ...ALL3, bv: 100 },
  'соседи: CM ×1,5': { ...ALL3, cm2k: 1.5 }, 'соседи: CM ×2,5': { ...ALL3, cm2k: 2.5 },
  'соседи: A1 ×1,5': { ...ALL3, a1k: 1.5 }, 'соседи: A1 ×1,1': { ...ALL3, a1k: 1.1 },
  'соседи: AS 5%': { ...ALL3, asz: 0.05 }, 'соседи: AS 15%': { ...ALL3, asz: 0.15 },
  'соседи: AS жадность > 60': { ...ALL3, asf: 60 }, 'соседи: AS жадность > 70': { ...ALL3, asf: 70 },
  'соседи: C ×1,1 (CM ×2)': { ...ALL3, ck: 1.1 }, 'соседи: C ×1,5 (CM ×2)': { ...ALL3, ck: 1.5 },
};
let b = null, bs = null; const res = {};
for (const [tag, o] of Object.entries(V)) {
  const S = Z.build(o), r = Z.evc(G, S), R = Z.sum(r); if (!b) { b = r; bs = R; }
  const segs = Z.SEGS.map((s) => `${s} ${(Z.inc(R, s) - Z.inc(bs, s) >= 0 ? '+' : '') + (Z.inc(R, s) - Z.inc(bs, s)).toFixed(3)}${Z.strict(R, bs, s).length ? '·' + Z.strict(R, bs, s).join(',') : '✔'}`).join(' | ');
  const n = R.n100.all, ml = Z.mlog(r, b, 'all', ['n100']);
  console.log(`${tag.padEnd(40)} ${segs} | 100н ${n.med.toFixed(0)} ${n.pos}/${n.hpos} (${ml.u}/${ml.d}) | ${[R.sel.all.med, R.ex.all.med, R.rnd.all.med].map((x) => x.toFixed(0)).join('/')}`);
  res[tag] = { o, inc: Object.fromEntries(Z.SEGS.map((s) => [s, Z.inc(R, s) - Z.inc(bs, s)])), strict: Object.fromEntries(Z.SEGS.map((s) => [s, Z.strict(R, bs, s)])), n100: { med: n.med, pos: n.pos, hpos: n.hpos, bw: [ml.u, ml.d] }, med: [R.sel.all.med, R.ex.all.med, R.rnd.all.med] };
}
// пересечения у выбранного: монеты, где одновременно действуют B65 и A1/CM2 (сравнение с вариантами без B65)
const S3 = Z.build(ALL3), Sn = Z.build({ a1: true, as: true, cm2: true }), Sb = Z.build({ b65: 'list' });
console.log('\nМонеты, у которых вклад B65 внутри «все три» отличается от вклада B65 на основе больше 2% итога (пересечение):');
for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const X of G[g]) {
  const e3 = K.E(X, S3, 'full'), en = K.E(X, Sn, 'full'), eb = K.E(X, Sb, 'full'), e0 = K.E(X, Z.BASE, 'full');
  const d3 = Z.L1(e3) - Z.L1(en), d1 = Z.L1(eb) - Z.L1(e0);
  if (Math.abs(d3 - d1) > 0.02) console.log(`  ${g} ${X.name} (${X.seg}): основа ${e0.toFixed(0)}, +B65 ${eb.toFixed(0)}; без B65 ${en.toFixed(0)}, все три ${e3.toFixed(0)} | вклад B65 лог ${d1.toFixed(3)} → ${d3.toFixed(3)}`);
}
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(res));
