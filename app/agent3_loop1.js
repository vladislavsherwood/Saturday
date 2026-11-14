/* Агент 3, круг 1: защита резерва на уровне самой монеты. Гипотеза: резерв тратится на монету, которая разваливается после пампа
   (пример MYX: памп ×180, потом −99,7%), рыночные сигналы дна это не видят. Если в такие дни не тратить резерв (только взнос или
   пропустить правило покупки), стратегия сохранит деньги для других дней/продаж.
   Семейства признаков (только прошлое): F1 просадка монеты от максимума за W дней > X%; F2 был памп ×N за W дней (рост от 180-дн.
   минимума) и просадка от максимума за W дней > X%; F3 монета ниже своей средней 200 (sma200 < s); F4 молодая монета (возраст < D дней).
   Режимы: dca — в такой день только взнос; skip — правило покупки не срабатывает (день уходит дальше по списку).
   Критерий (заранее): строгая проверка к W25 на отборе/экзамене/50 случайных + доход > +0,03 + соседние пороги тоже в плюсе.
   100 новых — только для отчёта. Запуск: node app/agent3_loop1.js > log */
const A = require('./agent3_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.W25), out = [];
const W = [90, 180, 365];
for (const w of W) A.addInd(G, 'ru' + w, (X) => A.runup(X, 180, w));
console.log(A.HDR); console.log(A.row('W25', base, base));
const run = (tag, flag, mk) => {
  A.addInd(G, flag, mk);
  for (const mode of ['dca', 'skip']) { const r = A.ev(G, A.guard(A.W25, flag, mode)); const s = A.row(`${tag} [${mode}]`, r, base); console.log(s); out.push({ tag, mode, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, n100pos: r.n100.pos, n100h: r.n100.hpos, bw: A.bw(r, base, 'n100'), m: r.m, rnd: r.rnd.med, sel: r.sel.med, ex: r.ex.med }); }
};
for (const w of W) for (const x of [50, 60, 70, 80, 90]) run(`F1 просадка от макс. ${w} дн > ${x}%`, `f1_${w}_${x}`, (X) => A.flagOf(X.n, (i) => X.ind['ddm' + w][i] > x));
for (const w of W) for (const nn of [3, 5, 10]) for (const x of [50, 70, 85]) run(`F2 памп ×${nn} за ${w} дн и просадка > ${x}%`, `f2_${w}_${nn}_${x}`, (X) => A.flagOf(X.n, (i) => X.ind['ru' + w][i] > nn && X.ind['ddm' + w][i] > x));
for (const s of [0.3, 0.4, 0.5, 0.6, 0.7]) run(`F3 монета < ${s} своей средней 200`, `f3_${s}`, (X) => A.flagOf(X.n, (i) => X.ind.sma200[i] < s));
for (const dd of [90, 180, 365]) run(`F4 возраст < ${dd} дней`, `f4_${dd}`, (X) => A.flagOf(X.n, (i) => i < dd));
fs.writeFileSync(process.argv[2] || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/a3/loop1.json', JSON.stringify(out));
