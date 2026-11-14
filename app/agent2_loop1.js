/* Агент 2, круг 1: устойчивая форма разворота биткоина.
   Сейчас три правила основы используют «BTC +20% за 30 дней» (btcr30 > 20): разворот на страхе — только взнос (не продавать),
   разворот при перегретом фандинге — весь резерв, разворот — весь резерв. Порог 20 — острый пик (у прошлого агента 15 и 25 хуже).
   H1a: тот же порог в новой основе — пик или плато? H1b: другие меры разворота — окно 21/45/60 дней, рост от минимума за 30/60/90 дней
   (btcup), выше средней 20/50 дней; H1c: лесенка возврата резерва (часть на слабом развороте, остальное на сильном) — должна сгладить пик.
   Запуск: node app/agent2_loop1.js */
const A = require('./agent2_sim.js');
const { c } = A;
const G = A.groups(), base = A.ev(G, A.MAIN);
// правила основы с btcr30: 7 (на страхе — только взнос), 8 (при фандинге — весь резерв), 13 (разворот — весь резерв)
const isRev = (r) => A.has(r, 'btcr30');
const swap = (r, cond) => ({ ...r, conds: r.conds.map((cd) => (cd.ind === 'btcr30' ? cond : cd)) });
// rev: cond7 — условие «разворот на страхе», cond8 — «разворот при фандинге», ladder — [[условие, act], ...] вместо правила 13
function rev(cond7, cond8, ladder) {
  return A.mapRules(A.MAIN, (r, i) => {
    if (!isRev(r)) return r;
    if (r.act === 1) return cond7 ? swap(r, cond7) : null;
    if (A.has(r, 'fund30')) return cond8 ? swap(r, cond8) : null;
    return ladder.map(([cd, act]) => ({ act, conds: [cd] }));
  });
}
const rows = [];
const run = (tag, X, fam) => { const r = A.ev(G, X); r.tag = tag; r.fam = fam; r.dd = A.d(r, base); rows.push(r); console.log(A.show(tag, r, base)); return r; };
console.log(A.HDR); console.log(A.show('основа', base, base));
console.log('\nH1a: порог btcr30 во всех трёх правилах');
for (const T of [12, 15, 17, 18, 19, 20, 21, 22, 23, 25, 28, 30]) { const cd = c('btcr30', '>', T); run(`btcr30 > ${T}`, rev(cd, cd, [[cd, 2]]), 'a'); }
console.log('\nH1b: окно 21/45/60 дней');
for (const w of [21, 45, 60]) for (const T of [15, 20, 25, 30, 35, 40]) { const cd = c('btcr' + w, '>', T); run(`btcr${w} > ${T}`, rev(cd, cd, [[cd, 2]]), 'b' + w); }
console.log('\nH1b: рост от минимума за N дней (btcup)');
for (const w of [30, 60, 90]) for (const T of [15, 20, 25, 30, 35, 40, 50, 60]) { const cd = c('btcup' + w, '>', T); run(`btcup${w} > ${T}`, rev(cd, cd, [[cd, 2]]), 'u' + w); }
console.log('\nH1b: выше средней (bsma) и рост за 30 дней');
for (const w of [20, 50]) for (const k of [1.05, 1.1, 1.15]) for (const T of [10, 15]) { const cds = [c('bsma' + w, '>', k), c('btcr30', '>', T)]; const X = A.mapRules(A.MAIN, (r) => (isRev(r) ? { ...r, conds: [...r.conds.filter((cd) => cd.ind !== 'btcr30'), ...cds] } : r)); run(`bsma${w} > ${k} и btcr30 > ${T}`, X, 's'); }
console.log('\nH1c: лесенка возврата резерва (правило 13 → ступени), правила 7/8 — на нижней или на 20');
for (const [lo, hi, f] of [[15, 25, 0.5], [15, 25, 0.25], [15, 20, 0.5], [17, 23, 0.5], [12, 20, 0.5], [15, 30, 0.5], [10, 20, 0.5], [12, 25, 0.5], [18, 25, 0.5], [15, 22, 0.5], [17, 25, 0.5], [15, 25, 0.75]]) {
  for (const k78 of ['lo', '20', 'hi']) {
    const t = k78 === 'lo' ? lo : k78 === 'hi' ? hi : 20, cd = c('btcr30', '>', t);
    run(`лесенка ${lo}%→${f * 100}% резерва, ${hi}%→весь; правила 7/8 при ${t}`, rev(cd, cd, [[c('btcr30', '>', hi), 2], [c('btcr30', '>', lo), 1 + f]]), `L${k78}`);
  }
}
console.log('\nH1c: три ступени 15/20/25');
for (const sh of [-3, -2, 0, 2, 3]) for (const fs of [[0.25, 0.5], [0.33, 0.5], [0.5, 0.5]]) {
  const t = [15 + sh, 20 + sh, 25 + sh], cd = c('btcr30', '>', t[0]);
  run(`3 ступени ${t.join('/')}: ${fs[0] * 100}%/${fs[1] * 100}%/весь; 7/8 при ${t[0]}`, rev(cd, cd, [[c('btcr30', '>', t[2]), 2], [c('btcr30', '>', t[1]), 1 + fs[1]], [c('btcr30', '>', t[0]), 1 + fs[0]]]), 'L3');
  const cd2 = c('btcr30', '>', t[1]);
  run(`3 ступени ${t.join('/')}: ${fs[0] * 100}%/${fs[1] * 100}%/весь; 7/8 при ${t[1]}`, rev(cd2, cd2, [[c('btcr30', '>', t[2]), 2], [c('btcr30', '>', t[1]), 1 + fs[1]], [c('btcr30', '>', t[0]), 1 + fs[0]]]), 'L3m');
}
require('fs').writeFileSync(process.env.OUT || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent2_loop1.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, fam: r.fam, dd: r.dd, pass: A.passes(r, base), sel: r.sel, ex: r.ex, rnd: r.rnd, n100: r.n100, m: r.m }))));
