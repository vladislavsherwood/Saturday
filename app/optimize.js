/* Поиск набора правил с максимальным средневзвешенным «итогом к DCA» на истории.

   Считает в самой странице конструктора — теми же индикаторами и на тех же данных.
   Режим: веса, начальный баланс 1000, размер ×1 = 10. Правило — до трёх условий и действие от «продать ×3» до «купить ×3».

   Запуск: node app/optimize.js <страница.html> <секунд на поиск> <куда сохранить .json> [w | pct]
   pct — режим «доля портфеля»: взнос 10 в день, покупка на взнос и долю резерва, продажа доли позиции.
   Четыре параллельных поиска: два на всей истории, два только на первой половине (для проверки на второй). */
const { chromium } = require('playwright');
const fs = require('fs');

const inPage = ({ seed, mode, ms, balance, unit, kind }) => {
  const PCT = kind === 'pct';        // «доля портфеля»: взнос unit в день, действия — доли резерва и позиции
  // ---------- генератор случайных чисел с зерном ----------
  let st = seed >>> 0;
  const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  // ---------- данные каждого актива ----------
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW);
  function prep(part) {
    const A = [];
    for (const k of SETS.avg) {
      setup(k, true);
      let a = 0, b = N;
      if (part === 'train') b = Math.floor(N / 2);
      if (part === 'test') a = Math.floor(N / 2);
      const ind = {};
      for (const key in IND) ind[key] = Float64Array.from(IND[key].v, (x) => (x == null ? NaN : x));
      const c = Float64Array.from(H.c);
      let cash = PCT ? 0 : balance, du = 0;
      for (let i = a; i < b; i++) { const amt = PCT ? unit : Math.min(unit, cash); if (amt > 0) { du += amt / c[i]; if (!PCT) cash -= amt; } }
      A.push({ k, name: RAW.ticker, ind, c, a, b, m: b - a, dca: du * c[b - 1] + cash });
    }
    return A;
  }
  // пороги выбираются из квантилей значений индикатора по всем активам
  setup(SETS.avg[0], true);
  const KEYS = Object.keys(IND), STEP = {}, Q = {};
  for (const key of KEYS) STEP[key] = IND[key].step;
  {
    const pool = {};
    for (const k of SETS.avg) { setup(k, true); for (const key in IND) (pool[key] = pool[key] || []).push(...IND[key].v.filter((x) => x != null && !isNaN(x))); }
    for (const key of KEYS) {
      const v = pool[key].sort((x, y) => x - y), out = [];
      for (let q = 1; q <= 39; q++) { const x = v[Math.floor((q / 40) * (v.length - 1))], s = STEP[key] < 0.02 ? STEP[key] : STEP[key] / 5; out.push(+(Math.round(x / s) * s).toFixed(4)); }
      Q[key] = [...new Set(out)];
    }
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
  function evalS(A, S, detail) {
    let sw = 0, sv = 0;
    const per = [];
    for (const X of A) {
      const rs = S.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind]));
      const arrs = rs.map((r) => r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v])), acts = rs.map((r) => r.act);
      let cash = PCT ? 0 : balance, units = 0, prev = X.a > 0 ? decideAt(arrs, acts, S.base, X.a - 1) : 1;
      for (let i = X.a; i < X.b; i++) {
        const p = X.c[i];
        if (PCT) {
          const before = cash;
          cash += unit;
          if (prev < 0) { const amt = -prev * units * p; if (amt > 0) { units -= amt / p; cash += amt; } }
          else if (prev > 0) { const amt = Math.min(cash, unit + (prev - 1) * before); units += amt / p; cash -= amt; }
        } else if (prev > 0) { const amt = Math.min(prev * unit, cash); if (amt > 0.005) { units += amt / p; cash -= amt; } }
        else if (prev < 0) { const amt = Math.min(-prev * unit, units * p); if (amt > 0.005) { units -= amt / p; cash += amt; } }
        prev = decideAt(arrs, acts, S.base, i);
      }
      const edge = ((units * X.c[X.b - 1] + cash) / X.dca - 1) * 100;
      sw += X.m; sv += edge * X.m;
      if (detail) per.push([X.name, +edge.toFixed(1)]);
    }
    return detail ? { score: sv / sw, per } : sv / sw;
  }

  // ---------- случайные правила и их изменения ----------
  const ACTS = PCT ? [-0.5, -0.4, -0.3, -0.2, -0.15, -0.1, -0.075, -0.05, -0.03, -0.02, -0.01, -0.005, 0, 1, 1.05, 1.1, 1.25, 1.5, 1.75, 2] : [-3, -2, -1, 0, 1, 2, 3];
  const BASES = PCT ? [0, 1] : [0, 1, 2, 3];
  const newCond = () => { const ind = pick(KEYS); return { ind, op: rnd() < 0.5 ? '<' : '>', v: pick(Q[ind]) }; };
  const newRule = () => ({ conds: Array.from({ length: 1 + Math.floor(rnd() * 3) }, newCond), act: pick(ACTS) });
  const clone = (S) => ({ base: S.base, rules: S.rules.map((r) => ({ act: r.act, conds: r.conds.map((c) => ({ ...c })) })) });
  function mutate(S0) {
    const S = clone(S0), u = rnd();
    const r = S.rules.length ? pick(S.rules) : null;
    if (!r || (u < 0.12 && S.rules.length < 10)) S.rules.splice(Math.floor(rnd() * (S.rules.length + 1)), 0, newRule());
    else if (u < 0.2 && S.rules.length > 1) S.rules.splice(S.rules.indexOf(r), 1);
    else if (u < 0.5) { const c = pick(r.conds), q = Q[c.ind]; let j = q.indexOf(c.v); if (j < 0) j = Math.floor(rnd() * q.length); j = Math.max(0, Math.min(q.length - 1, j + (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * 3)))); c.v = q[j]; }
    else if (u < 0.6) { const j = ACTS.indexOf(r.act); r.act = rnd() < 0.5 || j < 0 ? pick(ACTS) : ACTS[Math.max(0, Math.min(ACTS.length - 1, j + (rnd() < 0.5 ? -1 : 1)))]; }
    else if (u < 0.68) { const c = pick(r.conds); c.op = c.op === '<' ? '>' : '<'; }
    else if (u < 0.78) r.conds[Math.floor(rnd() * r.conds.length)] = newCond();
    else if (u < 0.85 && r.conds.length < 3) r.conds.push(newCond());
    else if (u < 0.9 && r.conds.length > 1) r.conds.splice(Math.floor(rnd() * r.conds.length), 1);
    else if (u < 0.96 && S.rules.length > 1) { const i = S.rules.indexOf(r), j = Math.floor(rnd() * S.rules.length); [S.rules[i], S.rules[j]] = [S.rules[j], S.rules[i]]; }
    else S.base = pick(BASES);
    return S;
  }

  // ---------- имитация отжига с возвратами к лучшему ----------
  const A = prep(mode === 'train' ? 'train' : 'full');
  let curS = { base: 1, rules: [newRule(), newRule()] }, curV = evalS(A, curS), best = clone(curS), bestV = curV, evals = 1, stall = 0;
  const t0 = Date.now();
  let T = 8;
  while (Date.now() - t0 < ms) {
    for (let it = 0; it < 200; it++) {
      const cand = mutate(curS), v = evalS(A, cand);
      evals++;
      if (v >= curV || rnd() < Math.exp((v - curV) / T)) { curS = cand; curV = v; }
      if (v > bestV + 1e-9) { best = clone(cand); bestV = v; stall = 0; } else stall++;
      if (stall > 4000) { curS = clone(best); curV = bestV; T = 4; stall = 0; }
    }
    T = Math.max(0.15, T * 0.985);
  }
  // убираем правила, которые ничего не дают
  for (let i = best.rules.length - 1; i >= 0 && best.rules.length > 1; i--) {
    const t = clone(best); t.rules.splice(i, 1);
    const v = evalS(A, t);
    if (v >= bestV - 1e-9) { best = t; bestV = v; }
  }
  const out = { seed, mode, kind, evals, best, score: evalS(A, best, true) };
  if (mode === 'train') { out.test = evalS(prep('test'), best, true); out.full = evalS(prep('full'), best, true); }
  out.dcaBase = evalS(A, { base: 1, rules: [] });
  setup(cur, true);
  return out;
};

