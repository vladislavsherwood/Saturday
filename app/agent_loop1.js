/* Круг 1: растянуть докупки по дну.
   H1a — меньшие доли на панике (правила 2, 3, 6 срабатывают много дней подряд, большая доля тратит резерв в первые дни падения);
   H1b — лесенка по глубине: на панике мало при неглубокой просадке и много при глубокой (биткоин от ATH — btcath, монета от максимума за год — dd365).
   Запуск: node app/agent_loop1.js */
const S = require('./agent_sim.js');
const { B, c } = S;
const G = S.groups(['sel', 'ex', 'rnd']);
const PANIC = [2, 3, 6];
const L = [{ tag: 'B', S: B }];
for (const f of [0.2, 0.4, 0.6, 0.8]) L.push({ tag: `H1a: доли паники ×${f}`, S: { ...B, rules: B.rules.map((r, i) => (PANIC.includes(i) ? { ...r, act: 1 + (r.act - 1) * f } : r)) } });
for (const ind of ['btcath', 'dd365']) for (const T of [30, 40, 50, 60, 70, 80]) for (const lo of [1, 1.05, 1.1, 1.25]) for (const hi of [1.25, 1.5, 2]) {
  if (hi <= lo) continue;
  const rules = [];
  B.rules.forEach((r, i) => { if (PANIC.includes(i)) { rules.push({ act: hi, conds: [...r.conds, c(ind, '>', T)] }, { ...r, act: lo }); } else rules.push(r); });
  L.push({ tag: `H1b: паника — ${ind}>${T}: ${hi}, иначе ${lo}`, S: { base: 1, rules } });
}
// H1c: то же, но лесенка только для правила 2 (паника на сильном страхе — 48% денег резерва, дальше всех от дна)
for (const ind of ['btcath', 'dd365']) for (const T of [40, 50, 60, 70]) for (const lo of [1, 1.05, 1.1]) for (const hi of [1.25, 1.5]) {
  const rules = []; B.rules.forEach((r, i) => { if (i === 2) rules.push({ act: hi, conds: [...r.conds, c(ind, '>', T)] }, { ...r, act: lo }); else rules.push(r); });
  L.push({ tag: `H1c: только правило 2 — ${ind}>${T}: ${hi}, иначе ${lo}`, S: { base: 1, rules } });
}
const R = L.map((x) => ({ ...x, ...S.evalAll(G, x.S, true) })), b = R[0];
const ml = (r) => `дно: выше мин. ${r.m.buyAbove90.toFixed(0)}%, в зоне ${r.m.zone15.toFixed(0)}%, ≥3 дней ${r.m.bott3.toFixed(0)}% | верх ${r.m.sellToTop.toFixed(0)}%/${r.m.missedTops.toFixed(0)}%`;
const out = (r) => console.log(`${S.line(r)} | ${(S.inc(r) - S.inc(b) >= 0 ? '+' : '') + (S.inc(r) - S.inc(b)).toFixed(3)} ${S.passes(r, b) ? '✔' : '·'} | ${ml(r)} | ${r.tag}`);
console.log(S.HDR + ' | доход к B | проходит | метрики\n'); out(b); console.log();
console.log('--- H1a ---'); R.filter((r) => r.tag.startsWith('H1a')).forEach(out);
console.log('\n--- проходят проверку устойчивости, лучшие по доходу ---'); R.slice(1).filter((r) => S.passes(r, b)).sort((x, y) => S.inc(y) - S.inc(x)).slice(0, 15).forEach(out);
console.log('\n--- лучшие по близости к дну (в зоне +15%) среди не хуже B по доходу ---'); R.slice(1).filter((r) => S.inc(r) >= S.inc(b)).sort((x, y) => y.m.zone15 - x.m.zone15).slice(0, 10).forEach(out);
console.log('\n--- плато: паника при неглубокой просадке — только взнос (lo=1) ---'); R.filter((r) => /иначе 1$/.test(r.tag)).forEach(out);
require('fs').writeFileSync(process.env.AGENT_DATA ? process.env.AGENT_DATA + '/../loop1.json' : '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/loop1.json', JSON.stringify(R.map((r) => ({ tag: r.tag, S: r.S, sel: r.sel, ex: r.ex, rnd: r.rnd, m: r.m }))));
