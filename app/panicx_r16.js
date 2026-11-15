/* Круг 16: доводка кандидата k 0. Окно пика usdt (5/7/10/14/20 дней) для отсрочки и выдачи; порог «сильной паники», которую не откладываем (1,15…1,3, ∞ — откладывать и её).
   Сравнение — к k 0 (A 540, t 0,98, rv 0,965, окно 10, сильная > 1,2). Запуск: node panicx_r16.js */
const H = require('./panicx_p2.js'), P = H.P;
H.init();
P.setBaseline(P.base, H.Pol2({ k: 0 })); console.log('основа круга: k 0');
for (const pk of ['upk5', 'upk7', 'upk14', 'upk20']) for (const [t, rv] of [[0.98, 0.965], [0.975, 0.96], [0.985, 0.97]]) H.run(`окно ${pk} t${t} rv${rv}`, H.Pol2({ k: 0, pk, t, rv }));
for (const su of [1.15, 1.25, 1.3, 9]) H.run(`сильная > ${su}`, H.Pol2({ k: 0, su }));
console.log(H.summary());
