/* Основная крипто-стратегия B (found/main-crypto.json): каждая доля покупки/продажи по очереди с шагом 0,5 п.п. ±10 п.п.,
   остальные как есть. Ищем плато и узкие места. Запуск: node app/liq_sizes.js <папка> */
const fs = require('fs');
const { lab, stable } = require('./lab.js');
const { injLiq } = require('./liq_inject.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const B = JSON.parse(fs.readFileSync(__dirname + '/found/main-crypto.json', 'utf8'));
const name = (r) => r.conds.map((c) => `${c.ind}${c.op}${c.v}`).join(' & ');
const L = [{ tag: 'B', S: B }];
B.rules.forEach((r, k) => {
  const dup = B.rules.findIndex((q) => q.act === r.act && name(q) === name(r)); if (dup !== k) return;
  const isBuy = r.act > 1, cur = isBuy ? (r.act >= 2 ? 100 : (r.act - 1) * 100) : -r.act * 100;
  for (let d = -10; d <= 10; d += 0.5) { const v = +(cur + d).toFixed(1); if (d === 0 || v <= 0 || v > 100) continue;
    L.push({ k, v, cur, tag: `${k}`, S: { base: 1, rules: B.rules.map((q, i) => (i === k ? { ...q, act: isBuy ? 1 + v / 100 : -v / 100 } : q)) } }); }
});
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  for (const g in lb.pages) await lb.pages[g].evaluate(injLiq, LIQ);
  const rows = []; for (let i = 0; i < L.length; i += 150) rows.push(...(await lb.run(L.slice(i, i + 150))));
  await lb.close();
  const base = rows[0];
  const inc = (r) => Math.log1p(r.sel.med / 100) + Math.log1p(r.ex.med / 100) + Math.log1p(r.rnd.med / 100);
  const ok = (r) => stable(r, base, 'sel') && stable(r, base, 'ex') && r.rnd.hpos >= base.rnd.hpos && r.rnd.pos >= base.rnd.pos;
  console.log(`B: отбор ${base.sel.med.toFixed(0)}/${base.sel.hworst.toFixed(0)}, экзамен ${base.ex.med.toFixed(0)}/${base.ex.hworst.toFixed(0)}, 50 случ. ${base.rnd.med.toFixed(0)}/${base.rnd.hpos}; доход ${inc(base).toFixed(3)}`);
  for (const k of [...new Set(rows.slice(1).map((r) => r.k))]) {
    const g = rows.filter((r) => r.k === k).sort((a, b) => a.v - b.v), R = B.rules[k];
    console.log(`\n[${k}] ${R.act > 1 ? 'купить' : 'продать'} ${g[0].cur}% при ${name(R)}`);
    console.log('  ' + g.map((r) => `${r.v}:${(inc(r) - inc(base) >= 0 ? '+' : '') + (inc(r) - inc(base)).toFixed(2)}${ok(r) ? '' : '✘'}`).join(' '));
    const good = g.filter((r) => ok(r) && r.sel.med >= base.sel.med && r.ex.med >= base.ex.med && r.rnd.med >= base.rnd.med);
    if (good.length) { const b = good.sort((a, c) => inc(c) - inc(a))[0]; console.log(`  лучше B во всём: ${good.map((r) => r.v).sort((a, c) => a - c).join(', ')} | лучшее ${b.v}: отбор ${b.sel.med.toFixed(0)}/${b.sel.hworst.toFixed(0)}, экзамен ${b.ex.med.toFixed(0)}/${b.ex.hworst.toFixed(0)}, случ. ${b.rnd.med.toFixed(0)}/${b.rnd.hpos}`); }
  }
})();
