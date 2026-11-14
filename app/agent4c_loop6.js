/* Агент 4C, круг 6: проверка кандидатов «слабее рынка → продажи крупнее» строгой проверкой против исходной основы (main-crypto.json).
   W25 строгую проверку к основе не проходит по одному пункту (TON, худшая половина отбора −7,8% против −7,0%), а правило круга 2–5
   поднимает TON. Гипотеза (заранее): часть плато «W25 + продажи крупнее у слабых к BTC монет» проходит строгую проверку к основе целиком
   (чего не делает сам W25) и при этом доход к основе выше, чем у W25. Сетка: окно 90/180, порог −10/−15/−20/−25, множитель ×1,25/×1,5/×1,75.
   Запуск: node app/agent4c_loop6.js <out.json> > log */
const A = require('./agent4c_sim.js');
const fs = require('fs');
const G = A.groups(), main = A.ev(G, A.MAIN), w25 = A.ev(G, A.W25), out = [];
console.log(A.HDR); console.log(A.row('основа', main, main)); console.log(A.row('W25 к основе', w25, main) + ' | ' + A.why(w25, main));
for (const w of [90, 180]) for (const v of [-10, -15, -20, -25]) {
  const key = `c6_${w}_${v}`; A.addInd(G, key, (X) => A.flagOf(X.n, (i) => X.ind['rel' + w][i] < v));
  for (const k of [1.25, 1.5, 1.75]) {
    const S = A.scale(A.W25, key, 1, k, A.isSell), r = A.ev(G, S), t = `W25 + к BTC за ${w} дн < ${v}%: продажи ×${k}`;
    console.log(A.row(t, r, main) + ` | к W25 ${A.d(r, w25).toFixed(3)} | ${A.why(r, main)}`);
    out.push({ tag: t, w, v, k, dMain: A.d(r, main), dW: A.d(r, w25), passMain: A.passes(r, main), whyMain: A.why(r, main), passW: A.passes(r, w25), whyW: A.why(r, w25), n100: r.n100.med, bwMain: A.bw(r, main, 'n100'), bwW: A.bw(r, w25, 'n100'), m: r.m, r: { sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med } });
  }
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
