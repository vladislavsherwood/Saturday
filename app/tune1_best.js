/* tune1: итоговый файл found/tune1-best.json — правила (= combo2, изменений нет), таблица «параметр: было → стало, плато», кандидаты.
   Цифры — из scratchpad/tune1/r1…r5.json. Запуск: node app/tune1_best.js */
const T = require('./tune1_sim.js'); const fs = require('fs');
const DIR = (process.env.SCR || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad') + '/tune1';
const J = (f) => (fs.existsSync(DIR + '/' + f) ? JSON.parse(fs.readFileSync(DIR + '/' + f, 'utf8')) : null);
const G = T.Z.load(); const A = T.ev(G, T.S0, ['sel', 'ex', 'rnd', 'n100']);
const R = {}; for (const g in A.S) { R[g] = {}; for (const s of T.Z.SEGS) if (A.S[g][s]) { const { e, ...y } = A.S[g][s]; R[g][s] = y; } }
const r5 = J('r5.json');
const out = {
  name: 'tune1: покупки у дна combo2 (капитуляция, волна ликвидаций, отложенная после выноса) — шлифовка, изменений нет',
  base: T.S0.base, rules: T.S0.rules, rules_count: T.S0.rules.length, same_as: 'found/combo2-best.json (правила один в один)',
  params: [
    { rule: 'капитуляция', param: 'порог страха fng <', was: 10, now: 10, plateau: 'нет (одиночный пик: 9 −0,111, 11 ±0 с ломкой строгой, 12 −0,106); вперёд по времени подбор 13–14 проигрывает −0,02…−0,22', effect: 0 },
    { rule: 'капитуляция', param: 'доля резерва, %', was: 25, now: 25, plateau: '15–35% гладко (±0,02 дохода); любой сдвиг ломает строгую на сотые п.п.', effect: 0 },
    { rule: 'волна ликвидаций', param: 'порог oidd30 <', was: -28, now: -28, plateau: 'нет (острый пик: −28,5 +0,034 ·, −29 −0,024, −27,5 +0,134 · SOL); вперёд по времени подбор −25,5/−23,5 проигрывает −0,13/−0,18', effect: 0 },
    { rule: 'волна ликвидаций', param: 'окно максимума OI, дней', was: 30, now: 30, plateau: '27–37 (результат тот же)', effect: 0 },
    { rule: 'волна ликвидаций', param: 'доля резерва, %', was: 50, now: 50, plateau: '40–60% (+0,004…−0,008), строгая не пускает', effect: 0 },
    { rule: 'отложенная', param: 'окно, дней', was: 20, now: 20, plateau: '14/15–19/20 по медианам (правый край; 21+ −0,025)', effect: 0 },
    { rule: 'отложенная', param: 'порог выноса OI', was: -28, now: -28, plateau: 'нет (пик; −28,5 −0,001, −27,5 −0,074, −29 −0,054); вперёд по времени на всех Y выбирается −28', effect: 0 },
    { rule: 'отложенная', param: 'толпа сейчас lsr >', was: 1.0, now: 1.0, plateau: '0,96–1,00 (≈0); 1,02–1,07 +0,04…+0,06, но строгая · и вне выборки 0', effect: 0 },
    { rule: 'отложенная', param: 'мин. толпы за окно <', was: 0.9, now: 0.9, plateau: '0,80–0,90 (правый край; 0,91+ −0,025)', effect: 0 },
    { rule: 'отложенная', param: 'окно максимума OI, дней', was: 30, now: 30, plateau: '27–37', effect: 0 },
    { rule: 'отложенная', param: 'доля резерва, %', was: 50, now: 50, plateau: '40–70% гладко (−0,010…+0,015), строгая не пускает', effect: 0 },
    { rule: 'отложенная', param: 'дни сигнала', was: 'только первый', now: 'только первый', plateau: 'k2/k3 +0,07…+0,08 (альты), строгая ·, вне выборки ≈0; k5 −0,075, все дни −0,264', effect: 0 },
    { rule: 'все три доли вместе', param: 'сетка 20–30 / 45–60 / 42,5–57,5', was: '25/50/50', now: '25/50/50', plateau: 'доход −0,031…+0,027 по всему кубу; строгую с выигрышем не прошла ни одна точка', effect: 0 },
  ],
  candidate_not_accepted: { rule: 'сразу за волной: oidd30 < −26 → 15% резерва', fast: r5 && r5['после: −26 → 15%'], why: 'строгая: SOL (худшая крупная отбора) 454 → 435%, худшая половина экзамена 13,0 → 12,9; 100 новых: половин 176 → 175; вперёд по времени после 2023 −0,007' },
  results_fast: R,
  margin: 'не менялась (found/combo2-best-margin.json)',
  note: 'Журнал: app/research/tune1_journal.md; скрипты: app/tune1_sim.js, tune1_r1…r5.js, tune1_show.js',
};
fs.writeFileSync(__dirname + '/found/tune1-best.json', JSON.stringify(out, null, 1));
console.log('ok', T.meds(A));
