/* Правила по рынку деривативов (следы ликвидаций, фандинг, перекос лонгов/шортов) поверх «Тихая вершина + капитуляция».
   Данные с 2020-09 (BTC) / 2021-12 (ETH): до этого правила молчат. Запуск: node app/liq_rules.js <папка со страницами> */
const fs = require('fs');
const { lab, c, stable, report } = require('./lab.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const BASE = JSON.parse(fs.readFileSync(__dirname + '/found/quiet-capit.json', 'utf8'));
const [CAP, PANIC, ST, WK, RB, QT] = BASE.rules;

const injLiq = (EX) => {
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW);
  for (const k of SETS.avg) {
    setup(k, true);
    if (IND.oic3) continue;
    const add = (key, v) => { IND[key] = { v, step: 1, min: 0, max: 1, short: key, name: key }; };
    const at = {}; EX.t.forEach((t, i) => (at[t] = i));
    const S = (key) => { let last = NaN; return H.t.map((t) => { const i = at[t]; if (i != null && EX[key][i] != null) last = EX[key][i]; else if (i == null) last = NaN; return last; }); };
    const chg = (a, n) => a.map((x, i) => (i >= n ? (x / a[i - n] - 1) * 100 : NaN)), sum = (a, n) => a.map((x, i) => { if (i < n - 1) return NaN; let s = 0; for (let j = i - n + 1; j <= i; j++) s += a[j]; return s; });
    const mean = (a, n) => sum(a, n).map((x) => x / n), mx = (a, n) => a.map((x, i) => { let m = -Infinity; for (let j = Math.max(0, i - n + 1); j <= i; j++) if (a[j] > m) m = a[j]; return m; });
    const mn = (a, n) => a.map((x, i) => { let m = Infinity; for (let j = Math.max(0, i - n + 1); j <= i; j++) if (a[j] < m) m = a[j]; return m; });
    const fix = (a) => { let last = NaN; return a.map((x) => { if (x > 0 && !(x < 0.7 * last)) last = x; else if (x > 0 && x < 0.7 * last) return last; return x > 0 ? x : last; }); };   // сбои архива: OI обнуляется на день
    const oic = fix(S('boic')), oiv = S('boi'), p = oiv.map((v, i) => v / oic[i]), eoic = S('eoic'), fund = S('bfund'), ls = S('bls'), tls = S('btls'), tk = S('btaker'), lo = S('boimin'), hi = S('boimax');
    const oic3 = chg(oic, 3); add('oic3', oic3); add('oic7', chg(oic, 7)); add('oic14', chg(oic, 14)); add('eoic7', chg(eoic, 7));
    add('oidd30', oic.map((x, i) => (x / mx(oic, 30)[i] - 1) * 100));
    add('bp3', chg(p, 3)); add('bp7', chg(p, 7));
    add('fund7', sum(fund, 7)); add('fund30', sum(fund, 30));
    add('lsr', ls.map((x, i) => x / mean(ls, 90)[i])); add('ls', ls); add('tlsr', tls.map((x, i) => x / mean(tls, 90)[i]));
    add('taker7', mean(tk, 7)); add('oir', hi.map((x, i) => (1 - lo[i] / x) * 100));
    add('flush10', mn(oic3, 10)); add('oi30', chg(oiv, 30)); add('oic30', chg(oic, 30));
  }
  setup(cur, true);
};

