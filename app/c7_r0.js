/* c7, круг 0: стенд — воспроизвести combo7 (к combo6 и к себе), проверить семьи правил и равенство «множитель‑политика = копии». Запуск: node c7_r0.js (лог scratchpad/c7/r0.txt) */
const C = require('./c7_lib.js'), { O } = C;
C.tee('r0');
const cnt = {}; C.S7.rules.forEach((r, k) => { const key = C.FAM7[k] + (C.LAY7[k] ? '/' + C.LAY7[k] : ''); cnt[key] = (cnt[key] || 0) + 1; });
console.log('семьи/слои combo7 (133):', JSON.stringify(cnt));
console.log('ядро множителя‑политики:', C.core.rules.length, 'правил;', JSON.stringify(C.core.rules.reduce((o, r) => ((o[r.f] = (o[r.f] || 0) + 1), o), {})));
O.base('c6'); C.run('combo7 к combo6', C.S7);
O.base('c7'); C.run('combo7 к combo7', C.S7);
C.run('ядро 64 + множитель (как combo7)', C.core, C.polM());
const t = Date.now(); C.run('ядро без множителя', C.core, C.polW, { raw: 1 }); console.log('время прогона', Date.now() - t, 'мс');
