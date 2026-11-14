/* Круг 8. 100 новых монет (быстрый оценщик) и файл кандидатов для браузерного стенда seg_big_lab.js */
const Z = require('./seg_big_sim.js'); const { K } = Z; const fs = require('fs');
const G = Z.load(['sel', 'ex', 'rnd', 'n100']); Z.addBig(G); const S = Z.BASE_S;
const V = { 'основа (combo-best)': S, B65: Z.B65(), 'список|B65': Z.LB65(), 'B65 тихие ×1,25': Z.bigSells(S, 1.25, 1.25), 'B65 corr>0,7': Z.bigSells(S, 1.5, 1.25, [[K.c('corr180', '>', 0.7), K.c('vol180', '<', 90)]]),
  'ВСЕ монеты: тихие ×1,5 + страх ×1,25 (контроль)': Z.bigSells(S, 1.5, 1.25, [[]]) };
const rb = K.ev(G, S, false);
for (const nm in V) {
  const r = nm.startsWith('основа') ? rb : K.ev(G, V[nm], false);
  const h = G.n100.flatMap((X) => [K.E(X, V[nm], 'h1'), K.E(X, V[nm], 'h2')]);
  console.log(`${nm}: доход ${K.d(r, rb).toFixed(3)} ${K.passes(r, rb) ? '✔' : '· ' + K.why(r, rb)} | ${K.line(r)} | 100 новых: медиана ${r.n100.med.toFixed(0)}, в плюсе ${r.n100.pos}, половин ${h.filter((x) => x > 0).length}/200, худшая ${r.n100.worst.toFixed(0)}, худш. пол. ${Math.min(...h).toFixed(0)}, лучше/хуже ${K.bw(r, rb, 'n100').join('/')}`);
}
const dir = process.env.SCR || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/seg_big';
const L = {}; for (const nm of ['основа (combo-best)', 'B65', 'список|B65']) L[nm] = V[nm];
fs.writeFileSync(dir + '/cands8.json', JSON.stringify(L));
