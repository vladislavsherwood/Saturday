/* Поиск ПРОСТОЙ стратегии, у которой каждый актив в плюсе к DCA.

   Отличия от optimize.js:
   - не больше 3 правил, в каждом 1–2 условия, пороги только по грубой сетке (9 уровней на индикатор);
   - режим «доля портфеля», действий немного: пропуск, взнос, +25% / +50% / весь резерв, продать 2 / 5 / 10 / 25%;
   - цель — не среднее, а ХУДШИЙ актив: максимизируется минимум итога к DCA по всем активам;
   - каждый актив считается с комиссией 0,1% и в двух вариантах — сделка на следующий день и ещё на день позже; берётся худший;
   - за каждое лишнее условие небольшой штраф.

   Проверки: поиск на первой половине истории → вторая половина; поиск на шести активах → три остальных;
   и готовая стратегия на странице с монетами, которых поиск не видел вообще.

   Запуск: node app/simple.js <страница.html> <секунд> <куда сохранить .json> <страница монет отбора.html> [страница экзаменационных монет.html]
   Поиск идёт на активах первой страницы, из найденных кандидатов выбирается лучший на монетах отбора, итог проверяется на экзаменационных. */
const { chromium } = require('playwright');
const fs = require('fs');

const inPage = ({ seed, mode, ms, unit, evalOnly, evalMany, maxRules = 3, maxConds = 2, part = 'full' }) => {
  let st = seed >>> 0;
  const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const FEE = 0.001, PEN = 0.15;
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW);

  function prep(part, only) {
    const A = [];
    SETS.avg.forEach((k, n) => {
      if (only && !only.includes(n)) return;
      setup(k, true);
      let a = 0, b = N;
      if (part === 'h1') b = Math.floor(N / 2);
      if (part === 'h2') a = Math.floor(N / 2);
      const ind = {};
      for (const key in IND) ind[key] = Float64Array.from(IND[key].v, (x) => (x == null ? NaN : x));
      const c = Float64Array.from(H.c);
      let du = 0;
      for (let i = a; i < b; i++) du += (unit * (1 - FEE)) / c[i];
      A.push({ name: RAW.ticker, ind, c, a, b, m: b - a, dca: du * c[b - 1] });
    });
    return A;
  }
  function decideAt(arrs, acts, base, i) {
    for (let r = 0; r < arrs.length; r++) {
      const cs = arrs[r];
      let ok = true;
      for (let q = 0; q < cs.length; q++) { const v = cs[q][0][i]; if (!(cs[q][1] ? v < cs[q][2] : v > cs[q][2])) { ok = false; break; } }
      if (ok) return acts[r];
    }
    return base;
  }
  // итог к DCA одного актива, %: комиссия FEE, сделка через lag+1 дней после решения
  function edgeOf(X, S, lag) {
    // pnl — прибыль позиции к средней цене покупки, %: зависит от самих сделок, поэтому считается по ходу расчёта
    const P = new Float64Array(X.c.length).fill(NaN), I = (k) => (k === 'pnl' ? P : X.ind[k]);
    const rs = S.rules.filter((r) => r.conds.every((cd) => I(cd.ind)));
    const arrs = rs.map((r) => r.conds.map((cd) => [I(cd.ind), cd.op === '<', cd.v])), acts = rs.map((r) => r.act);
    let cash = 0, units = 0, sells = 0, buys = 0, cost = 0;
    for (let i = X.a; i < X.b; i++) {
      const p = X.c[i], j = i - 1 - lag, a = j >= 0 ? decideAt(arrs, acts, S.base, j) : 1, before = cash;
      cash += unit;
      if (a < 0) { const amt = -a * units * p; if (amt > 0) { units -= amt / p; cost *= 1 + a; cash += amt * (1 - FEE); sells++; } }
      else if (a > 0) { const amt = Math.min(cash, unit + (a - 1) * before); units += (amt * (1 - FEE)) / p; cost += amt; cash -= amt; buys++; }
      if (cost > 0) P[i] = ((units * p) / cost - 1) * 100;
    }
    return { e: ((units * X.c[X.b - 1] + cash) / X.dca - 1) * 100, sells, buys };
  }
  function evalS(A, S, detail) {
    let worst = Infinity, sum = 0, sw = 0, sv = 0;
    const per = [];
    for (const X of A) {
      const r0 = edgeOf(X, S, 0), r1 = edgeOf(X, S, 1), e = Math.min(r0.e, r1.e);
      if (e < worst) worst = e;
      sum += e; sw += X.m; sv += r0.e * X.m;
      if (detail) per.push([X.name, +r0.e.toFixed(1), +r1.e.toFixed(1), r0.buys, r0.sells, X.m]);
    }
    const nc = S.rules.reduce((x, r) => x + r.conds.length, 0);
    const score = worst + 0.02 * (sum / A.length) - PEN * nc;
    return detail ? { score, worst, mean: sum / A.length, wavg: sv / sw, per } : score;
  }
  if (evalMany) {          // оценка списка готовых стратегий на активах этой страницы
    const A = prep(part), out = evalMany.map((S) => { const r = evalS(A, S, true); return { worst: r.worst, mean: r.mean, pos: r.per.filter((p) => Math.min(p[1], p[2]) > 0).length, n: r.per.length, e: r.per.map((p) => Math.min(p[1], p[2])), names: r.per.map((p) => p[0]) }; });
    setup(cur, true);
    return out;
  }
  if (evalOnly) {
    const out = { full: evalS(prep('full'), evalOnly, true), h1: evalS(prep('h1'), evalOnly, true), h2: evalS(prep('h2'), evalOnly, true) };
    setup(cur, true);
    return out;
  }

  // ---------- грубая сетка порогов ----------
  setup(SETS.avg[0], true);
  const KEYS = Object.keys(IND).filter((k) => SETS.avg.every((a) => { setup(a, true); return IND[k]; }));   // только общие для всех активов
  const Q = {};
  {
    const pool = {};
    for (const k of SETS.avg) { setup(k, true); for (const key of KEYS) (pool[key] = pool[key] || []).push(...IND[key].v.filter((x) => x != null && !isNaN(x))); }
    for (const key of KEYS) {
      const v = pool[key].sort((x, y) => x - y), s = IND[key].step, out = [];
      for (let q = 1; q <= 9; q++) out.push(+(Math.round(v[Math.floor((q / 10) * (v.length - 1))] / s) * s).toFixed(4));
      Q[key] = [...new Set(out)];
    }
  }
  const ACTS = [-0.25, -0.1, -0.05, -0.02, 0, 1, 1.25, 1.5, 2], BASES = [0, 1];
  const newCond = () => { const ind = pick(KEYS); return { ind, op: rnd() < 0.5 ? '<' : '>', v: pick(Q[ind]) }; };
  const newRule = () => ({ conds: Array.from({ length: 1 + (maxConds > 1 && rnd() < 0.35 ? 1 : 0) + (maxConds > 2 && rnd() < 0.15 ? 1 : 0) }, newCond), act: pick(ACTS) });
  const clone = (S) => ({ base: S.base, rules: S.rules.map((r) => ({ act: r.act, conds: r.conds.map((c) => ({ ...c })) })) });
  function mutate(S0) {
    const S = clone(S0), u = rnd(), r = S.rules.length ? pick(S.rules) : null;
    if (!r || (u < 0.12 && S.rules.length < maxRules)) S.rules.splice(Math.floor(rnd() * (S.rules.length + 1)), 0, newRule());
    else if (u < 0.22 && S.rules.length > 1) S.rules.splice(S.rules.indexOf(r), 1);
    else if (u < 0.5) { const c = pick(r.conds), q = Q[c.ind]; let j = q.indexOf(c.v); if (j < 0) j = Math.floor(rnd() * q.length); c.v = q[Math.max(0, Math.min(q.length - 1, j + (rnd() < 0.5 ? -1 : 1)))]; }
    else if (u < 0.62) r.act = pick(ACTS);
    else if (u < 0.7) { const c = pick(r.conds); c.op = c.op === '<' ? '>' : '<'; }
    else if (u < 0.8) r.conds[Math.floor(rnd() * r.conds.length)] = newCond();
    else if (u < 0.86 && r.conds.length < maxConds) r.conds.push(newCond());
    else if (u < 0.92 && r.conds.length > 1) r.conds.splice(Math.floor(rnd() * r.conds.length), 1);
    else if (u < 0.97 && S.rules.length > 1) { const i = S.rules.indexOf(r), j = Math.floor(rnd() * S.rules.length); [S.rules[i], S.rules[j]] = [S.rules[j], S.rules[i]]; }
    else S.base = pick(BASES);
    return S;
  }

  const trainSet = mode === 'assets' ? [0, 1, 2, 3, 5, 7] : null;          // шесть активов для поиска, три — на проверку
  const A = prep(mode === 'time' ? 'h1' : part, trainSet);
  let curS = { base: 1, rules: [newRule()] }, curV = evalS(A, curS), best = clone(curS), bestV = curV, evals = 1, stall = 0, T = 3;
  const pool = new Map();      // кандидаты: разные стратегии, у которых все активы поиска в плюсе
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    for (let it = 0; it < 200; it++) {
      const cand = mutate(curS), v = evalS(A, cand);
      evals++;
      if (v >= curV || rnd() < Math.exp((v - curV) / T)) { curS = cand; curV = v; }
      if (v > bestV + 1e-9) { best = clone(cand); bestV = v; stall = 0; } else stall++;
      if (v > 0 && pool.size < 4000) { const key = JSON.stringify(cand); if (!pool.has(key)) pool.set(key, v); }
      if (stall > 3000) { curS = rnd() < 0.5 ? clone(best) : { base: pick(BASES), rules: [newRule()] }; curV = evalS(A, curS); T = 2; stall = 0; }
    }
    T = Math.max(0.1, T * 0.985);
  }
  const top = [...pool.entries()].sort((x, y) => y[1] - x[1]).slice(0, 400).map(([k, v]) => ({ S: JSON.parse(k), train: v }));
  const out = { seed, mode, evals, best, train: evalS(A, best, true), pool: top, maxRules, maxConds };
  if (mode === 'time') out.test = evalS(prep('h2'), best, true);
  if (mode === 'assets') out.test = evalS(prep('full', [4, 6, 8]), best, true);
  setup(cur, true);
  return out;
};

