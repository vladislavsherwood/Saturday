/* Агент «АЛЬТЫ», круг 1: карта чувствительности — каждое правило основы с размером ×0 / ×0,5 / ×1,5 только у альтов (флаг isalt).
   Гипотеза (заранее): у альтов слишком крупные рыночные продажи на страхе (#15, #17: продают монету в её собственном росте) и слишком
   ранние покупки паники (#3–#8: резерв уходит в падение до настоящего дна). Признак «правило мешает альтам»: изменение размера только у альтов
   даёт плюс медианы альтов одного знака на отборе, экзамене, 50 случайных и 100 новых.
   Запуск: node app/seg_alt_loop1.js <out.json> */
const Q = require('./seg_alt_sim.js');
const fs = require('fs');
const { c } = Q;
const G = Q.load(); Q.addAltFlag(G);
const B = Q.BASE, rb = Q.evs(G, B);
const scaleAct = (r, k) => (r.act < 0 ? Math.max(-1, r.act * k) : 1 + Math.min(1, (r.act - 1) * k));
// копия правила q с размером ×k и условием isalt > 0.5 перед исходным
const altScale = (S, qs, k, extra = []) => ({ ...S, rules: S.rules.flatMap((r, q) => (qs.includes(q) ? [{ act: +scaleAct(r, k).toFixed(6), conds: [...r.conds, c('isalt', '>', 0.5), ...extra] }, r] : [r])) });
const out = [];
const name = (q) => `#${q} ${B.rules[q].act} ${B.rules[q].conds.map((x) => x.ind + x.op + x.v).join('&')}`;
const groupsOf = { 'продажи на страхе #14-17': [14, 15, 16, 17], 'паника #3-8': [3, 4, 5, 6, 7, 8], 'паника без страха #11-13': [11, 12, 13], 'разворот #9,#10,#18': [9, 10, 18], 'тихая вершина #21-24': [21, 22, 23, 24], 'фандинг #19,20': [19, 20], 'дно #0-2': [0, 1, 2], 'памп #26,27': [26, 27], 'возврат #25': [25] };
const L = [];
for (let q = 0; q < B.rules.length; q++) if (B.rules[q].act !== 1) for (const k of [0, 0.5, 1.5]) L.push([`${name(q)} ×${k}`, altScale(B, [q], k)]);
for (const g in groupsOf) for (const k of [0, 0.5, 0.75, 1.25, 1.5]) L.push([`ГРУППА ${g} ×${k}`, altScale(B, groupsOf[g], k)]);
for (const [t, S] of L) {
  const r = Q.evs(G, S);
  const dm = Q.GR.map((g) => r[g].alt.med - rb[g].alt.med), sign = dm.every((x) => x > 0) ? '+' : dm.every((x) => x < 0) ? '−' : '±';
  const o = { t, dm, sign, dAlt: Q.inc(r, 'alt') - Q.inc(rb, 'alt'), sAlt: Q.strict(r, rb, 'alt'), n100: { med: r.n100.alt.med, pos: r.n100.alt.pos, hpos: r.n100.alt.hpos, bw: Q.bw(r, rb, 'n100', 'alt') } };
  out.push(o);
  console.log(`${sign} доход альтов ${o.dAlt >= 0 ? '+' : ''}${o.dAlt.toFixed(3)} | Δмед отбор/экз/50/100н ${dm.map((x) => x.toFixed(0)).join('/')} | 100н альты плюс ${o.n100.pos} пол ${o.n100.hpos} лучше/хуже ${o.n100.bw.join('/')} | строгая альты ${o.sAlt.length ? '· ' + o.sAlt.join(',') : '✔'} | ${t}`);
}
console.log(`\nоснова: альты пол 100н ${rb.n100.alt.hpos}, плюс ${rb.n100.alt.pos}`);
fs.writeFileSync(process.argv[2], JSON.stringify(out));
