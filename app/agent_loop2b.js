/* Круг 2, уточнение: подтверждение паники перепроданностью монеты (RSI) и/или выносом плеч (OI) — плато порогов и размера без подтверждения,
   проверка лучших на 100 новых монетах. Запуск: node app/agent_loop2b.js */
const S = require('./agent_sim.js');
const { B, c } = S;
const G = S.groups(['sel', 'ex', 'rnd', 'n100']);
const conf = (sets, confs, lo) => { const rules = []; B.rules.forEach((r, i) => { if (sets.includes(i)) { for (const cf of confs) rules.push({ ...r, conds: [...r.conds, ...cf] }); rules.push({ ...r, act: Math.min(r.act, lo) }); } else rules.push(r); }); return { base: 1, rules }; };
const L = [{ tag: 'B', S: B }];
for (const rsi of [30, 35, 40, 45]) for (const lo of [1.05, 1.1, 1.15]) for (const sets of [[2], [2, 3], [2, 3, 6]]) {
  L.push({ tag: `правила ${sets}: RSI<${rsi}, иначе ${Math.round((lo - 1) * 100)}%`, S: conf(sets, [[c('rsi', '<', rsi)]], lo) });
  for (const oi of [-10, -15]) L.push({ tag: `правила ${sets}: RSI<${rsi} или OI<${oi}%, иначе ${Math.round((lo - 1) * 100)}%`, S: conf(sets, [[c('rsi', '<', rsi)], [c('oidd30', '<', oi)]], lo) });
}
for (const oi of [-5, -8, -10, -12]) for (const lo of [1.05, 1.1, 1.15]) for (const sets of [[2], [2, 3], [2, 3, 6]]) L.push({ tag: `правила ${sets}: OI<${oi}%, иначе ${Math.round((lo - 1) * 100)}%`, S: conf(sets, [[c('oidd30', '<', oi)]], lo) });
const R = L.map((x) => ({ ...x, ...S.evalAll(G, x.S, true) })), b = R[0];
const d = (r) => (S.inc(r) - S.inc(b) >= 0 ? '+' : '') + (S.inc(r) - S.inc(b)).toFixed(3);
const out = (r) => console.log(`${S.line(r)} | ${r.n100.med.toFixed(0)}/${r.n100.pos}/${r.n100.hpos} | ${d(r)} ${S.passes(r, b) ? '✔' : '·'} | зона ${r.m.zone15.toFixed(0)}%, доньев ${r.m.bottHit.toFixed(0)}/${r.m.bott3.toFixed(0)}%, мин.отб ${r.sel.worst.toFixed(0)} | ${r.tag}`);
console.log(S.HDR + ' | 100 новых мед/плюс/пол+ | доход | ✔ | метрики\n'); out(b);
console.log('\n--- проходят ---'); R.slice(1).filter((r) => S.passes(r, b)).sort((x, y) => S.inc(y) - S.inc(x)).slice(0, 15).forEach(out);
console.log('\n--- лучшие по доходу ---'); R.slice(1).sort((x, y) => S.inc(y) - S.inc(x)).slice(0, 15).forEach(out);
console.log('\n--- плато: правила 2,3,6, иначе 10% ---'); R.filter((r) => r.tag.startsWith('правила 2,3,6') && r.tag.endsWith('иначе 10%')).forEach(out);
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/loop2b.json', JSON.stringify(R.map((r) => ({ tag: r.tag, S: r.S }))));
