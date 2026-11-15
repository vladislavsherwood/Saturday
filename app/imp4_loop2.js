/* imp4, круг 2. Признаки за 1–14 дней до обвала (рыночные ряды, по дням): перегрев плеча (OI, фандинг), толпа в лонгах, жадность,
   ускорение роста, расхождение BTC и альтов, всплеск объёма. Для каждого признака: эпизоды признака (склейка < 14 дней), сколько из них
   кончились обвалом в течение 14 дней («точность»), сколько из 22 обвалов (и из 8 «в рынке» — круг 1) имели признак за 1–14 дней,
   и цена ложной тревоги — медиана доходности рынка альтов за 30/60 дней от первого дня эпизода признака. База — те же величины для
   «любого дня» на том же отрезке истории признака. Запуск: node app/imp4_loop2.js */
const L = require('./imp4_lib.js'); const { K } = L;
const G = K.groups(['sel', 'ex', 'rnd', 'n100']);
const { M, xret } = L.market(G);
const B = G.sel.find((X) => X.name === 'BTC'), I = B.ind;
const T0 = L.tOf('2018-06-01'), tEnd = B.t[B.n - 1];
const at = (t) => t - B.t[0];
// индекс альтов (накопленный по медиане дневной доходности)
const idx = new Map(); { let v = 1; for (let t = T0 - 120; t <= tEnd; t++) { const m = M.get(t); if (m) v *= 1 + m.alt; idx.set(t, v); } }
const crashDay = new Set([...M].filter(([t, v]) => t >= T0 && (v.alt <= -0.13 || v.btc <= -0.12)).map(([t]) => t));
const eps = []; for (const t of [...crashDay].sort((a, b) => a - b)) { if (eps.length && t - eps[eps.length - 1].last < 14) eps[eps.length - 1].last = t; else eps.push({ t, last: t }); }
const INN = ['2019-06-27', '2019-07-16', '2020-09-03', '2021-01-21', '2021-02-23', '2021-09-07', '2024-04-12', '2024-12-09'].map(L.tOf);
const NAMED = ['2020-03-08', '2021-05-12', '2022-05-09', '2022-11-08', '2025-10-10', '2026-02-05'].map(L.tOf);
const r = (t, w) => xret(t, w);
const F = {
  fng: (t) => I.fng[at(t)], fund7: (t) => I.fund7[at(t)], fund30: (t) => I.fund30[at(t)], oic14: (t) => I.oic14[at(t)], oic30: (t) => I.oic30[at(t)], oi30: (t) => I.oi30[at(t)],
  ls: (t) => I.ls[at(t)], lsr: (t) => I.lsr[at(t)], tlsr: (t) => I.tlsr[at(t)], vol: (t) => I.vol[at(t)], btcr14: (t) => I.btcr14[at(t)], btcr30: (t) => I.btcr30[at(t)], btcath: (t) => I.btcath[at(t)],
  alt7: (t) => r(t, 7) * 100, alt30: (t) => r(t, 30) * 100, div30: (t) => I.btcr30[at(t)] - r(t, 30) * 100, accel: (t) => r(t, 7) * 100 - r(t - 7, 23) * 100 * 7 / 23,
};
const SIG = [
  ['жадность > 75', (t) => F.fng(t) > 75], ['жадность > 80', (t) => F.fng(t) > 80], ['жадность > 90', (t) => F.fng(t) > 90],
  ['фандинг 7 дн > 0,5%', (t) => F.fund7(t) > 0.5], ['фандинг 7 дн > 1%', (t) => F.fund7(t) > 1], ['фандинг 30 дн > 2%', (t) => F.fund30(t) > 2], ['фандинг 30 дн > 4%', (t) => F.fund30(t) > 4],
  ['OI в BTC за 14 дн > 10%', (t) => F.oic14(t) > 10], ['OI в BTC за 14 дн > 15%', (t) => F.oic14(t) > 15], ['OI в BTC за 30 дн > 15%', (t) => F.oic30(t) > 15], ['OI в BTC за 30 дн > 25%', (t) => F.oic30(t) > 25],
  ['OI в $ за 30 дн > 30%', (t) => F.oi30(t) > 30], ['OI в $ за 30 дн > 50%', (t) => F.oi30(t) > 50],
  ['лонги/шорты > 1,5', (t) => F.ls(t) > 1.5], ['лонги/шорты к средней > 1,2', (t) => F.lsr(t) > 1.2], ['лонги/шорты к средней > 1,4', (t) => F.lsr(t) > 1.4], ['топ-трейдеры к средней > 1,3', (t) => F.tlsr(t) > 1.3],
  ['альты +15% за 7 дн', (t) => F.alt7(t) > 15], ['альты +25% за 7 дн', (t) => F.alt7(t) > 25], ['альты +40% за 30 дн', (t) => F.alt30(t) > 40], ['ускорение > 10 п.п.', (t) => F.accel(t) > 10],
  ['BTC +20% за 14 дн', (t) => F.btcr14(t) > 20], ['BTC +30% за 30 дн', (t) => F.btcr30(t) > 30],
  ['BTC обгоняет альты на 15 п.п. за 30 дн', (t) => F.div30(t) > 15], ['альты обгоняют BTC на 20 п.п. за 30 дн', (t) => F.div30(t) < -20], ['BTC у максимума (< 5%), альты −10% за 30 дн', (t) => F.btcath(t) < 5 && F.alt30(t) < -10],
  ['объём BTC > 2× средней', (t) => F.vol(t) > 2], ['объём BTC > 3× средней', (t) => F.vol(t) > 3],
  ['жадность > 75 и фандинг 7 дн > 0,5%', (t) => F.fng(t) > 75 && F.fund7(t) > 0.5], ['жадность > 75 и OI 30 дн > 15%', (t) => F.fng(t) > 75 && F.oic30(t) > 15],
  ['жадность > 75 и альты +40% за 30 дн', (t) => F.fng(t) > 75 && F.alt30(t) > 40], ['жадность > 75 и BTC +20% за 30 дн', (t) => F.fng(t) > 75 && F.btcr30(t) > 20],
  ['фандинг 7 дн > 0,5% и OI 30 дн > 15%', (t) => F.fund7(t) > 0.5 && F.oic30(t) > 15], ['фандинг 7 дн > 0,5% и лонги/шорты к средней > 1,2', (t) => F.fund7(t) > 0.5 && F.lsr(t) > 1.2],
  ['счёт ≥ 3 из 5 (жадн. > 75, фанд7 > 0,5, OI30 > 15, ЛШ > 1,2, альты +25%/30 дн)', (t) => [F.fng(t) > 75, F.fund7(t) > 0.5, F.oic30(t) > 15, F.lsr(t) > 1.2, F.alt30(t) > 25].filter(Boolean).length >= 3],
];
const crashIn = (t, a, b) => { for (let k = a; k <= b; k++) if (crashDay.has(t + k)) return true; return false; };
const pct = (x) => (x * 100).toFixed(0) + '%';
function study(name, f, need) {
  const days = []; let t0 = null, t1 = null;
  for (let t = T0; t <= tEnd - 14; t++) { const v = need(t); if (!isFinite(v)) continue; if (t0 == null) t0 = t; t1 = t; if (f(t)) days.push(t); }
  const se = []; for (const t of days) { if (se.length && t - se[se.length - 1].last < 14) se[se.length - 1].last = t; else se.push({ t, last: t }); }
  const hit = se.filter((e) => crashIn(e.t, 1, e.last - e.t + 14)).length;
  const ok = (e) => e.t > t0 + 14 && e.t <= t1 + 14;
  const cov = eps.filter(ok), caught = cov.filter((e) => days.some((d) => e.t - d >= 1 && e.t - d <= 14));
  const inn = INN.filter((t) => t > t0 + 14 && t <= t1 + 14), innC = inn.filter((t) => days.some((d) => t - d >= 1 && t - d <= 14));
  const nm = NAMED.filter((t) => t > t0 + 14 && t <= t1 + 14), nmC = nm.filter((t) => days.some((d) => t - d >= 1 && t - d <= 14));
  const f30 = K.med(se.filter((e) => isFinite(r(e.t + 30, 30))).map((e) => r(e.t + 30, 30) * 100)), f60 = K.med(se.filter((e) => isFinite(r(e.t + 60, 60))).map((e) => r(e.t + 60, 60) * 100));
  // база: любой день отрезка — доля дней с обвалом в 1–14 дней, медиана 30/60 дн
  const all = []; for (let t = t0; t <= t1; t++) all.push(t);
  const base = all.filter((t) => crashIn(t, 1, 14)).length / all.length, sdays = days.filter((t) => crashIn(t, 1, 14)).length / Math.max(1, days.length);
  const d30 = K.med(days.map((t) => r(t + 30, 30)).filter(isFinite)) * 100, b30 = K.med(all.map((t) => r(t + 30, 30)).filter(isFinite)) * 100;
  return { d30, b30, name, from: L.day(t0), nd: days.length, ne: se.length, hit, prec: hit / Math.max(1, se.length), dayp: sdays, base, caught: caught.length, cov: cov.length, innC: innC.length, inn: inn.length, nmC: nmC.length, nm: nm.length, f30, f60, se: se.map((e) => L.day(e.t)) };
}
const need = { fng: F.fng, fund: F.fund7, oi: F.oic30, oid: F.oi30, ls: F.ls, lsr: F.lsr, tlsr: F.tlsr, any: (t) => r(t, 37) };
const pick = (nm) => (/OI в \$/.test(nm) ? need.oid : /OI/.test(nm) ? need.oi : /топ/.test(nm) ? need.tlsr : /лонги\/шорты к/.test(nm) ? need.lsr : /лонги\/шорты/.test(nm) ? need.ls : /фандинг/.test(nm) ? need.fund : /счёт/.test(nm) ? need.lsr : /жадность/.test(nm) ? need.fng : need.any);
console.log('признак | с | дней | эпизодов | эп. с обвалом ≤14 дн (точность) | день→обвал ≤14 дн (база) | обвалов с признаком за 1–14 дн | из 8 «в рынке» | из 6 названных | рынок альтов +30/+60 дн от эпизода | +30 дн от дня признака (любой день)');
const OUT = [];
const all0 = study('любой день (с 2018-06)', () => true, need.any); console.log(`${all0.name} | ${all0.from} | ${all0.nd} | — | — | ${pct(all0.dayp)} | — | — | — | — | ${all0.d30.toFixed(1)}%`);
for (const [nm, f] of SIG) { const o = study(nm, f, pick(nm)); OUT.push(o); console.log(`${o.name} | ${o.from} | ${o.nd} | ${o.ne} | ${o.hit} (${pct(o.prec)}) | ${pct(o.dayp)} (${pct(o.base)}) | ${o.caught}/${o.cov} | ${o.innC}/${o.inn} | ${o.nmC}/${o.nm} | ${o.f30.toFixed(0)}/${o.f60.toFixed(0)}% | ${o.d30.toFixed(1)} (${o.b30.toFixed(1)})%`); }
// медиана 30/60 дн для любого дня жадности > 75 (база для ложной тревоги на жадном рынке)
require('fs').writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(OUT, null, 1));
