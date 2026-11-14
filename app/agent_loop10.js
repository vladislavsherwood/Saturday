/* Круг 10: финальная проверка. Кандидаты B, K1, K3 — (1) настоящим стендом lab.js в браузере (отбор, экзамен, 50 случайных),
   чтобы исключить ошибку быстрого оценщика; (2) быстрым оценщиком: 100 новых монет и метрики близости к дну/вершине.
   Запуск: node app/agent_loop10.js <папка со страницами> <cands9.json> */
const fs = require('fs');
const { lab, report } = require('./lab.js');
const { injLiq } = require('./liq_inject.js');
const S = require('./agent_sim.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const C = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const strip = (St) => ({ base: St.base, rules: St.rules.map((r) => ({ act: r.act, conds: r.conds })) });
const L = [['B', C.B], ['K1: B + тихая вершина 40%', C['K1: B + тихая вершина 40%']], ['K3: K1 + подтверждение OI', C['K3: K1 + подтверждение OI']]].map(([tag, St]) => ({ tag, S: strip(St) }));
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  for (const g in lb.pages) await lb.pages[g].evaluate(injLiq, LIQ);
  const rows = await lb.run(L); await lb.close();
  const G = S.groups(['sel', 'ex', 'rnd', 'n100']);
  for (const r of rows) {
    const n = S.evalAll(G, r.S, true);
    console.log(`${r.tag}\n  СТЕНД lab.js (браузер):\n${report(r)}\n  быстрый оценщик: отбор ${S.sh(n.sel)}\n                   экзамен ${S.sh(n.ex)}\n                   50 случ. ${S.sh(n.rnd)}\n  100 новых: ${S.sh(n.n100)}\n  ${S.fmtM(n.m)}\n`);
  }
})();
