/* r4, круг 1 (итог): жадное удаление отдельных правил. Критерий (заранее): строгая ✔ везде; суммарно доход ≥ −0,005 и по каждому сегменту ≥ −0,01;
   средний лог по 81 монете ≥ −0,002; правило #5 (неподтверждённая паника при страхе, живое в марже) не трогаю. Финал — 100 новых: средний лог ≥ −0,002.
   Запуск: node r4_r1c.js */
const L = require('./r4_lib.js'), { S0, Z, P } = L;
const B0 = P.evc(S0, L.pol0);
const ml = (S, s = 'all') => Z.mlog(P.evc(S, L.pol0), B0, s, ['sel', 'ex', 'rnd']);
const txt = (r) => r.act + ' ' + r.conds.map((c) => c.ind + c.op + c.v).join(' & ');
const okR = (r, S) => !r.w && r.dseg.all >= -0.005 && ['big', 'alt', 'meme'].every((s) => r.dseg[s] >= -0.01) && ml(S).m >= -0.002;
// порядок: с конца списка (самые специфичные копии стоят раньше общих — иду по всем, несколько проходов)
let S = L.clone(S0), removed = [], changed = true;
const key = (r) => txt(r);
while (changed) {
  changed = false;
  for (let i = 0; i < S.rules.length; i++) {
    if (key(S.rules[i]) === key(S0.rules[5])) continue;
    if (S.rules[i].act >= 1 || S.rules[i].conds.some((c) => c.ind === 'usdt')) continue; // покупки и эйфорию не трогаю
    const T = L.clone(S); T.rules.splice(i, 1);
    const r = L.run('', T, L.pol0, { quiet: true });
    if (okR(r, T)) { removed.push(txt(S.rules[i])); S = T; i--; changed = true; }
  }
}
console.log('убрано', removed.length, 'правил; осталось', S.rules.length);
console.log(removed.join('\n'));
const r = L.run('упрощённая (по правилам)', S, L.pol0, { n100: true }), q = ml(S);
console.log(`81 монета: лог ${L.sg(q.m)} ${q.u}/${q.d}; мемы ${L.sg(ml(S, 'meme').m)}, крупные ${L.sg(ml(S, 'big').m)}, альты ${L.sg(ml(S, 'alt').m)}`);
console.log('ОСТАЛИСЬ:\n' + S.rules.map((r, i) => `${i}: ${txt(r)}`).join('\n'));
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/r4/simple_rules.json', JSON.stringify(S));