const L = [{ tag: 'БАЗА: Тихая вершина + капитуляция', S: BASE }];
const pct = (g) => (g >= 2 ? 'весь резерв' : Math.round((g - 1) * 100) + '%');
const buy = (kind, tag, conds, gs = [1.25, 1.5, 2]) => { for (const g of gs) L.push({ kind, tag: `${tag} → ${pct(g)}`, S: { base: 1, rules: [CAP, { act: g, conds }, PANIC, ST, WK, RB, QT] } }); };
const sell = (kind, tag, conds, fs_ = [-0.05, -0.1]) => { for (const f of fs_) L.push({ kind, tag: `${tag} → продать ${-f * 100}%`, S: { base: 1, rules: [CAP, PANIC, ST, WK, RB, { act: f, conds }, QT] } }); };
const ARG = process.argv[3] || 'r2';
for (const x of [20, 22, 25, 28, 30, 35]) buy('oidd', `OI ниже максимума за 30 дней на ${x}%+`, [c('oidd30', '<', -x)], [1.15, 1.25, 1.35, 1.5]);
for (const x of [-0.2, -0.1, 0, 0.1]) buy('fund30', `фандинг за 30 дней < ${x}%`, [c('fund30', '<', x)], [1.15, 1.25, 1.5]);
for (const x of [20, 25]) for (const g of [1.25, 1.5]) L.push({ kind: 'both', tag: `OI ниже максимума на ${x}%+ ИЛИ фандинг за 30 дней < 0 → ${pct(g)}`, S: { base: 1, rules: [CAP, { act: g, conds: [c('oidd30', '<', -x)] }, { act: g, conds: [c('fund30', '<', 0)] }, PANIC, ST, WK, RB, QT] } });
for (const x of [1.0, 1.02]) buy('taker', `агрессивные продажи: тейкеры за 7 дн < ${x}`, [c('taker7', '<', x)], [1.25, 1.5]);
for (const x of [2, 3, 4, 5]) sell('hotfund', `фандинг за 30 дней > ${x}%`, [c('fund30', '>', x)]);
for (const x of [2, 3]) sell('hotoi', `OI в монетах +30% за 30 дн и фандинг за 30 дн > ${x}%`, [c('oic30', '>', 30), c('fund30', '>', x)]);
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  for (const g in lb.pages) await lb.pages[g].evaluate(injLiq, LIQ);
  // сколько дней срабатывает каждое правило (на истории первой монеты страницы own, обычно с 2020-09)
  const cnt = await lb.pages.own.evaluate((L) => { setup(SETS.avg[0], true); return L.map((x) => { if (!x.kind) return 0;
    const rr = x.S.rules.find((q) => q.conds.some((cd) => ['oic3','oic7','oidd30','oir','flush10','fund7','fund30','lsr','tlsr','taker7','oic30'].includes(cd.ind)));
    return H.t.filter((t, i) => rr.conds.every((cd) => { const v = IND[cd.ind].v[i]; return cd.op === '<' ? v < cd.v : v > cd.v; })).length; }); }, L);
  const rows = await lb.run(L); await lb.close();
  const base = rows[0];
  console.log(`${base.tag}\n${report(base)}\n`);
  const ok = (r) => [stable(r, base, 'sel') && r.sel.med > base.sel.med, stable(r, base, 'ex') && r.ex.med > base.ex.med, r.rnd.pos >= base.rnd.pos && r.rnd.worst >= base.rnd.worst - 0.5 && r.rnd.med >= base.rnd.med];
  console.log('правило | дней | отбор медиана/худш.пол./половин+ | экзамен то же | 50 случайных медиана/половин+ | ✔');
  const full = []; rows.forEach((r, i) => { if (ok(r).filter(Boolean).length >= 2) full.push(r); console.log(`${r.tag.slice(0, 92).padEnd(92)} ${String(cnt[i]).padStart(4)} | ${r.sel.med.toFixed(0).padStart(4)}/${r.sel.hworst.toFixed(0).padStart(4)}/${r.sel.hpos} | ${r.ex.med.toFixed(0).padStart(4)}/${r.ex.hworst.toFixed(0).padStart(4)}/${r.ex.hpos} | ${r.rnd.med.toFixed(0).padStart(4)}/${r.rnd.hpos} ${ok(r).map((x) => (x ? '✔' : '·')).join('')}`); });
  for (const r of full) console.log(`\n${r.tag}\n${report(r)}`);
  fs.writeFileSync(process.argv[2] + '/liq2.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, ok: ok(r), S: L.find((x) => x.tag === r.tag).S }))));
})();
