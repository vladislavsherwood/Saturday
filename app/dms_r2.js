/* dms: что бывает с ценой после дня без сигнала — по режимам (для маржинальной покупки / шорта важен сам будущий рост, а не сравнение с DCA).
   Средний лог-рост монеты через 30/90 дней после дня без сигнала, в % (среднее по монетам), и доля монет, где он > 0. 181 монета. Запуск: node dms_r2.js */
const L = require('./r4_lib.js'), { S0, G } = L;
const XS = []; for (const g of ['sel', 'ex', 'rnd', 'n100']) XS.push(...G[g]);
const plain = (X) => { const R = S0.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])); const a = new Uint8Array(X.n); for (let j = 0; j < X.n; j++) { let hit = false; for (const r of R) if (r.conds.every((cd) => { const v = X.ind[cd.ind][j]; return cd.op === '<' ? v < cd.v : v > cd.v; })) { hit = true; break; } a[j] = hit ? 0 : 1; } return a; };
const PL = new Map(XS.map((X) => [X, plain(X)]));
const REG = {
  'все дни': () => true, 'все дни без сигнала': (I, j, p) => p,
  'без сигнала, монета < 0,8 200д': (I, j, p) => p && I.sma200[j] < 0.8, 'без сигнала, монета < 200д': (I, j, p) => p && I.sma200[j] < 1,
  'без сигнала, монета и BTC < 200д': (I, j, p) => p && I.sma200[j] < 1 && I.btc200[j] < 1, 'без сигнала, рост 90д < −30%': (I, j, p) => p && I.ret90[j] < -30,
  'без сигнала, монета > 200д': (I, j, p) => p && I.sma200[j] > 1, 'без сигнала, монета и BTC > 200д': (I, j, p) => p && I.sma200[j] > 1 && I.btc200[j] > 1,
  'без сигнала, монета > 1,2 200д': (I, j, p) => p && I.sma200[j] > 1.2,
};
console.log('режим'.padEnd(36), 'дней   30 дней: рост, монет > 0     90 дней: рост, монет > 0');
for (const [nm, f] of Object.entries(REG)) {
  const r30 = [], r90 = [], p30 = [], p90 = []; let days = 0;
  for (const X of XS) { const p = PL.get(X), I = X.ind; let s3 = 0, m3 = 0, s9 = 0, m9 = 0; for (let j = 200; j < X.n; j++) { if (!f(I, j, p[j])) continue; days++; if (j + 30 < X.n) { s3 += Math.log(X.c[j + 30] / X.c[j]); m3++; } if (j + 90 < X.n) { s9 += Math.log(X.c[j + 90] / X.c[j]); m9++; } }
    if (m3 >= 20) r30.push(s3 / m3); if (m9 >= 20) r90.push(s9 / m9); }
  const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length * 100, pos = (v) => `${v.filter((x) => x > 0).length}/${v.length}`;
  console.log(nm.padEnd(36), String(days).padStart(6), `  ${mean(r30).toFixed(1).padStart(6)}%  ${pos(r30).padStart(7)}        ${mean(r90).toFixed(1).padStart(6)}%  ${pos(r90).padStart(7)}`);
}
console.log('Для сравнения: заём под 11% годовых = −0,9% за 30 дней, −2,7% за 90 дней.');
