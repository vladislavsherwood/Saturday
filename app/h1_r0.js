/* h1, круг 0: проверка стенда (без pol.h1 и с пустыми крючками — результат прежний) и основы; доля резерва в капитале. Запуск: node h1_r0.js */
const H = require('./h1_lib.js');
const t0 = Date.now();
H.head();
H.ev('combo4 + фитили (основа W)', H.polW, { n100: true });
H.ev('combo4 (C)', H.polC, { n100: true });
H.ev('W + пустой h1 {}', H.mk({}));
H.ev('W + доход 0% (grow = 1)', H.mk(H.yFix(0)));
H.ev('W + кэрри e 0 (cost 0)', H.mk(H.carry({ e: 0, cost: 0, save: 0 })));
H.ev('W + хранение в BTC w 0 (fee 0)', H.mk(H.store({ w: () => 0, fee: 0 })));
console.log('C:', H.cashShare(H.polC));
console.log('W:', H.cashShare(H.polW));
console.log(`время ${((Date.now() - t0) / 1000).toFixed(1)} с`);
