/* st, круг 2 — «относительная сила к акциям» или просто собственный импульс крипты?
   Двумерные таблицы: избыточный лог-рост монеты за 90 дн (как в круге 1) по корзинам собственного роста за 90 дн × изменения Nasdaq-100 за 90 дн.
   Если у одинакового собственного роста ответ не зависит от NDX — «сила к акциям» ничего не добавляет. То же для BTC (btcr90 × NDX) и DXY.
   Плюс: абсолютный лог-рост монеты за 30/90 дн после продаж на страхе combo6 (12–27) по BTC−NDX 90д — продажа выгодна, если рост < 0. Запуск: node st_r2.js */
const ST = require('./st_lib.js'), { P, S6, polW, FAM, T } = ST;
const XS = ST.ALL();
const f1 = (x) => (isFinite(x) ? (x >= 0 ? '+' : '') + x.toFixed(1) : '—');
function grid(nm, fa, ea, fb, eb, keep = () => true) {
  const na = ea.length + 1, nb = eb.length + 1, acc = []; for (let a = 0; a < na; a++) { acc.push([]); for (let b = 0; b < nb; b++) acc[a].push([]); }
  const bin = (x, e) => { if (!isFinite(x)) return -1; let k = 0; while (k < e.length && x >= e[k]) k++; return k; };
  for (const X of XS) { const I = X.ind, c = X.c, n = X.n; let sa = 0, ma = 0; const s = [], m = []; for (let a = 0; a < na; a++) { s.push(new Array(nb).fill(0)); m.push(new Array(nb).fill(0)); }
    for (let j = 120; j + 90 < n; j++) { if (!keep(I.t[j])) continue; const r = Math.log(c[j + 90] / c[j]); if (!isFinite(r)) continue; sa += r; ma++; const a = bin(fa(I, j), ea), b = bin(fb(I, j), eb); if (a < 0 || b < 0) continue; s[a][b] += r; m[a][b]++; }
    for (let a = 0; a < na; a++) for (let b = 0; b < nb; b++) if (m[a][b] >= 10) acc[a][b].push(s[a][b] / m[a][b] - sa / ma); }
  const lab = (e, k) => `${k ? e[k - 1] : ''}…${k < e.length ? e[k] : ''}`;
  console.log(`\n${nm}`); console.log(`${''.padEnd(14)}${eb.concat([null]).map((_, b) => lab(eb, b).padStart(18)).join('')}`);
  for (let a = 0; a < na; a++) console.log(`${lab(ea, a).padEnd(14)}${acc[a].map((v) => (v.length ? `${f1(v.reduce((x, y) => x + y, 0) / v.length * 100)} (${v.length})` : '—').padStart(18)).join('')}`);
}
grid('монета: свой рост 90д, % (строки) × NDX за 90д, % (столбцы) — избыточный рост монеты за 90 дн, % (монет)', (I, j) => I.ret90[j], [-50, -20, 20, 60], (I, j) => I.st_ndxr90[j], [-5, 5, 12]);
grid('монета: свой рост 90д (строки) × BTC−NDX 90д (столбцы)', (I, j) => I.ret90[j], [-50, -20, 20, 60], (I, j) => I.st_bxr90[j], [-15, 15]);
grid('BTC за 90д, % (btcr90, строки) × NDX за 90д (столбцы)', (I, j) => I.btcr90[j], [-30, 0, 30, 80], (I, j) => I.st_ndxr90[j], [-5, 5, 12]);
grid('BTC за 90д (строки) × DXY за 90д, % (столбцы)', (I, j) => I.btcr90[j], [-30, 0, 30, 80], (I, j) => I.st_dxyr90[j], [-4, -1.5, 1.5, 4]);
grid('BTC/200д (строки) × NDX/200д (столбцы)', (I, j) => I.btc200[j], [0.8, 1, 1.2], (I, j) => I.st_ndx200[j], [0.95, 1, 1.1]);
grid('корр. BTC–NDX 90 (строки) × NDX за 30д (столбцы)', (I, j) => I.st_bxc90[j], [0.2, 0.4], (I, j) => I.st_ndxr30[j], [-8, -3, 3]);
grid('то же, только после 2021-07', (I, j) => I.st_bxc90[j], [0.2, 0.4], (I, j) => I.st_ndxr30[j], [-8, -3, 3], (t) => t >= T('2021-07-01'));
// продажи на страхе: абсолютный рост после
const SP = [['все', () => true], ['BTC−NDX90 < −30', (I, j) => I.st_bxr90[j] < -30], ['−30…−15', (I, j) => I.st_bxr90[j] >= -30 && I.st_bxr90[j] < -15], ['−15…+15', (I, j) => Math.abs(I.st_bxr90[j]) <= 15], ['> +15', (I, j) => I.st_bxr90[j] > 15],
  ['NDX > 200д', (I, j) => I.st_ndx200[j] > 1], ['NDX < 200д', (I, j) => I.st_ndx200[j] < 1], ['NDX у макс ≤3%', (I, j) => I.st_ndxdd[j] < 3], ['DXY 90д < −1,5', (I, j) => I.st_dxyr90[j] < -1.5], ['DXY 90д > +1,5', (I, j) => I.st_dxyr90[j] > 1.5]];
const acc = {}; for (const X of XS) { const I = X.ind, c = X.c, n = X.n; const { tr } = P.edge(X, S6, 0, 'full', true, polW);
  for (const t of tr) { if (t.s > 0 || t.q < 0 || t.i + 90 >= n) continue; const fam = FAM(t.q); if (fam !== 'fear' && fam !== 'euph' && fam !== 'top' && fam !== 'qt' && fam !== 'fund') continue; const j = t.i - 1;
    const r30 = Math.log(c[t.i + 30] / c[t.i]) * 100, r90 = Math.log(c[t.i + 90] / c[t.i]) * 100;
    for (const [s, f] of SP) if (f(I, j)) { const z = ((acc[fam] = acc[fam] || {})[s] = acc[fam][s] || { n: 0, a: 0, b: 0, w: 0, wb: 0, coins: new Set() }); z.n++; z.a += r30; z.b += r90; z.w += t.amt; z.wb += t.amt * r90; z.coins.add(X.name); } } }
console.log('\nпродажи combo6: абсолютный лог-рост монеты после продажи, % — 30д / 90д / 90д взвеш. по сумме (сделок, монет). Минус — продажа выгодна.');
for (const fam of Object.keys(acc)) { console.log(fam); for (const [s] of SP) { const z = acc[fam][s]; if (z) console.log(`   ${s.padEnd(18)} ${f1(z.a / z.n).padStart(6)} ${f1(z.b / z.n).padStart(6)} ${f1(z.wb / z.w).padStart(6)}  (${z.n}, ${z.coins.size})`); } }
