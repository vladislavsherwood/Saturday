/* ew, добивка: сильные «продающие» фигуры (волна 5, волна 3 ≥ 1,618 × волна 1, волна 5 у BTC) мягко — продажа 1–2% в день или фильтр взноса (копить). Запуск: node ew_r3.js */
const L = require('./r4_lib.js'), { S0, c } = L, EW = require('./ew_lib.js');
const made = new Set();
const ind = (src, th, f, o = {}) => { const nm = `ew_${src}_${th}_${f}_${JSON.stringify(o).replace(/\W/g, '')}`; if (!made.has(nm)) { L.addInd(nm, (X) => EW.make(X, src, th, f, o)); made.add(nm); } return nm; };
const T = (nm, act, conds, pl) => { const S = L.clone(), r = { act, conds }; if (pl === 'первым') S.rules.unshift(r); else S.rules.push(r); console.log(L.run(`${nm} [${pl}]`, S, L.pol0, { quiet: true }).txt.slice(0, 200)); };
L.run('combo4', S0);
const SIG = [['волна 5, 35%', ind('c', 0.35, 'w5')], ['волна 3 ≥ 1,618 × в1, 35%', ind('c', 0.35, 'w3ext', { e: 1.618 })], ['волна 5 у BTC 25%', ind('btc', 0.25, 'w5')], ['волна 5, 20%', ind('c', 0.2, 'w5')]];
for (const [nm, i] of SIG) {
  for (const s of [0.01, 0.02]) for (const pl of ['первым', 'последним']) T(`${nm}: −${s * 100}%`, -s, [c(i, '>', 0.5)], pl);
  T(`${nm}: копить взнос`, 1e-6, [c(i, '>', 0.5)], 'последним');
  T(`${nm}: полвзноса`, 0.5, [c(i, '>', 0.5)], 'последним');
}