(async () => {
  const [file, secs, outPath, kind = 'w'] = process.argv.slice(2);
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(file, 'utf8') + '</body></html>';
  const tmp = outPath + '.page.html';
  fs.writeFileSync(tmp, html);
  const browser = await chromium.launch();
  const jobs = [[11, 'full'], [29, 'full'], [47, 'train'], [83, 'train']].map(async ([seed, mode]) => {
    const page = await (await browser.newContext()).newPage();
    page.setDefaultTimeout(0);
    await page.goto('file://' + tmp);
    await page.waitForSelector('.ex-candles svg');
    return page.evaluate(inPage, { seed, mode, ms: Number(secs) * 1000, balance: 1000, unit: 10, kind });
  });
  const res = await Promise.all(jobs);
  // цены каждого актива — для расчёта теоретического потолка
  const page = await (await browser.newContext()).newPage();
  await page.goto('file://' + tmp); await page.waitForSelector('.ex-candles svg');
  const prices = await page.evaluate(() => SETS.avg.map((k) => { setup(k, true); return { name: RAW.ticker, c: Array.from(H.c) }; }));
  fs.writeFileSync(outPath, JSON.stringify({ res, prices }));
  for (const r of res) console.log(r.mode, 'зерно', r.seed, 'проверено вариантов', r.evals, 'правил', r.best.rules.length, 'результат', r.score.score.toFixed(1) + '%', r.test ? '→ на второй половине ' + r.test.score.toFixed(1) + '%' : '');
  await browser.close();
})();
