/* Агент «ЛОУКАП», круг 0: выборка, данные, основа на лоукапах и где она ошибается.
   Запуск: node app/lowcap_loop0.js */
const L = require('./lowcap_sim.js'), K = L.K;
const G = L.load(), S0 = L.S0;
const r0 = L.evs(G, S0);
const pct = (v) => v.toFixed(0);
// 1. данные: доступность рядов
{
  const all = [...G.lsel, ...G.lchk], first = (X, k) => { const a = X.ind[k]; for (let i = 0; i < X.n; i++) if (!isNaN(a[i]) && a[i] !== 0) return i; return -1; };
  const cnt = (k) => all.filter((X) => first(X, k) >= 0).length, dmin = (k) => all.map((X) => first(X, k)).filter((i) => i >= 0);
  console.log('Данные лоукапов: монет', all.length, '| отбор', G.lsel.length, 'проверка', G.lchk.length);
  for (const k of ['vusd', 'mc', 'hv', 'cf', 'coi']) { const ds = all.map((X) => { const i = first(X, k); return i >= 0 ? L.day(X, i) : null; }).filter(Boolean).sort(); console.log(`  ${k}: есть у ${cnt(k)} монет; самая ранняя дата ${ds[0]}, медиана начала ${ds[Math.floor(ds.length / 2)]}`); }
  const ds = all.map((X) => L.day(X, 0)).sort(); console.log('  начало истории (после 20 дней разогрева): от', ds[0], 'медиана', ds[Math.floor(ds.length / 2)], 'до', ds[ds.length - 1]);
  const yrs = {}; all.forEach((X) => { const y = L.day(X, 0).slice(0, 4); yrs[y] = (yrs[y] || 0) + 1; }); console.log('  по году начала:', JSON.stringify(yrs));
  const est = all.filter((X) => X.low.sup_est > 30).map((X) => `${X.name}(${X.low.sup_est})`); console.log('  капитализация оценена (нет у CMC в начале) >30 дней:', est.join(' '));
  const mem = all.filter((X) => X.meme).length, ai = all.filter((X) => X.low.ai).length; console.log(`  мемы по тегу CMC: ${mem}, ИИ-агенты: ${ai}`);
  const overlap = all.filter((X) => [...G.sel, ...G.ex, ...G.rnd, ...G.n100].some((Y) => Y.name === X.name)).map((X) => X.name + '/' + X.part); console.log('  пересечение со стандартным стендом:', overlap.join(' '));
}
// 2. основа на группах
console.log('\nОснова (combo-best F + C1.25 + C6), итог к DCA, %: медиана / в плюсе / половин в плюсе / худшая половина / средний лог');
for (const g of ['lsel', 'lchk', 'sel', 'ex', 'rnd', 'n100']) { const s = L.st(r0[g]); console.log(`  ${g.padEnd(5)} n=${s.n} ${pct(s.med)} / ${s.pos} / ${s.hpos} из ${2 * s.n} / ${pct(s.hworst)} / ${s.mlog.toFixed(3)}`); }
// удержание (купить всё в первый день) к DCA
const hold = (X) => { let du = 0; for (let i = 0; i < X.n; i++) du += 10 / X.c[i]; return ((10 * X.n / X.c[0]) / du - 1) * 100; };
for (const g of ['lsel', 'lchk']) {
  const rows = G[g].map((X, i) => ({ X, e: r0[g][i] })).sort((a, b) => a.e.f - b.e.f);
  console.log(`\n${g}: монета итог (1-я/2-я половина) | удержание к DCA | капитализация медиана, млн $ | начало`);
  console.log('  ' + rows.map(({ X, e }) => `${X.name} ${pct(e.f)} (${pct(e.h1)}/${pct(e.h2)}) h${pct(hold(X))} mc${pct(L.med([...X.ind.mcm].filter((v) => v > 0)))} ${L.day(X, 0).slice(0, 7)}`).join('\n  '));
}
// 3. разбор сделок по типам правил: лоукапы против монет стенда
const lbl = (r) => { const s = r.conds.map((q) => q.ind).join(','); if (r.act > 1) return s.includes('ago_qt') ? 'возврат' : s.includes('usdt') ? 'паника' : s.includes('btcr30') ? 'разворот' : s.includes('dly') ? 'вынос' : s.includes('oidd30') ? 'OI' : 'fng<10';
  return s.includes('up90') ? 'памп' : s.includes('oth90') ? 'шир.тихая' : s.includes('qt') ? 'тихая' : s.includes('fund30') ? 'фандинг' : r.conds.some((q) => q.v === 40) ? 'сил.страх' : 'страх'; };
