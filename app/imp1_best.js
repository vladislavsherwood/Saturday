/* imp1, итог: основа combo2 без изменений (ни один вариант 5 кругов не прошёл заранее заданный критерий). Для записи — лучший «почти»
   кандидат круга 4: разворот через 120…300 дней после максимума BTC покупает 25% / 50% резерва вместо всего (строгая ✔, +0,04).
   Проверка на всех группах, 100 новых, метриках дна/вершин, по периодам (до 2025 / с 2025). Сохраняет found/imp1-best.json.
   Запуск: node app/imp1_best.js */
const K = require('./imp1_sim.js');
const fs = require('fs');
const G = K.groups(['sel', 'ex', 'rnd', 'n100']); K.prep1(G);
const c = K.c;
const win = (a, extra = []) => K.mapRev(K.S0, (r) => [{ act: a, conds: [...r.conds, c('bdays', '>', 120), c('bdays', '<', 300), ...extra] }, r]);
K.addInd(G, 'tday', (X) => Float64Array.from(X.t));
const D25 = Date.parse('2025-01-01') / 864e5;
const V = { 'основа combo2': K.S0, '120…300 дн → 25%': win(1.25), '120…300 дн → 50%': win(1.5), '120…300 дн → 50%, только до 2025': win(1.5, [c('tday', '<', D25)]), '120…300 дн → 50%, только с 2025': win(1.5, [c('tday', '>', D25)]) };
const base = K.ev(G, K.S0, true), out = {};
const pick = (s) => ({ med: +s.med.toFixed(1), pos: s.pos, n: s.n, worst: +s.worst.toFixed(2), hpos: s.hpos, hn: s.hn, hworst: +s.hworst.toFixed(2) });
for (const nm in V) {
  const r = nm.startsWith('основа') ? base : K.ev(G, V[nm], true);
  const lg = G.n100.map((X, i) => Math.log1p(r.n100.e[i] / 100) - Math.log1p(base.n100.e[i] / 100)).reduce((p, q) => p + q, 0) / 100;
  out[nm] = { income: +K.d(r, base).toFixed(4), strict: K.passes(r, base), why: K.why(r, base), sel: pick(r.sel), ex: pick(r.ex), rnd: pick(r.rnd), n100: { ...pick(r.n100), betterWorse: K.bw(r, base, 'n100'), meanLog: +lg.toFixed(4) }, metrics: r.m };
  console.log(`${K.show(nm, r, base)} | 100н лучше/хуже ${K.bw(r, base, 'n100').join('/')}, средний лог ${lg.toFixed(4)}\n   ${K.fmtM(r.m)}`);
}
const B = K.BASE;
fs.writeFileSync(__dirname + '/found/imp1-best.json', JSON.stringify({
  name: 'imp1: основа combo2 без изменений (правило разворота BTC не улучшено)',
  base: B.base, rules: B.rules,
  verdict: 'Ни один из ~300 вариантов 5 кругов не прошёл заранее заданный критерий (доход > +0,05 на плато соседних параметров, строгая проверка). Правила — как в found/combo2-best.json.',
  candidate_not_accepted: { name: 'разворот через 120…300 дней после максимума BTC → 50% резерва вместо всего', rules: win(1.5).rules, indicator_bdays: 'дней с последнего дня, когда BTC был в пределах 0,5% от исторического максимума (btcath ≤ 0,5); до 2015 — от 2013-11-29', why_not: 'доход +0,044 ниже порога +0,05; почти целиком один эпизод 2022-03; D1 = 90 вместо 120 съедает половину; обрыв порога 17–18% не сглаживает' },
  results: out, journal: 'app/research/imp1_journal.md',
}, null, 1));
