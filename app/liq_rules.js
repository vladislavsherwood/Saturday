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
// 1. вынос лонгов: открытый интерес резко упал вместе с ценой
for (const x of [5, 8, 12]) buy('flush3', `вынос лонгов: OI биткоина −${x}%+ за 3 дня и цена падает`, [c('oic3', '<', -x), c('bp3', '<', 0)]);
for (const x of [10, 15, 20]) buy('flush7', `вынос лонгов: OI −${x}%+ за 7 дней и цена падает`, [c('oic7', '<', -x), c('bp7', '<', 0)]);
for (const x of [15, 20, 25]) buy('oidd', `OI ниже максимума за 30 дней на ${x}%+`, [c('oidd30', '<', -x)]);
for (const x of [3, 5, 8]) buy('oir', `ликвидационный день: OI за день ходил на ${x}%+ и цена за 3 дня упала`, [c('oir', '>', x), c('bp3', '<', -3)]);
// 2. как маркет-мейкер: после выноса дождаться, пока цена перестанет падать
for (const x of [8, 12]) for (const r of [0, 3]) buy('mm', `после выноса (OI −${x}% за 3 дня в последние 10 дней) цена за 3 дня ${r ? 'выросла на ' + r + '%+' : 'не падает'}`, [c('flush10', '<', -x), c('bp3', '>', r)]);
// 3. фандинг: шорты платят лонгам
for (const x of [0, -0.02, -0.05]) buy('fund7', `фандинг за 7 дней < ${x}%`, [c('fund7', '<', x)]);
for (const x of [0, 0.05]) buy('fund30', `фандинг за 30 дней < ${x}%`, [c('fund30', '<', x)]);
// 4. толпа в шортах
for (const x of [0.85, 0.9]) buy('lsr', `доля лонгов у счетов ниже обычной (к средней 90 дн < ${x})`, [c('lsr', '<', x)]);
for (const x of [0.85, 0.9]) buy('tlsr', `топ-трейдеры в шортах сильнее обычного (к средней 90 дн < ${x})`, [c('tlsr', '<', x)]);
for (const x of [0.85, 0.9]) buy('taker', `агрессивные продажи: покупки/продажи тейкеров за 7 дн < ${x}`, [c('taker7', '<', x)]);
// 5. сочетание: вынос + отрицательный фандинг
for (const x of [5, 8]) buy('combo', `вынос лонгов (OI −${x}% за 3 дня) и фандинг за 7 дней < 0`, [c('oic3', '<', -x), c('fund7', '<', 0)]);
// 6. перегрев (для продажи)
for (const x of [0.2, 0.3, 0.5]) sell('hotfund', `фандинг за 30 дней > ${x}%`, [c('fund30', '>', x)]);
for (const x of [30, 50]) sell('hotoi', `OI в монетах вырос на ${x}%+ за 30 дней и фандинг > 0.1%`, [c('oic30', '>', x), c('fund30', '>', 0.1)]);
for (const x of [1.15, 1.25]) sell('hotls', `лонгов у счетов больше обычного (к средней > ${x})`, [c('lsr', '>', x)]);

(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  for (const g in lb.pages) await lb.pages[g].evaluate(injLiq, LIQ);
  // сколько дней срабатывает каждое правило (на истории первой монеты страницы own, обычно с 2020-09)
  const cnt = await lb.pages.own.evaluate((L) => { setup(SETS.avg[0], true); return L.map((x) => { const r = x.S.rules.find((q, i) => i === 1 && q.act > 0) || x.S.rules[5]; if (!x.kind) return 0;
    const rr = x.S.rules.find((q) => q.conds.some((cd) => ['oic3','oic7','oidd30','oir','flush10','fund7','fund30','lsr','tlsr','taker7','oic30'].includes(cd.ind)));
    return H.t.filter((t, i) => rr.conds.every((cd) => { const v = IND[cd.ind].v[i]; return cd.op === '<' ? v < cd.v : v > cd.v; })).length; }); }, L);
  const rows = await lb.run(L); await lb.close();
  const base = rows[0];
  console.log(`${base.tag}\n${report(base)}\n`);
  const ok = (r) => [stable(r, base, 'sel') && r.sel.med > base.sel.med, stable(r, base, 'ex') && r.ex.med > base.ex.med, r.rnd.pos >= base.rnd.pos && r.rnd.worst >= base.rnd.worst - 0.5 && r.rnd.med >= base.rnd.med];
  console.log('правило | дней | отбор медиана/худш.пол./половин+ | экзамен то же | 50 случайных медиана/половин+ | ✔');
  rows.forEach((r, i) => console.log(`${r.tag.slice(0, 92).padEnd(92)} ${String(cnt[i]).padStart(4)} | ${r.sel.med.toFixed(0).padStart(4)}/${r.sel.hworst.toFixed(0).padStart(4)}/${r.sel.hpos} | ${r.ex.med.toFixed(0).padStart(4)}/${r.ex.hworst.toFixed(0).padStart(4)}/${r.ex.hpos} | ${r.rnd.med.toFixed(0).padStart(4)}/${r.rnd.hpos} ${ok(r).map((x) => (x ? '✔' : '·')).join('')}`));
})();
