/* Агент 4E, круг 6: продажа на быстром росте открытого интереса (плечи набираются) — подробно.
   H6a: сигнал держится на многих эпизодах (событийный разбор: ETH OI в монетах за 30 дн. > 35%, BTC OI в монетах за 30 дн. > 25/35%).
   H6b: плато по порогу (25…60%), размеру (10/25/40%) и месту правила; BTC OI (история с 2020-09, на цикл длиннее) даёт то же, что ETH.
   H6c: «любой из двух» / «оба» сильнее одного.
   Критерий (заранее): плато ≥ +0,1 на 3 соседних порогах и 2 размерах; вариант для выбора — проходит строгую проверку или проигрывает
   в ней не больше одной монеты/половины; на 100 новых не хуже W25. Запуск: node app/agent4e_loop6.js */
const E = require('./agent4e_sim.js');
const { c } = E;
const G = E.groups(['sel', 'ex', 'rnd', 'n100']), base = E.ev(G, E.W25, true);
// событийный разбор
const B = G.sel.find((x) => x.name === 'BTC'), n = E.T1 - E.T0 + 1, oic30 = new Float64Array(n).fill(NaN);
for (let i = 0; i < B.n; i++) { const d = B.t[i] - E.T0; if (d >= 0) oic30[d] = B.ind.oic30[i]; }
for (const [tag, f] of [['ETH OI за 30д > 35%', (d) => E.CAL.eoic30[d] > 35], ['BTC OI за 30д > 25%', (d) => oic30[d] > 25], ['BTC OI за 30д > 35%', (d) => oic30[d] > 35]]) for (const coin of ['BTC', 'ETH']) {
  const Ep = E.episodes(f, { coin, from: E.dayOf('2020-09-01') }), s = E.sumEp(Ep, 90);
  console.log(`\n${tag}, цена ${coin}: эпизодов ${s.n}, 90д мед ${s.med.toFixed(0)}%, в минусе ${Ep.filter((e) => e.r90 < 0).length}, вход к макс.±90 ${s.toHi.toFixed(0)}%\n    ${E.fmtEp(Ep)}`);
}
const R = E.W25.rules, iFear = R.findIndex((r) => r.act === -0.3), i13 = R.findIndex((r) => r.act === 2 && r.conds.length === 1 && r.conds[0].ind === 'btcr30');
const PL = { 'перед страхом': (rule) => [...R.slice(0, iFear), rule, ...R.slice(iFear)], 'после разворота': (rule) => [...R.slice(0, i13 + 1), rule, ...R.slice(i13 + 1)], 'в конце': (rule) => [...R, rule] };
console.log('\n' + E.HDR); console.log(E.show('W25', base, base));
const rows = [], cell = (r) => `${r.d >= 0 ? '+' : ''}${r.d.toFixed(2)}${r.pass ? '✔' : r.nf <= 1 ? '~' : ' '}`;
const nfail = (r) => E.why(r, base).split('; ').filter(Boolean).length;
const IND = { 'ETH OI': (v) => [c('eoic30', '>', v)], 'BTC OI': (v) => [c('oic30', '>', v)] };
console.log('\nдоход к W25 (✔ строгая пройдена, ~ не пройден 1 пункт); пороги: 25 30 35 40 50 60');
for (const [nm, f] of Object.entries(IND)) for (const pl of Object.keys(PL)) for (const a of [0.1, 0.25, 0.4]) {
  const line = [];
  for (const v of [25, 30, 35, 40, 50, 60]) { const S = { ...E.W25, rules: PL[pl]({ act: -a, conds: f(v) }) }, r = E.ev(G, S, false); r.d = E.d(r, base); r.pass = E.passes(r, base); r.nf = nfail(r); rows.push({ nm, pl, a, v, d: r.d, pass: r.pass, why: E.why(r, base), n100: r.n100.med, n100pos: r.n100.pos, n100h: r.n100.hpos }); line.push(cell(r).padStart(7)); }
  console.log(`${nm} ${pl.padEnd(16)} ${String(a * 100).padStart(2)}% | ${line.join(' ')}`);
}
console.log('\nH6c: любой из двух / оба (порог ETH 35, BTC 25), перед страхом, 25%');
for (const [tag, rules] of [['любой', [{ act: -0.25, conds: [c('eoic30', '>', 35)] }, { act: -0.25, conds: [c('oic30', '>', 25)] }]], ['оба', [{ act: -0.25, conds: [c('eoic30', '>', 35), c('oic30', '>', 25)] }]]]) {
  const S = { ...E.W25, rules: [...R.slice(0, iFear), ...rules, ...R.slice(iFear)] }, r = E.ev(G, S, true); console.log(E.show(tag, r, base) + ' | ' + E.why(r, base));
}
const top = rows.filter((r) => r.d > 0.1).sort((x, y) => (y.pass - x.pass) || (x.why.split(';').length - y.why.split(';').length) || y.d - x.d).slice(0, 10);
console.log('\nлучшие (сначала по строгой проверке):'); for (const t of top) console.log(`  ${t.nm} ${t.pl} > ${t.v}% → ${t.a * 100}%: ${t.d.toFixed(3)} | 100н ${t.n100.toFixed(0)}/${t.n100pos}/${t.n100h} | ${t.pass ? '✔' : t.why}`);
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent4e_loop6.json', JSON.stringify(rows));