async function open(browser, file, tag) {
  const tmp = file + '.' + tag + '.page.html';
  fs.writeFileSync(tmp, '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(file, 'utf8') + '</body></html>');
  const page = await (await browser.newContext()).newPage();
  page.setDefaultTimeout(0);
  await page.goto('file://' + tmp);
  await page.waitForSelector('.ex-candles svg');
  return page;
}

// Экзамен готовой стратегии: node app/simple.js --exam <стратегия.json> <название=страница.html> ...
async function examOnly(args) {
  const [stratFile, ...pages] = args, S = JSON.parse(fs.readFileSync(stratFile, 'utf8'));
  const browser = await chromium.launch(), out = {};
  for (const spec of pages) {
    const [name, file] = spec.split('=');
    const c = await (await open(browser, file, 'ex' + name)).evaluate(inPage, { seed: 1, unit: 10, evalOnly: S });
    out[name] = c;
    for (const [t, x] of [['вся история', c.full], ['первая половина', c.h1], ['вторая половина', c.h2]])
      console.log(`${name}, ${t}: в плюсе ${x.per.filter((p) => Math.min(p[1], p[2]) > 0).length} из ${x.per.length}, худший ${x.worst.toFixed(1)}%, средний ${x.mean.toFixed(0)}%, средневзв. ${x.wavg.toFixed(0)}% | ` + x.per.map((p) => `${p[0]} ${Math.round(p[1])}/${Math.round(p[2])}`).join(', '));
  }
  fs.writeFileSync(stratFile + '.exam.json', JSON.stringify(out));
  await browser.close();
}

module.exports = { inPage, open };
if (require.main === module) (async () => {
  if (process.argv[2] === '--exam') return examOnly(process.argv.slice(3));
  const [file, secs, outPath, validFile, examFile, part = 'full', preset = 'simple'] = process.argv.slice(2);      // part = h1: поиск и отбор только на первой половине истории
  const browser = await chromium.launch();
  // четыре поиска разной сложности на наших активах
  // наборы поисков: [зерно, правил не больше, условий в правиле не больше]
  const cfg = { simple: [[5, 1, 2], [17, 2, 1], [23, 2, 2], [41, 3, 2]], big: [[5, 4, 3], [17, 5, 3], [23, 6, 3], [41, 6, 2]],
                mix: [[5, 2, 2], [17, 3, 2], [23, 4, 3], [41, 6, 3]] }[preset];
  const res = await Promise.all(cfg.map(async ([seed, maxRules, maxConds]) =>
    (await open(browser, file, 's' + seed)).evaluate(inPage, { seed, mode: 'full', ms: Number(secs) * 1000, unit: 10, maxRules, maxConds, part })));
  const show = (S) => S.rules.map((r) => r.conds.map((c) => `${c.ind} ${c.op} ${c.v}`).join(' и ') + ' → ' + r.act).join(' | ') + ' | иначе ' + S.base;
  for (const r of res) console.log(`поиск: до ${r.maxRules} правил по ${r.maxConds} условия — вариантов ${r.evals}, кандидатов ${r.pool.length}, лучший: худший актив ${r.train.worst.toFixed(1)}%, средний ${r.train.mean.toFixed(1)}%\n    ${show(r.best)}`);
  // отбор: все кандидаты оцениваются на монетах, которых поиск не видел
  const cands = res.flatMap((r) => r.pool.map((c) => ({ ...c, maxRules: r.maxRules, maxConds: r.maxConds })));
  const sel = await (await open(browser, validFile, 'val')).evaluate(inPage, { seed: 1, unit: 10, evalMany: cands.map((c) => c.S), part });
  cands.forEach((c, i) => Object.assign(c, { sel: sel[i], nc: c.S.rules.reduce((x, r) => x + r.conds.length, 0) }));
  const allPos = cands.filter((c) => c.sel.pos === c.sel.n);
  console.log(`кандидатов всего ${cands.length}; на монетах отбора в плюсе все ${sel[0].n}: ${allPos.length}; 7 из 8: ${cands.filter((c) => c.sel.pos === c.sel.n - 1).length}`);
  // выбираем по худшей монете отбора; при близких значениях — ту, что проще
  cands.sort((x, y) => (y.sel.pos - x.sel.pos) || ((y.sel.worst - 0.5 * y.nc) - (x.sel.worst - 0.5 * x.nc)));
  const best = cands[0].S;
  const check = { own: await (await open(browser, file, 'own')).evaluate(inPage, { seed: 1, unit: 10, evalOnly: best }),
                  select: await (await open(browser, validFile, 'val2')).evaluate(inPage, { seed: 1, unit: 10, evalOnly: best }) };
  if (examFile) check.exam = await (await open(browser, examFile, 'exam')).evaluate(inPage, { seed: 1, unit: 10, evalOnly: best });
  // для сравнения: как сдают экзамен «лучшие по нашим активам» без отбора
  const naive = examFile ? await (await open(browser, examFile, 'exam2')).evaluate(inPage, { seed: 1, unit: 10, evalMany: res.map((r) => r.best) }) : null;
  fs.writeFileSync(outPath, JSON.stringify({ best, check, top: cands.slice(0, 15), naive, searches: res.map((r) => ({ best: r.best, train: r.train, maxRules: r.maxRules, maxConds: r.maxConds })) }, null, 1));
  console.log('ВЫБРАНА: ' + show(best) + `  (условий ${cands[0].nc})`);
  const line = (t, x) => console.log(`  ${t}: в плюсе ${x.per.filter((p) => Math.min(p[1], p[2]) > 0).length} из ${x.per.length}, худший ${x.worst.toFixed(1)}%, средний ${x.mean.toFixed(1)}% | ` + x.per.map((p) => `${p[0]} ${p[1]}/${p[2]}`).join(', '));
  for (const [name, c] of [['наши активы', check.own], ['монеты отбора', check.select], ['ЭКЗАМЕН', check.exam]]) if (c) { line(name + ', вся история', c.full); line(name + ', первая половина', c.h1); line(name + ', вторая половина', c.h2); }
  if (naive) console.log('для сравнения, лучшие по нашим активам без отбора — на экзамене: ' + naive.map((x) => `в плюсе ${x.pos}/${x.n}, худший ${x.worst.toFixed(0)}%, средний ${x.mean.toFixed(0)}%`).join(' ; '));
  await browser.close();
})();