const H = [30, 90, 180];
function diag(A, tag, filt = () => true) {
  const acc = {}; let tot = 0; const ex = {};
  for (const X of A) {
    const R = S0.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])), tr = K.edge(X, S0, 0, 'full', true).tr, c = X.c, n = X.n;
    for (const t of tr) {
      if (!filt(X, t)) continue;
      const Lb = (t.s > 0 ? 'BUY ' : 'SELL ') + lbl(R[t.q]), o = (acc[Lb] = acc[Lb] || { amt: 0, r: H.map(() => [0, 0]), bad: 0, k: 0 }); tot += t.amt; o.amt += t.amt; o.k++;
      H.forEach((h, q) => { if (t.i + h < n) { o.r[q][0] += t.amt * (c[t.i + h] / t.p - 1); o.r[q][1] += t.amt; } });
      let fmx = 0, fmn = Infinity; for (let j = t.i; j < Math.min(n, t.i + 120); j++) { fmx = Math.max(fmx, c[j]); fmn = Math.min(fmn, c[j]); }
      const bad = (t.s < 0 && fmx > 2 * t.p) || (t.s > 0 && fmn < 0.5 * t.p); if (bad) { o.bad += t.amt; (ex[Lb] = ex[Lb] || []).push(`${X.name} ${L.day(X, t.i)} ${t.s > 0 ? 'дальше ' + pct(100 * (fmn / t.p - 1)) : 'дальше +' + pct(100 * (fmx / t.p - 1))}%`); }
    }
  }
  console.log(`\nСделки ${tag}: доля денег | монета через 30/90/180 дн (взвеш. деньгами) | «ошибок» (продажа → ×2 за 120 дн, покупка → −50%) | сделок`);
  for (const k of Object.keys(acc).sort()) { const o = acc[k]; console.log(`  ${k.padEnd(16)} ${(100 * o.amt / tot).toFixed(1).padStart(5)}% | ${o.r.map((x) => (x[1] ? pct(100 * x[0] / x[1]) : '-').padStart(5)).join(' ')}% | ${pct(100 * o.bad / o.amt).padStart(3)}% | ${o.k}`); }
  return ex;
}
const exL = diag([...G.lsel], 'лоукапов (отбор)');
diag([...G.lsel], 'лоукапов (отбор), до ' + L.LD.split_date, (X, t) => X.t[t.i] < L.SPLIT);
diag([...G.lsel], 'лоукапов (отбор), после ' + L.LD.split_date, (X, t) => X.t[t.i] >= L.SPLIT);
diag([...G.sel, ...G.ex, ...G.rnd], 'стандартного стенда (отбор+экзамен+50 случ.)');
console.log('\nПримеры «ошибок» на отборе лоукапов:');
for (const k of Object.keys(exL)) console.log(`  ${k}: ${exL[k].length} сделок, напр. ${exL[k].filter((_, i) => i % Math.max(1, Math.floor(exL[k].length / 6)) === 0).slice(0, 6).join('; ')}`);
// 4. метрики дна/вершин
const m = K.metrics(G.lsel, S0), ms = K.metrics([...G.sel, ...G.ex, ...G.rnd], S0);
console.log('\nМетрики, отбор лоукапов:', K.fmtM(m)); console.log('Метрики, стенд:', K.fmtM(ms));
// 5. паника у вершины монеты: доля денег паники при ddm90 < 35 (монета ближе 35% к своему 90-дн. максимуму)
for (const [tag, A] of [['лоукапы отбор', G.lsel], ['стенд', [...G.sel, ...G.ex, ...G.rnd]]]) {
  let a = 0, b = 0, ra = [0, 0], rb = [0, 0];
  for (const X of A) { const R = S0.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])), tr = K.edge(X, S0, 0, 'full', true).tr;
    for (const t of tr) if (t.s > 0 && lbl(R[t.q]) === 'паника') { const near = X.ind.ddm90[t.i] < 35, f = t.i + 90 < X.n ? X.c[t.i + 90] / t.p - 1 : NaN; if (near) { a += t.amt; if (!isNaN(f)) { ra[0] += t.amt * f; ra[1] += t.amt; } } else { b += t.amt; if (!isNaN(f)) { rb[0] += t.amt * f; rb[1] += t.amt; } } } }
  console.log(`Паника ${tag}: у вершины монеты (ddm90<35) ${pct(100 * a / (a + b))}% денег, через 90 дн ${pct(100 * ra[0] / ra[1])}%; остальные ${pct(100 * rb[0] / rb[1])}%`);
}
