/* Круг 11: выдача долга частями — r1 на первом развороте usdt, остаток на втором событии (глубже разворот / волна ликвидаций / капитуляция /
   ослабление страха / OI перестал падать) или в конце эпизода. Запуск: node panicx_r11.js */
const H = require('./panicx_p2.js');
H.init();
const SEC = [['deep', { rv2: 0.95 }], ['deep', { rv2: 0.94 }], ['liq', {}], ['cap', {}], ['fear', { fv: 5 }], ['fear', { fv: 10 }], ['oi', {}], ['none', {}]];
for (const r1 of [0.33, 0.5, 0.67]) for (const [sec, x] of SEC) H.run(`r1 ${r1} затем ${sec}${x.rv2 || x.fv || ''}`, H.Pol2({ r1, sec, ...x }));
console.log(H.summary());
