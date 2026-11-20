/* h3, круг 2 (до прогонов стратегии): сила сигналов «вершина альта раньше BTC» сама по себе. Эпизод — первый день условия после ≥ 30 дн без него.
   Для эпизода: лог-рост монеты через 90 / 180 дн минус средний лог-рост монеты за 90 / 180 дн (> 0 — монета потом росла лучше обычного);
   доля эпизодов, после которых монета ушла на +200% (максимум 365 дн ≥ 3 × цены); сколько пропущенных вершин EARLY пойманы (эпизод в [−30; +5] дн от вершины). */
const H = require('./h3_lib.js'), { L, G } = H; H.inds();
const tops = require('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/h3/d1_wick.json').filter((t) => t.sold40 < 0.2 && t.sh > 0.3 && t.typ !== 'R27');
const SIG = {
  'A отн. вершина: rlo180>2, rdd90<3, btcath>15': (I, i) => I.rlo180[i] > 2 && I.rdd90[i] < 3 && I.btcath[i] > 15,
  'A отн. вершина: rlo180>3, rdd90<3, btcath>15': (I, i) => I.rlo180[i] > 3 && I.rdd90[i] < 3 && I.btcath[i] > 15,
  'A отн. вершина: rlo180>2, rdd90<3, btcath>25': (I, i) => I.rlo180[i] > 2 && I.rdd90[i] < 3 && I.btcath[i] > 25,
  'B остаток с бетой: res90>1, btcath>15': (I, i) => I.res90[i] > 1 && I.btcath[i] > 15,
  'B остаток с бетой: res90>1.5, btcath>15': (I, i) => I.res90[i] > 1.5 && I.btcath[i] > 15,
  'B остаток с бетой: res90>1 (любой BTC)': (I, i) => I.res90[i] > 1,
  'C памп без BTC: up90>150, btcr90<10': (I, i) => I.up90[i] > 150 && I.btcr90[i] < 10,
  'C памп без BTC: up90>200, btcr90<20': (I, i) => I.up90[i] > 200 && I.btcr90[i] < 20,
  'C памп без BTC: up90>100, btcr90<0': (I, i) => I.up90[i] > 100 && I.btcr90[i] < 0,
  'D разворот пары: rlo180>2, rdd90>20, btcath>15': (I, i) => I.rlo180[i] > 2 && I.rdd90[i] > 20 && I.rdd90[i] < 50 && I.btcath[i] > 15,
  'D разворот пары: rlo180>3, rdd90>25, btcath>15': (I, i) => I.rlo180[i] > 3 && I.rdd90[i] > 25 && I.rdd90[i] < 50 && I.btcath[i] > 15,
  'E памп без альтов: up90>150, oth90<0': (I, i) => I.up90[i] > 150 && I.oth90[i] < 0,
  'F rel90>100, btcath>15': (I, i) => I.rel90[i] > 100 && I.btcath[i] > 15,
  'F rel90>200, btcath>15': (I, i) => I.rel90[i] > 200 && I.btcath[i] > 15,
  'контроль: памп в медвежьем (правила 52–54) up90>300, btcath>20': (I, i) => I.up90[i] > 300 && I.btcath[i] > 20,
};
const res = (sg) => {
  const o = {};
  for (const [nm, lists] of [['81', ['sel', 'ex', 'rnd']], ['100н', ['n100']]]) {
    let ep = 0, a90 = 0, n90 = 0, a180 = 0, n180 = 0, f3 = 0, caught = 0, coins = new Set();
    for (const g of lists) for (const X of G[g]) {
      const I = X.ind, c = X.c, n = X.n; let last = -1e9;
      const mean = (h) => { let s = 0, k = 0; for (let i = 60; i + h < n; i++) { s += Math.log(c[i + h] / c[i]); k++; } return k ? s / k : 0; };
      const m90 = mean(90), m180 = mean(180);
      for (let i = 60; i < n; i++) {
        if (!(I.age[i] > 60 && sg(I, i))) continue;
        if (i - last > 30) { ep++; coins.add(X.name);
          if (i + 90 < n) { a90 += Math.log(c[i + 90] / c[i]) - m90; n90++; }
          if (i + 180 < n) { a180 += Math.log(c[i + 180] / c[i]) - m180; n180++; }
          let mx = 0; for (let k = i; k < Math.min(n, i + 365); k++) mx = Math.max(mx, c[k]); if (mx >= 3 * c[i]) f3++;
        }
        last = i;
      }
      for (const t of tops) if (t.g === g && t.nm === X.name) { let hit = false; for (let k = Math.max(0, t.i - 30); k <= Math.min(n - 1, t.i + 5); k++) if (I.age[k] > 60 && sg(I, k)) hit = true; if (hit) caught++; }
    }
    const tn = tops.filter((t) => lists.includes(t.g)).length;
    o[nm] = `эп ${ep} (монет ${coins.size}) 90д ${(a90 / Math.max(n90, 1)).toFixed(2)} 180д ${(a180 / Math.max(n180, 1)).toFixed(2)} +200% ${((100 * f3) / Math.max(ep, 1)).toFixed(0)}% пойм ${caught}/${tn}`;
  }
  return o;
};
for (const [nm, sg] of Object.entries(SIG)) { const o = res(sg); console.log(`${nm.padEnd(58)} | 81: ${o['81']} | 100н: ${o['100н']}`); }
