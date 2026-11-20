/* hv2, круг 0: проверка стенда — combo5 без новых полей (как раньше), hv через крючки = hv через копии правил; провалы hv по новой мере (добавочные продажи). */
const X = require('./hv2_lib.js'), { H } = X;
const { build } = require('./hv_r7.js');
H.head();
H.ev('combo5 (после правки стенда)', H.S5);
H.ev('hv копиями (found/hv-best.json)', build({ T: 120, U: 200, mp: 2, mw: 2, me: 2 }));
const r = X.run('hv крючками (T120 двоично, U200, ×2)', {});
console.log('hv:', X.ftxt(X.fails(r.V)));
const r2 = X.run('hv крючками без исключения крупных', { ex: X.EXL.none });
