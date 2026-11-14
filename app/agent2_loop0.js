/* Агент 2, круг 0: базовые цифры текущей основы (K3 + отложенная покупка, found/main-crypto.json) быстрым оценщиком agent_sim.js
   на отборе, экзамене, 50 случайных и 100 новых + метрики близости к дну/вершине. Для сравнения — B и K3 без отложенной.
   Запуск: node app/agent2_loop0.js */
const S = require('./agent_sim.js');
const fs = require('fs');
const M = S.B, B = JSON.parse(fs.readFileSync(__dirname + '/found/main-crypto-B.json', 'utf8')), K3 = JSON.parse(fs.readFileSync(__dirname + '/found/agent-best.json', 'utf8'));
const G = S.groups(['sel', 'ex', 'rnd', 'n100']);
const t0 = Date.now();
for (const [tag, X] of [['основа (K3 + отложенная)', M], ['K3', K3], ['B', B]]) {
  const r = S.evalAll(G, X, true);
  console.log(`\n== ${tag}\n  отбор: ${S.sh(r.sel)}\n  экзамен: ${S.sh(r.ex)}\n  50 случ.: ${S.sh(r.rnd)}\n  100 новых: ${S.sh(r.n100)}\n  ${S.fmtM(r.m)}`);
}
console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} с`);
