/* Точки входа в крипто-стратегии «Тихая вершина».
   Часть 1 — разбор: каждый день, когда стратегия вкладывала резерв, — каким правилом, по какой цене, что было с ценой потом,
   насколько вход выше ближайшего дна; сколько резерв простаивал, пока монета росла.
   Часть 2 — гипотезы, как входить точнее; проверка на 17 монетах отбора, 14 экзаменационных и 50 случайных.
   Запуск: node app/crypto_entries.js <папка со страницами> */
const fs = require('fs');
const { lab, c, med, stable, report } = require('./lab.js');
const A = JSON.parse(fs.readFileSync(__dirname + '/found/gentle-impulse.json', 'utf8'));
const [PANIC, ST, WK, RB] = A.rules, QT = { act: -0.1, conds: [c('qt', '>', 0.5)] };
const BASE = { base: 1, rules: [PANIC, ST, WK, RB, QT] };

const diagnose = ({ S, unit }) => {
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW), out = [];
  for (const k of SETS.avg) {
    setup(k, true);
    const ind = {}; for (const key in IND) ind[key] = IND[key].v;
    let cash = 0, units = 0, idleDays = 0, idleMiss = 0;
    const ev = [];
    for (let i = 0; i < N; i++) {
      const p = H.c[i], j = i - 1; let a = S.base, rule = -1;
      if (j >= 0) for (let r = 0; r < S.rules.length; r++) { let ok = true; for (const cd of S.rules[r].conds) { const v = ind[cd.ind] ? ind[cd.ind][j] : NaN; if (!(cd.op === '<' ? v < cd.v : v > cd.v)) { ok = false; break; } } if (ok) { a = S.rules[r].act; rule = r; break; } }
      const before = cash; cash += unit;
      if (a < 0) { const amt = -a * units * p; units += a * units; cash += amt * 0.999; }
      else if (a > 0) { const amt = Math.min(cash, unit + (a - 1) * before); units += (amt * 0.999) / p; cash -= amt;
        if (amt > unit * 3) {
          const w = (n) => H.c.slice(i, Math.min(N, i + n)), lo90 = Math.min(...w(90)), f = (n) => (i + n < N ? (H.c[i + n] / p - 1) * 100 : null);
          ev.push({ coin: RAW.ticker, t: H.t[i], rule, amt, f30: f(30), f90: f(90), f180: f(180), above: (p / lo90 - 1) * 100, prevlo: (p / Math.min(...H.c.slice(Math.max(0, i - 90), i + 1)) - 1) * 100 });
        } }
      const eq = cash + units * p;
      if (eq > 0 && cash / eq > 0.5 && i + 90 < N) { idleDays++; if (H.c[i + 90] / p > 1.3) idleMiss++; }
    }
    out.push({ coin: RAW.ticker, n: N, ev, idleDays, idleMiss });
  }
  setup(cur, true);
  return out;
};

const L = [{ tag: 'ТЕКУЩАЯ (Тихая вершина)', S: BASE }];
const add = (kind, tag, rules) => L.push({ kind, tag, S: { base: 1, rules } });
// гипотезы о входе
for (const x of [1.0, 1.02]) add('reclaim', `возврат: биткоин поднялся выше средней 200 (до ${x}) → весь резерв`, [PANIC, ST, WK, RB, { act: 2, conds: [c('btc200', '>', 1), c('btc200', '<', x + 0.0001)] }, QT]);
for (const dd of [40, 55]) for (const r of [10, 15]) add('deep', `возврат раньше: биткоин ниже максимума на ${dd}%+ и вырос на ${r}% за 30 дней → весь резерв`, [PANIC, ST, WK, RB, { act: 2, conds: [c('btcath', '>', dd), c('btcr30', '>', r)] }, QT]);
for (const f of [10, 15, 20]) for (const g of [1.25, 1.5]) add('capit', `капитуляция: страх ниже ${f} → взнос и ${Math.round((g - 1) * 100)}% резерва`, [{ act: g, conds: [c('fng', '<', f)] }, PANIC, ST, WK, RB, QT]);
for (const [r1, g1] of [[10, 1.25], [10, 1.5], [15, 1.5]]) add('staged', `ступенчатый возврат: биткоин +${r1}% за 30 дней → ${Math.round((g1 - 1) * 100)}%, +20% → весь`, [PANIC, ST, WK, RB, QT, { act: g1, conds: [c('btcr30', '>', r1)] }]);
for (const r of [25, 40]) add('own', `своя сила монеты: монета +${r}% за 30 дней и выше средней 50 → весь резерв`, [PANIC, ST, WK, RB, QT, { act: 2, conds: [c('ret30', '>', r), c('sma50', '>', 1)] }]);
for (const [u, o, g] of [[1.05, 25, 1.5], [1.1, 25, 1.5], [1.07, 27, 1.5], [1.07, 25, 2], [1.05, 27, 2]]) add('panic', `паника в стейблах: USDT.D к средней > ${u}, альты < ${o}% → взнос и ${g >= 2 ? 'весь' : Math.round((g - 1) * 100) + '%'} резерва`, [{ act: g, conds: [c('usdt', '>', u), c('othd', '<', o)] }, ST, WK, RB, QT]);
for (const d of [-0.5, 5]) add('confirm', `паника в стейблах только когда страх уже слабеет (страх за 7 дней ${d > 0 ? 'вырос на 5+' : 'не падает'})`, [{ act: 1.5, conds: [...PANIC.conds, c('fngd7', '>', d)] }, ST, WK, RB, QT]);
for (const k of [3, 4]) for (const g of [1.5, 2]) add('bottom', `маркеров дна ≥ ${k} → взнос и ${g >= 2 ? 'весь' : '50%'} резерва`, [{ act: g, conds: [c('botm', '>', k - 0.5)] }, PANIC, ST, WK, RB, QT]);
for (const n of [45, 90]) add('exhaust', `усталость продаж: сигнал продажи держится ${n}+ дней, а страх за 30 дней вырос на 10+ → половина резерва`, [PANIC, { act: 1.5, conds: [c('selld', '>', n), c('fngd30', '>', 10)] }, ST, WK, RB, QT]);

