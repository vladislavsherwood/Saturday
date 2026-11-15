/* Агент «ЛОУКАП», круг 3: продажи на страхе ×k у лоукапов — какая монета ломает строгую проверку 50 случайных. Запуск: node app/lowcap_loop3c.js */
const L = require('./lowcap_sim.js'), { c } = L;
const G = L.load(), S0 = L.S0, b = L.evs(G, S0);
const show = (tag, S) => { const r = L.evs(G, S), lo = L.cmpLow(r, b, 'lsel'), sd = L.cmpStd(r, b); console.log(`${tag}: ЛОтбор ср.лог ${L.sg(lo.dlog)} ${lo.u}/${lo.d} ${lo.strict ? '✔' : '·'} | стенд ${L.sg(sd.inc)} ${sd.pass ? '✔' : '·' + sd.why} [${['sel', 'ex', 'rnd', 'n100'].map((g) => sd.R[g].med.toFixed(0) + '/' + sd.R[g].hworst.toFixed(0)).join(' ')}] 100н ${L.bw(r, b, 'n100').join('/')}`); return r; };
for (const k of [1.25, 1.5]) { const r = show(`страх ×${k} доля<1`, L.pre(S0, L.isFear, [c('mcsh90', '<', 1)], (q) => Math.max(-1, q.act * k)));
  const w = r.rnd.map((x, i) => ({ n: x.name, h1: x.h1, h2: x.h2, b1: b.rnd[i].h1, b2: b.rnd[i].h2 })).filter((x) => Math.min(x.h1, x.h2) < -55); console.log('   худшие половины 50 случ.:', w.map((x) => `${x.n} ${x.b1.toFixed(0)}→${x.h1.toFixed(0)} / ${x.b2.toFixed(0)}→${x.h2.toFixed(0)}`).join('; ')); }
