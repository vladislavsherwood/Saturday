/* h3, диагностика: упущенные вершины combo4 + фитили. Сколько денег упущено и по каким типам.
   Вершина — как в gap_r1.js: максимум ±180 дн, затем −60% за год. Состояние — pol.trace (сдвиг 0, вся история).
   «Оракул» — сколько дал бы итог монеты, если бы на следующий день после вершины продать 50% позиции (правило первым по индикатору h3o, худший из сдвигов 0/1):
   Δ ln(итог/DCA) монеты. Типы: R27 — разворот BTC (правило 27) купил ≥ 10% капитала монеты за 60 дн до вершины; EARLY — BTC на вершине монеты не у ATH (btcath > 15)
   или BTC обновит максимум позже (+10% за 180 дн); иначе OTHER. Шум данных: однодневный шип (закрытие вершины > 1,5 × медианы ±3 дн).
   Запуск: node h3_d1.js [c4] */
const H = require('./h3_lib.js'), { L, P, G, c } = H;
const KEY = process.argv[2] === 'c4' ? 'c4' : 'wick';
const pol0 = KEY === 'wick' ? H.polW : H.polC;
const S = H.cl();
const R27 = S.rules[26];
L.addInd('h3o', (X) => new Float64Array(X.n)); L.addInd('h3n', (X) => new Float64Array(X.n));
const Sn = H.cl(); Sn.rules.splice(26, 0, { act: 1, conds: [c('h3n', '>', 0.5), c('btcr30', '>', 20)] }); // оракул 2: без правила 27 за 60 дн до вершины
const So = H.cl(); So.rules.unshift({ act: -0.5, conds: [c('h3o', '>', 0.5)] });
const lists = ['sel', 'ex', 'rnd', 'n100'];
const L1 = (e) => Math.log1p(e / 100);
const tops = [];
const fam = (r, k) => (k == null ? '?' : k < 3 ? 'дно' : k < 9 ? 'паника' : k === 9 ? 'охрана' : k < 26 ? 'страх' : k === 26 ? 'R27' : k < 30 ? 'фанд' : k < 38 ? 'тихая' : k < 50 ? 'широк' : k === 50 ? 'возвр' : k < 54 ? 'памп' : k === 54 ? 'альтсез' : 'эйфор');
for (const g of lists) for (const X of G[g]) {
  const pol = { ...pol0, trace: [] };
  const { tr } = P.edge(X, S, 0, 'full', true, pol);
  const T = pol.trace, cc = X.c, n = X.n, I = X.ind;
  const Rc = S.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind]));
  const V = T.map(([i, cash, u]) => cash + u * cc[i]);
  const base = Math.min(P.edge(X, S, 0, 'full', false, pol0).e, P.edge(X, S, 1, 'full', false, pol0).e);
  for (let i = 180; i < n - 30; i++) {
    let isMax = true; for (let k = Math.max(0, i - 180); k <= Math.min(n - 1, i + 180); k++) if (cc[k] > cc[i]) { isMax = false; break; }
    if (!isMax) continue;
    let mn = Infinity; for (let k = i; k < Math.min(n, i + 365); k++) mn = Math.min(mn, cc[k]);
    if (!(mn < cc[i] * 0.4)) continue;
    const a = Math.max(0, i - 60), b = Math.min(n - 1, i + 30);
    let maxU = 0; for (let k = a; k <= i; k++) maxU = Math.max(maxU, T[k][2]);
    const sh = (T[i][2] * cc[i]) / V[i];
    // покупки правила 27 и продажи по семьям в окне
    let r27 = 0; const sells = {}; let sellAmt = 0;
    for (const t of tr) {
      if (t.i < a || t.i > b) continue;
      const rr = t.q != null && t.q >= 0 ? Rc[t.q] : null, k = rr ? S.rules.indexOf(rr) : null;
      if (t.s > 0 && rr === R27 && t.i <= i) r27 += t.amt / V[i];
      if (t.s < 0) { const f = fam(rr, k); sells[f] = (sells[f] || 0) + t.amt; sellAmt += t.amt; }
    }
    // BTC
    const bp = I.btcp; let bmax = 0; for (let k = i; k < Math.min(n, i + 180); k++) if (bp[k] > bmax) bmax = bp[k];
    const btcLater = bmax > bp[i] * 1.1;
    let m3 = []; for (let k = i - 3; k <= i + 3; k++) if (k !== i && k >= 0 && k < n) m3.push(cc[k]); m3.sort((x, y) => x - y);
    const spike = cc[i] > 1.5 * m3[m3.length >> 1];
    // оракул
    I.h3o[i] = 1; const eo = Math.min(P.edge(X, So, 0, 'full', false, pol0).e, P.edge(X, So, 1, 'full', false, pol0).e); I.h3o[i] = 0;
    let orn = 0; if (r27 > 0) { for (let k = a; k <= i; k++) I.h3n[k] = 1; const en = Math.min(P.edge(X, Sn, 0, 'full', false, pol0).e, P.edge(X, Sn, 1, 'full', false, pol0).e); for (let k = a; k <= i; k++) I.h3n[k] = 0; orn = L1(en) - L1(base); }
    let k40 = i; while (k40 < Math.min(n - 1, i + 365) && cc[k40] > cc[i] * 0.6) k40++;
    const sold = 1 - T[b][2] / maxU, sold40 = 1 - T[k40][2] / maxU, sh40 = (T[k40][2] * cc[k40]) / V[k40];
    const typ = r27 >= 0.1 ? 'R27' : I.btcath[i] > 15 || btcLater ? 'EARLY' : 'OTHER';
    tops.push({ g, nm: X.name, seg: X.seg, d: L.day(I.t[i]), i, sh, sold, r27, btcath: I.btcath[i], btcLater, spike, dd: 1 - mn / cc[i], typ, orc: L1(eo) - L1(base), orn, sold40, sh40, d40: k40 - i, sells, sellAmt: sellAmt / V[i],
      rel90: I.rel90[i], rel180: I.rel180[i], up90: I.up90[i], beta: I.beta180[i], fng: I.fng[i], qt: I.qt[i], oth90: I.oth90[i], age: I.age[i] });
  }
}
const fs = require('fs'); fs.writeFileSync(`/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/h3/d1_${KEY}.json`, JSON.stringify(tops));
const pc = (x) => (x * 100).toFixed(0) + '%';
const s3 = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
const miss = tops.filter((t) => t.sold < 0.2);
const missR = tops.filter((t) => t.sold40 < 0.2 && t.sh > 0.3);
console.log(`ОСНОВА ${KEY}: вершин ${tops.length}; продано < 20% к +30 дн (как gap): ${miss.length}; ПРОПУЩЕНО (продано < 20% к дню, когда монета уже −40% от вершины, доля монеты на вершине > 30%): ${missR.length}`);
console.log(`оракул «продать 50% на день после вершины»: Σ по всем вершинам ${s3(tops.reduce((s, t) => s + t.orc, 0))}, по пропущенным ${s3(missR.reduce((s, t) => s + t.orc, 0))}, по не пропущенным ${s3(tops.filter((t) => !(t.sold40 < 0.2 && t.sh > 0.3)).reduce((s, t) => s + t.orc, 0))}`);
for (const grp of [['81', ['sel', 'ex', 'rnd']], ['100н', ['n100']]]) {
  const A = missR.filter((t) => grp[1].includes(t.g)), all = tops.filter((t) => grp[1].includes(t.g));
  console.log(`\n== ${grp[0]}: вершин ${all.length}, пропущено (продано < 20%, доля > 30%) ${A.length}; оракул Σ ${s3(A.reduce((s, t) => s + t.orc, 0))} (все вершины ${s3(all.reduce((s, t) => s + t.orc, 0))})`);
  for (const ty of ['R27', 'EARLY', 'OTHER']) {
    const B = A.filter((t) => t.typ === ty);
    const bySeg = ['big', 'alt', 'meme'].map((s) => `${s} ${B.filter((t) => t.seg === s).length}`).join(', ');
    console.log(`  ${ty}: ${B.length} (${bySeg}); шипов ${B.filter((t) => t.spike).length}; оракул Σ ${s3(B.reduce((s, t) => s + t.orc, 0))}, медиана ${B.length ? s3(B.map((t) => t.orc).sort((x, y) => x - y)[B.length >> 1]) : '-'}; «без R27 за 60 дн» Σ ${s3(B.reduce((s, t) => s + t.orn, 0))}`);
  }
}
console.log('\nпропущенные (81 + 100н), по оракулу:');
for (const t of missR.sort((x, y) => y.orc - x.orc)) console.log(`  ${t.g.padEnd(4)} ${t.d} ${t.nm.padEnd(9)} ${t.seg.padEnd(4)} ${t.typ.padEnd(5)} доля ${pc(t.sh).padStart(4)} продано30 ${pc(t.sold).padStart(5)} к−40% ${pc(t.sold40).padStart(4)} (${t.d40} дн, доля ${pc(t.sh40)}) R27 ${pc(t.r27).padStart(4)} btcath ${t.btcath.toFixed(0).padStart(3)} BTCпозже ${t.btcLater ? 'да' : 'нет'} падение ${pc(t.dd)} шип ${t.spike ? 'да' : '-'} | rel90 ${t.rel90.toFixed(0)} rel180 ${t.rel180.toFixed(0)} up90 ${t.up90.toFixed(0)} бета ${t.beta.toFixed(2)} fng ${t.fng.toFixed(0)} oth90 ${t.oth90.toFixed(2)} | оракул ${s3(t.orc)} без27 ${s3(t.orn)} | продажи ${Object.entries(t.sells).map(([k, v]) => k).join(',')}`);