(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  // ---------- 1. разбор входов текущей стратегии ----------
  const D = [];
  for (const g of ['own', 'valid', 'exam', 'memes']) D.push(...(await lb.pages[g].evaluate(diagnose, { S: BASE, unit: 10 })));
  const ev = D.flatMap((d) => d.ev), RULE = { 0: 'паника в стейблах', 3: 'разворот биткоина' };
  console.log(`=== 1. ВХОДЫ ТЕКУЩЕЙ СТРАТЕГИИ: ${D.length} монет, крупных вложений резерва (больше трёх взносов): ${ev.length} ===`);
  for (const r of [0, 3]) {
    const e = ev.filter((x) => x.rule === r), m = (k) => med(e.map((x) => x[k]).filter((v) => v != null));
    if (!e.length) continue;
    console.log(`${RULE[r]}: ${e.length} вложений | цена через 30 / 90 / 180 дней: ${m('f30').toFixed(0)}% / ${m('f90').toFixed(0)}% / ${m('f180').toFixed(0)}% | вход выше будущего минимума за 90 дней на ${m('above').toFixed(0)}% (медиана)`
      + ` | выше прошлого минимума за 90 дней на ${m('prevlo').toFixed(0)}% | потом можно было купить на 20%+ дешевле: ${(100 * e.filter((x) => x.above > 25).length / e.length).toFixed(0)}% случаев`);
  }
  const big = ev.filter((x) => x.rule === 3).reduce((o, x) => { const d = new Date(x.t * 864e5).toISOString().slice(0, 7); (o[d] = o[d] || []).push(x); return o; }, {});
  console.log('  разворот биткоина по месяцам (вложений; медиана «выше будущего минимума»; цена через 90 дней): ' + Object.entries(big).sort().map(([m, a]) => `${m}: ${a.length}; ${med(a.map((x) => x.above)).toFixed(0)}%; ${med(a.map((x) => x.f90).filter((v) => v != null)).toFixed(0)}%`).join(' | '));
  const idle = D.reduce((s, d) => s + d.idleDays, 0), miss = D.reduce((s, d) => s + d.idleMiss, 0), days = D.reduce((s, d) => s + d.n, 0);
  console.log(`простой резерва: больше половины счёта в деньгах ${(100 * idle / days).toFixed(0)}% всех дней; из них в ${(100 * miss / Math.max(1, idle)).toFixed(0)}% дней монета за следующие 90 дней выросла на 30%+`);

  // ---------- 2. гипотезы ----------
  const rows = await lb.run(L); await lb.close();
  const base = rows[0];
  console.log(`\n=== 2. ГИПОТЕЗЫ О ВХОДЕ (${rows.length - 1} вариантов) ===\n${base.tag}\n${report(base)}`);
  const okS = (r) => stable(r, base, 'sel') && r.sel.med > base.sel.med, okE = (r) => stable(r, base, 'ex') && r.ex.med > base.ex.med, okR = (r) => r.rnd.pos >= base.rnd.pos && r.rnd.worst >= base.rnd.worst - 0.5 && r.rnd.med > base.rnd.med;
  for (const kind of [...new Set(rows.slice(1).map((r) => r.kind))]) {
    const pool = rows.filter((r) => r.kind === kind);
    console.log(`\n[${kind}] вариантов ${pool.length}; лучше на отборе ${pool.filter(okS).length}; и на экзамене ${pool.filter((r) => okS(r) && okE(r)).length}; и на 50 случайных ${pool.filter((r) => okS(r) && okE(r) && okR(r)).length}`);
    const sc = (r) => r.sel.worst + r.sel.hworst + r.sel.med / 5;
    for (const r of [...pool].sort((x, y) => sc(y) - sc(x)).slice(0, 2)) console.log(`  ${r.tag} ${okS(r) ? (okE(r) ? (okR(r) ? '✔✔✔' : '✔✔') : '✔') : '✘'}\n${report(r)}`);
  }
})();
