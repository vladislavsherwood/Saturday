/* Сравнение стратегий: combo4 / combo5 / combo6 / combo7 v1 / c7-best / combo7 (черновик, 151) — к combo6 и к предыдущей версии.
   Политика одна для всех (отложенная паника Boost(2) + ловушка для фитилей), различаются только правила.
   Запуск: C7_BASE=combo7-draft.json node cmp_all.js (лог scratchpad/c7/cmp_all.txt) */
const C = require('./c7_lib.js'), { L, P, A } = C;
C.tee('cmp_all');
const ld = (f) => { const S = L.clone(C.S6); S.rules = require('./found/' + f).rules.map((r) => JSON.parse(JSON.stringify(r))); return S; };
const V = [['combo4', ld('combo4-best.json')], ['combo5', ld('combo5-best.json')], ['combo6', C.S6], ['combo7 v1', ld('combo7-v1.json')],
  ['c7-best', ld('c7-best.json')], ['combo7 (151)', ld('combo7-draft.json')]];
console.log('=== к combo6 ===');
P.setBaseline(C.S6, C.polW);
for (const [nm, S] of V) C.run(nm, S, C.polW);
console.log('\n=== к предыдущей версии ===');
for (let k = 1; k < V.length; k++) { P.setBaseline(V[k - 1][1], C.polW); C.run(`${V[k][0]} к ${V[k - 1][0]}`, V[k][1], C.polW); }
console.log('\n=== монеты пользователя, % к DCA (худший сдвиг 0/1): вся история | с 2025-01-01 с нуля ===');
console.log('монета | ' + V.map((v) => v[0]).join(' / '));
for (const nm of C.MINE) {
  const X = C.BY[nm]; if (!X) continue;
  const full = V.map(([, S]) => Math.round(C.E(X, S, C.polW)));
  const rec = X.ind.t[0] < C.T('2025-01-01') ? V.map(([, S]) => Math.round(A.E(A.cut(X, '2025-01-01'), S, C.polW))) : null;
  console.log(`${nm} | ${full.join(' / ')} | ${rec ? rec.join(' / ') : '—'}`);
}
