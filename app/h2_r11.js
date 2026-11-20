/* h2, круг 11: проверка кандидата «удержание после капитуляции» (H2) — правило «взнос» перед продажами на страхе (после правил покупки 1–9 и охраны 10).
   Варианты (третий аргумент): v1 (по умолчанию) — страх < 15 был не позже 60 дней назад, MVRV BTC < 1, btcr30 < 20;
   v5 — страх < 15 ≤ 90 дн, MVRV < 1,1, монета выше своего закрытия в последний день страха < 15 меньше чем на 20%, btcr30 < 20.
   1) к основе combo4 + фитили и к combo4 (с фитилями и без); 2) половины; 3) эпизоды дна; 4) задержка исполнения 2–3 дня; 5) крупные по монетам.
   h2 (итог) — v1 + возраст ряда монеты > 180 дн + не мем (мемы с удержанием ломают маржу ×1,45: ликвидации в портфелях M и P3, h2_margin.py).
   Запуск: node h2_r11.js [часть: base|eps|lag|all] [v1|v5|h2] */
const H = require('./h2_lib.js'), { L, P, c } = H, C = require('./h2_coin.js');
const part = process.argv[2] || 'all';
const VAR = process.argv[3] || 'v1';
const HOLD = VAR === 'v5' ? (q = 15, N = 90, m = 1.1, u = 0.2) => ({ act: 1, conds: [c('h2fd' + q, '<', N), c('mvrv', '<', m), c('h2capr' + q, '<', 1 + u), c('btcr30', '<', 20)] })
  : VAR === 'h2' ? (q = 15, N = 60, m = 1) => ({ act: 1, conds: [c('h2fd' + q, '<', N), c('mvrv', '<', m), c('age', '>', 180), c('meme', '<', 0.5), c('btcr30', '<', 20)] })
  : (q = 15, N = 60, m = 1) => ({ act: 1, conds: [c('h2fd' + q, '<', N), c('mvrv', '<', m), c('btcr30', '<', 20)] });
console.log('КАНДИДАТ', VAR, JSON.stringify(HOLD().conds));
const SC = H.ins([HOLD()], 10);
const ext = (r) => { const m = H.m81(r), h = H.halves(r); return `${r.s.slice(0, 170)} | 81 ${L.sg(m.m)} ${m.u}/${m.d} | пол (медианы) ${L.sg(h.h1)}/${L.sg(h.h2)}${r.w ? ' | ' + r.w.slice(0, 120) : ''}`; };
const meanHalves = (S, pol) => { const D = C.diff(P.evc(S, pol, C.lists), pol), a = D.filter((x) => x.g !== 'n100'), b = D.filter((x) => x.g === 'n100'), m = (v, k) => v.reduce((s, x) => s + x[k], 0) / v.length;
  return `полов. средний лог: 81 ${L.sg(m(a, 'd1'))} / ${L.sg(m(a, 'd2'))}; 100н ${L.sg(m(b, 'd1'))} / ${L.sg(m(b, 'd2'))}`; };
if (part === 'base' || part === 'all') {
  let pol = H.base('wick'); console.log('== к основе combo4 + фитили');
  console.log(ext(H.run('combo4 + фитили + H2', SC, pol, { n100: true }))); console.log('  ' + meanHalves(SC, pol));
  pol = H.base('plain'); console.log('== к основе combo4 (без фитилей)');
  console.log(ext(H.run('combo4 + H2 (без фитилей)', SC, pol, { n100: true }))); console.log('  ' + meanHalves(SC, pol));
  console.log(ext(H.run('combo4 + фитили (для сравнения)', H.S57, H.polW, { n100: true })));
  console.log(ext(H.run('combo4 + фитили + H2', SC, H.polW, { n100: true })));
  // сводные медианы групп и сегментов: основа / кандидат
  for (const [nm, S, p] of [['combo4', H.S57, L.pol0], ['combo4 + фитили', H.S57, H.polW], ['combo4 + фитили + H2', SC, H.polW], ['combo4 + H2', SC, L.pol0]]) {
    const R = P.evc(S, p, ['sel', 'ex', 'rnd', 'n100']), RS = L.Z.sum(R);
    console.log(`${nm.padEnd(24)} ` + ['sel', 'ex', 'rnd', 'n100'].map((g) => `${g} ${P.f(RS[g].all)}`).join(' | ') + ' | ' + ['big', 'alt', 'meme'].map((s) => `${s} ` + ['sel', 'ex', 'rnd'].map((g) => (RS[g][s] ? Math.round(RS[g][s].med) : '—')).join('/')).join(' '));
  }
}
if (part === 'eps' || part === 'all') {
  const pol = H.base('wick');
  const mk = (w) => [{ ...HOLD(), conds: [...HOLD().conds, ...w] }];
  const D = C.explain('H2 по эпизодам (основа combo4 + фитили)', mk, 10, pol, { top: 10 });
  // отдельно 06.2022 и 11.2022
  for (const [nm, a, b] of [['06–10.2022', '2022-05-01', '2022-10-31'], ['11.2022–02.2023', '2022-11-01', '2023-03-01'], ['2026', '2026-01-01', '2026-11-30']]) {
    const De = C.diff(P.evc(H.ins(mk(C.win(a, b)), 10), pol, C.lists), pol), a81 = De.filter((x) => x.g !== 'n100'), a100 = De.filter((x) => x.g === 'n100');
    const ag = (v) => `${L.sg(v.reduce((s, x) => s + x.d, 0) / (v.length || 1))} ${v.filter((x) => x.d > 0.005).length}/${v.filter((x) => x.d < -0.005).length}`;
    console.log(`  окно ${nm}: 81 ${ag(a81)} [к ${ag(a81.filter((x) => x.seg === 'big'))}] | 100н ${ag(a100)}`);
  }
  console.log('  крупные: ' + D.filter((x) => x.seg === 'big' && x.g !== 'n100').map((x) => `${x.name} ${Math.round(x.f0)}→${Math.round(x.f)}% (${L.sg(x.d)})`).join(', '));
}
if (part === 'lag' || part === 'all') {
  const pol = H.polW;
  for (const lags of [[0, 1], [2], [3], [1, 2]]) {
    const b = L.evLag(H.S57, pol, lags), r = L.evLag(SC, pol, lags), bs = L.Z.sum(b), rs = L.Z.sum(r);
    const m = L.Z.mlog(r, b, 'all', ['sel', 'ex', 'rnd']);
    console.log(`задержка ${lags.join('/')}: основа ${['sel', 'ex', 'rnd'].map((g) => Math.round(bs[g].all.med)).join('/')} → H2 ${['sel', 'ex', 'rnd'].map((g) => Math.round(rs[g].all.med)).join('/')} | доход ${L.sg(L.Z.inc(rs, 'all') - L.Z.inc(bs, 'all'))} к ${L.sg(L.Z.inc(rs, 'big') - L.Z.inc(bs, 'big'))} | 81 ${L.sg(m.m)} ${m.u}/${m.d}`);
  }
}
module.exports = { HOLD, SC };
