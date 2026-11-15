/* pepefix: «эйфория в стейблах» с мемами — соседи на текущих данных (по AGENT_DATA). Основа — combo4 без эйфории и сам combo4 (A 0).
   Вариант: usdt < u, age > 540, beta180 > b [, corr180 > 0,5] → продать s в день (без условия «не мем»). Запуск: AGENT_DATA=... node app/pepefix_euph.js */
const P2 = require('./panicx_p2.js'), P = P2.P, Z = P.Z;
const pol = P2.Boost(2, { k: 0, A: 0 }), L = ['sel', 'ex', 'rnd'];
const mk = (u, s, b, cr, meme) => { const S = P.clone(P.base); const cs = [{ ind: 'usdt', op: '<', v: u }, { ind: 'age', op: '>', v: 540 }, { ind: 'beta180', op: '>', v: b }]; if (cr) cs.push({ ind: 'corr180', op: '>', v: cr }); if (!meme) cs.splice(2, 0, { ind: 'meme', op: '<', v: 0.5 }); S.rules.push({ act: -s, conds: cs }); return S; };
const noE = Z.sum(P.evc(P.base, pol, L)), C4 = Z.sum(P.evc(mk(0.9, 0.05, 0.9, 0, false), pol, L));
const memes = (S) => P.evc(S, pol, ['ex']).ex.filter((x) => x.seg === 'meme').map((x) => `${x.name} ${x.h2.toFixed(1)}`).join(' ');
for (const [u, s, b, cr] of [[0.9, 0.05, 0.9, 0], [0.9, 0.05, 0.9, 0.5], [0.85, 0.05, 0.9, 0], [0.88, 0.05, 0.9, 0], [0.92, 0.05, 0.9, 0], [0.9, 0.03, 0.9, 0], [0.9, 0.08, 0.9, 0], [0.9, 0.05, 1.0, 0], [0.9, 0.05, 1.2, 0], [0.9, 0.02, 0.9, 0]]) {
  const S = mk(u, s, b, cr, true), R = Z.sum(P.evc(S, pol, L));
  const seg = (B) => Z.SEGS.map((g) => `${g} ${(Z.inc(R, g) - Z.inc(B, g)).toFixed(3)}${Z.strict(R, B, g).length ? '✗' : '✔'}`).join(' ');
  const why = Z.strict(R, C4, 'meme').join(',');
  console.log(`usdt<${u} ${s * 100}% бета>${b}${cr ? ' corr>' + cr : ''} | к без эйфории: ${seg(noE)} | к combo4: ${seg(C4)} ${why} | 2-я пол. мемов экз.: ${memes(S)}`);
}
