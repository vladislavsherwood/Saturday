/* Круг 2: подтверждение дна разными сигналами.
   H2a — покупка на панике в полном размере только при втором, независимом признаке дна (вынос плеч по OI, страх < 25, биткоин −20% за 30 дней,
         RSI монеты < 30, монета ниже средней 200 на 30%+); без подтверждения — меньше (или только взнос).
   H2b — «вторая волна»: полная покупка, только если паника держится N дней (ждём фазу капитуляции, а не начало падения).
   Запуск: node app/agent_loop2.js */
const S = require('./agent_sim.js');
const { B, c } = S;
const G = S.groups(['sel', 'ex', 'rnd']);
const CONF = { 'OI −15% от макс.': [c('oidd30', '<', -15)], 'OI −10% от макс.': [c('oidd30', '<', -10)], 'страх < 25': [c('fng', '<', 25)], 'страх < 20': [c('fng', '<', 20)],
  'BTC −20% за 30 дн': [c('btcr30', '<', -20)], 'BTC −15% за 30 дн': [c('btcr30', '<', -15)], 'RSI < 30': [c('rsi', '<', 30)], 'RSI < 35': [c('rsi', '<', 35)],
  'монета < 0,7 средней 200': [c('sma200', '<', 0.7)], 'монета < 0,6 средней 200': [c('sma200', '<', 0.6)],
  'паника ≥ 7 дн': [c('panicd', '>', 6.5)], 'паника ≥ 14 дн': [c('panicd', '>', 13.5)], 'паника ≥ 30 дн': [c('panicd', '>', 29.5)], 'паника ≥ 60 дн': [c('panicd', '>', 59.5)] };
const SETS = { 'правило 2': [2], 'правила 2,3': [2, 3], 'правила 2,3,6': [2, 3, 6] };
const L = [{ tag: 'B', S: B }];
for (const cn in CONF) for (const sn in SETS) for (const lo of [1, 1.05, 1.1]) {
  const rules = [];
  B.rules.forEach((r, i) => { if (SETS[sn].includes(i)) rules.push({ ...r, conds: [...r.conds, ...CONF[cn]] }, { ...r, act: Math.min(r.act, lo) }); else rules.push(r); });
  L.push({ tag: `${sn}: полностью только при «${cn}», иначе ${lo === 1 ? 'только взнос' : 'резерв ' + Math.round((lo - 1) * 100) + '%'}`, cn, sn, lo, S: { base: 1, rules } });
}
const R = L.map((x) => ({ ...x, ...S.evalAll(G, x.S, true) })), b = R[0];
const ml = (r) => `выше мин. ${r.m.buyAbove90.toFixed(0)}%, в зоне ${r.m.zone15.toFixed(0)}%, доньев ${r.m.bottHit.toFixed(0)}/${r.m.bott3.toFixed(0)}%`;
const d = (r) => (S.inc(r) - S.inc(b) >= 0 ? '+' : '') + (S.inc(r) - S.inc(b)).toFixed(3);
const out = (r) => console.log(`${S.line(r)} | ${d(r)} ${S.passes(r, b) ? '✔' : '·'} | ${ml(r)} | ${r.tag}`);
console.log(S.HDR + ' | доход к B | проходит | метрики\n'); out(b);
console.log('\n--- проходят проверку устойчивости, лучшие по доходу ---'); R.slice(1).filter((r) => S.passes(r, b)).sort((x, y) => S.inc(y) - S.inc(x)).slice(0, 12).forEach(out);
console.log('\n--- лучшие по доходу вообще ---'); R.slice(1).sort((x, y) => S.inc(y) - S.inc(x)).slice(0, 12).forEach(out);
console.log('\n--- средний доход по признаку подтверждения ---');
for (const cn in CONF) { const v = R.filter((r) => r.cn === cn); console.log(`  ${cn.padEnd(26)} доход ${(v.reduce((s, r) => s + S.inc(r) - S.inc(b), 0) / v.length).toFixed(3)}, проходят ${v.filter((r) => S.passes(r, b)).length}/${v.length}, в зоне ${(v.reduce((s, r) => s + r.m.zone15, 0) / v.length).toFixed(1)}%`); }
