/* tune4, круг 5: финальная проверка кандидата AS (доля альтов за 90 дн > aso): сборка из combo2 (Z.build) с заменой порога в последнем правиле;
   (1) быстрый оценщик: строгая и доход по сегментам, 100 новых; (2) периоды: новый порог только до 2025-01-01 / только с 2025 (по дню решения);
   (3) по годам решения — где меняются итоги; (4) запись кандидатов для браузерного стенда и маржи: scratchpad/tune4/cands.json.
   Запуск: node app/tune4_final.js */
const Z = require('./combo2_sim.js'); const T = require('./tune4_sim.js'); const { c } = Z; const fs = require('fs');
const DIR = (process.env.SCR || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad') + '/tune4';
const S0 = Z.build(T.OPT);
const withAso = (v, when = null) => {
  const r = S0.rules.slice(0, -1), as = S0.rules[S0.rules.length - 1];
  const nw = { act: as.act, conds: as.conds.map((x) => (x.ind === 'oth90' ? { ...x, v } : x)) };
  if (!when) return { base: S0.base, rules: [...r, nw] };
  return { base: S0.base, rules: [...r, { ...nw, conds: [...nw.conds, ...when[0]] }, { ...as, conds: [...as.conds, ...when[1]] }] };
};
const G = T.load(); const b = Z.evc(G, S0), bs = Z.sum(b);
const D = Math.round(Date.UTC(2025, 0, 1) / 864e5);
const V = { 'combo2': S0, 'AS aso 1,3': withAso(1.3), 'AS aso 1,5': withAso(1.5) };
const out = {};
for (const v of [1.3, 1.5]) {
  for (const [tag, S] of [[`aso ${v} всё время`, withAso(v)], [`aso ${v} только до 2025`, withAso(v, [[c('t', '<', D)], [c('t', '>', D - 1)]])], [`aso ${v} только с 2025`, withAso(v, [[c('t', '>', D - 1)], [c('t', '<', D)]])]]) {
    const r = Z.evc(G, S), R = Z.sum(r); const o = {};
    for (const s of Z.SEGS) { const m = Z.mlog(r, b, s, ['sel', 'ex', 'rnd']), n = Z.mlog(r, b, s, ['n100']); o[s] = { d: +(Z.inc(R, s) - Z.inc(bs, s)).toFixed(4), strict: Z.strict(R, bs, s), mlog: +m.m.toFixed(4), ud: [m.u, m.d], n100: [+n.m.toFixed(4), n.u, n.d] }; }
    o.n100 = { med: +R.n100.all.med.toFixed(1), pos: R.n100.all.pos, hpos: R.n100.all.hpos }; o.med = ['sel', 'ex', 'rnd'].map((g) => +R[g].all.med.toFixed(1));
    out[tag] = o;
    console.log(tag.padEnd(24) + Z.SEGS.map((s) => `${s} ${o[s].d}${o[s].strict.length ? '·' + o[s].strict.join(',') : '✔'} ср.лог ${o[s].mlog} (${o[s].ud.join('/')}) 100н ${o[s].n100.join('/')}`).join(' | ') + ` | ${o.med.join('/')} 100н ${o.n100.med} ${o.n100.pos}/${o.n100.hpos}`);
  }
}
// монеты с наибольшими изменениями (aso 1,5)
{ const r = Z.evc(G, withAso(1.5)); const ch = []; for (const g in r) r[g].forEach((x, i) => { const y = b[g][i]; const dl = Z.L1(x.f) - Z.L1(y.f); if (Math.abs(dl) > 0.005) ch.push([g, x.name, x.seg, +y.f.toFixed(1), +x.f.toFixed(1), +dl.toFixed(3)]); }); ch.sort((a, b2) => b2[5] - a[5]); out.coins15 = ch; console.log('лучше:', ch.slice(0, 8).map((x) => x.join(' ')).join('; ')); console.log('хуже:', ch.slice(-8).map((x) => x.join(' ')).join('; ')); }
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(DIR + '/final.json', JSON.stringify(out, null, 1));
fs.writeFileSync(DIR + '/cands.json', JSON.stringify(V));
module.exports = { withAso, S0 };
