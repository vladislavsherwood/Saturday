/* Агент 4B, круг 7: сочетание находок и плато.
   Гипотезы: H7a — правило «памп альта в медвежьем рынке» (BP: BTC ниже максимума > b, монета > u от 90-дн. минимума → s) ровное
   по b = 15–30%, u = 250–500%, s = 10/25% поверх R50; H7b — BP и возврат независимы (выигрыши складываются: W25+BP, R50, R50+BP);
   H7c — широкая тихая вершина 60% с возвратом ещё лучше (край плато?); H7d — добавка «счёт перегрева ≥ 3 → 5%» (круг 2) поверх R50+BP
   больше не теряет монету 50 случайных, потому что возврат и BP меняют картину.
   Критерий: строгая ✔ к своей базе, доход > +0,03, соседи в плюсе. Запуск: node app/agent4b_loop7.js (≈3 мин) */
const B = require('./agent4b_sim.js'), K = require('./agent4b_cand.js');
const { c } = B;
const G = B.groups(); K.prep(G);
const SIG = [['fng', 75], ['fund30', 1], ['mvrv', 2.5], ['oth90', 0.5], ['btcup90', 60]];
B.addInd(G, 'heat', (X) => { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) a[i] = SIG.reduce((s, [k, v]) => s + (X.ind[k] && X.ind[k][i] > v ? 1 : 0), 0); return a; });
const base = B.ev(G, B.W25), main = B.ev(G, B.MAIN), R50 = K.R(0.5, 0.1, 45), r50 = B.ev(G, R50);
const BP = (bt = 20, u = 300, s = 0.1) => ({ act: -s, conds: [c('btcath', '>', bt), c('up90', '>', u)] });
const rows = []; const run = (tag, S, b) => { const r = B.ev(G, S); r.tag = tag; r.dd = B.d(r, b); rows.push(r); console.log(B.show(tag, r, b) + (B.passes(r, b) ? '' : ' | ' + B.why(r, b))); return r; };
console.log(B.HDR); console.log(B.show('W25', base, base)); console.log(B.show('R50 к W25', r50, base));
console.log('\nH7a: плато BP поверх R50 (к R50)');
for (const bt of [15, 20, 25, 30]) for (const u of [250, 300, 400, 500]) for (const s of [0.1, 0.25]) run(`R50 + BP ${bt}/${u}/${s * 100}%`, B.ins(R50, [BP(bt, u, s)]), r50);
console.log('\nH7b: независимость (к W25)');
const F = B.ins(R50, [BP()]);
run('W25 + BP 20/300/10%', B.ins(B.W25, [BP()]), base); run('R50', R50, base); run('R50 + BP 20/300/10% (кандидат F)', F, base);
const f = B.ev(G, F); console.log(`F к основе: доход ${B.d(f, main).toFixed(3)}, строгая ${B.passes(f, main) ? '✔' : B.why(f, main)}`);
console.log('\nH7c: размер широкой с возвратом и BP (к W25)');
for (const s of [0.35, 0.4, 0.6, 0.75]) run(`R(${s * 100}%, 10%, 45) + BP`, B.ins(K.R(s, 0.1, 45), [BP()]), base);
console.log('\nH7d: + счёт перегрева ≥ 3 → 5% (к F)');
for (const s of [0.03, 0.05, 0.1]) run(`F + heat ≥ 3 → ${s * 100}%`, B.ins(F, [{ act: -s, conds: [c('heat', '>', 2.5)] }]), f);
require('fs').writeFileSync(B.SCR + '/agent4b_loop7.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, dd: r.dd, m: r.m, n100: r.n100.med }))));
