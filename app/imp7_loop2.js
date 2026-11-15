/* imp7, круг 2: размеры ПРОДАЖ по режиму рынка (новых сигналов нет — только доля существующих продаж ×k в дни режима).
   Режимы как в круге 1: БЫК (rb200 > 1, rath < 20), МЕДВЕДЬ (rb200 < 1, наклон средней 200 < 0), ВОССТ (rb200 > 1, rath ≥ 40), БОК (остальное).
   Виды продаж: все, страх (fear), тихая вершина (qt), перегрев фандинга (fund). k = 0,5 / 0,75 / 1,25 / 1,5.
   Критерий (заранее): доход к основе > +0,03, строгая ✔, знак одинаковый во всех трёх циклах (+++), соседние k того же знака.
   Запуск: node app/imp7_loop2.js [buy] — с аргументом buy то же для ПОКУПОК (круг 3): все, паника, дно (cap+bottom), разворот (rev). */
const M = require('./imp7_sim.js');
const BUY = process.argv[2] === 'buy';
const G = M.groups(['sel', 'ex', 'rnd']); M.prep(G);
const REG = {
  'БЫК': (I, i) => I.rb200[i] > 1 && I.rath[i] < 20,
  'МЕДВЕДЬ': (I, i) => I.rb200[i] < 1 && I.rsl[i] < 0,
  'ВОССТ': (I, i) => I.rb200[i] > 1 && I.rath[i] >= 40,
  'БОК': (I, i) => !(I.rb200[i] > 1 && I.rath[i] < 20) && !(I.rb200[i] < 1 && I.rsl[i] < 0) && !(I.rb200[i] > 1 && I.rath[i] >= 40) && !isNaN(I.rb200[i]),
};
let q = 0; const FL = {};
for (const r in REG) { FL[r] = 'rg' + q++; M.addFlag(G, FL[r], REG[r]); }
const CS = M.cycSlices(G), base = M.ev(G, M.B0, false), cb = M.cycEv(CS, M.B0);
const KINDS = BUY ? { 'все покупки': (k) => ['panic', 'cap', 'bottom', 'rev', 'ret'].includes(k), 'паника': (k) => k === 'panic', 'дно': (k) => k === 'cap' || k === 'bottom', 'разворот': (k) => k === 'rev' }
  : { 'все продажи': (k) => ['fear', 'qt', 'fund', 'pump'].includes(k), 'страх': (k) => k === 'fear', 'тихая вершина': (k) => k === 'qt', 'фандинг': (k) => k === 'fund' };
const KS = BUY ? [0, 0.5, 0.75, 1.5, 2] : [0.5, 0.75, 1.25, 1.5];
const out = [];
console.log('режим | вид | k | доход к основе | строгая | по циклам: Σлог (лучше/хуже) | знак');
for (const r in REG) for (const kn in KINDS) for (const k of KS) {
  const S = M.scaleK(M.B0, FL[r], k, KINDS[kn]);
  const res = M.ev(G, S, false), cc = M.cycCmp(M.cycEv(CS, S), cb), d = M.d(res, base);
  const o = { r, kn, k, d, pass: M.passes(res, base), why: M.why(res, base), cyc: cc, sign: M.sameSign(cc), med: [res.sel.med, res.ex.med, res.rnd.med] };
  out.push(o);
  console.log(`${r} | ${kn} | ×${k} | ${d >= 0 ? '+' : ''}${d.toFixed(3)} | ${o.pass ? '✔' : '· ' + o.why} | ${M.cycStr(cc)} | ${o.sign} | ${o.med.map((x) => x.toFixed(0)).join('/')}`);
}
require('fs').writeFileSync(`/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp7/loop${BUY ? 3 : 2}.json`, JSON.stringify(out));
