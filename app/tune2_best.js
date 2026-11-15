/* tune2 круг 5: итог — found/tune2-best.json (combo2 + множитель сильной паники 1,5 → 2,5, доли сильной паники с выносом OI
   62,5 / 100 / 100%) и found/tune2-best-margin.json (маржа по combo2_margin.py — без изменений к combo2).
   Запуск: node app/tune2_best.js (берёт scratchpad tune2_cands.lab.json, tune2_margin.json, если есть) */
const fs = require('fs');
const T = require('./tune2_sim.js');
const D = '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad';
const P = { m: 2.5, cap: 100 };
const S = T.build(P), S1 = T.build({ m: 2.5 });
const G = T.load(['sel', 'ex', 'rnd', 'n100']), L = ['sel', 'ex', 'rnd', 'n100'];
const R = T.ev(G, P, L), R1 = T.ev(G, { m: 2.5 }, L), B = T.ev(G, T.P0, L);
const same = ['sel', 'ex', 'rnd', 'n100'].every((g) => Math.abs(R[g].all.med - R1[g].all.med) < 1e-9);
console.log('потолок 100% не меняет итогов:', same, '| правил', S.rules.length);
const q = T.cmp(R, B);
console.log(T.row('tune2', R, B));
const pick = (x) => ({ med: +x.med.toFixed(1), pos: x.pos, n: x.n, hpos: x.hpos, hn: x.hn, hworst: +x.hworst.toFixed(2), worst: +x.worst.toFixed(2) });
const res = (X) => Object.fromEntries(L.map((g) => [g, Object.fromEntries(['all', 'big', 'alt', 'meme'].filter((s) => X[g][s]).map((s) => [s, pick(X[g][s])]))]));
const CB = T.CB;
const out = {
  name: 'tune2: combo2 + сильная паника в стейблах ×2,5 (вместо ×1,5): при usdt > 1,2 и выносе OI — 62,5% резерва при сильном страхе, весь резерв при страхе и без страха',
  base: CB.base, rules: S.rules, rules_count: S.rules.length,
  rules_human_change: [
    'Меняются только правила #4, #7, #12 combo2 (сильная паника: USDT.D к 200-дн. средней > 1,2 вместе с остальными условиями паники и выносом OI > 8%):',
    ' #4 (сильный страх < 40): 37,5% → 62,5% резерва (25% × 2,5);',
    ' #7 (страх < 52) и #12 (без страха): 75% → 100% резерва (50% × 2,5, не больше всего резерва).',
    'Всё остальное (пороги 1,07 / 200 дн / 25% / 40 / 52 / 7,6% / −8% / 1,2, доли 25 / 50 / 50% с выносом и 10 / 10 / 10% без выноса) — как в combo2.',
  ],
  table: [
    { param: 'USDT.D к 200-дн. средней (u)', was: 1.07, now: 1.07, plateau: 'острый пик: 1,065 −0,071, 1,075 −0,106 (· строгая)', effect: 'не меняю' },
    { param: 'окно средней USDT.D (w), дней', was: 200, now: 200, plateau: 'острый пик: 195 −0,142, 205 −0,185; 225–250 мемам −0,46…−0,69', effect: 'не меняю' },
    { param: 'доля альтов othd <', was: 25, now: 25, plateau: 'острый пик: 24,5 −0,52; 25,5 +0,002 (· 50 сл.); 26 −0,30', effect: 'не меняю' },
    { param: 'сильный страх fng <', was: 40, now: 40, plateau: 'полка 35…42 (Δ ≤ 0,003), ✔ только 40', effect: 'не меняю' },
    { param: 'страх fng <', was: 52, now: 52, plateau: 'полка 46…58 (Δ 0), ✔ 49, 52…58', effect: 'не меняю' },
    { param: 'доля USDT usdtd <', was: 7.6, now: 7.6, plateau: '✔ 7,6…7,8; 7,5 −0,072', effect: 'не меняю (левый край полки — фильтр режима, см. imp8)' },
    { param: 'вынос OI oidd30 <', was: -8, now: -8, plateau: 'пик: −7,5 −0,023; −8,5 +0,007 (·); −9 −0,067', effect: 'не меняю' },
    { param: 'сильная паника usdt >', was: 1.2, now: 1.2, plateau: 'пик слева (1,19 −0,012 ·), справа полка ✔ 1,2…1,24 при m 2', effect: 'не меняю' },
    { param: 'множитель сильной паники (m)', was: 1.5, now: 2.5, plateau: '✔ 1,5…3,8 (4,0 · мемы); вперёд по времени ≥ 0 на всех Y', effect: 'доход +0,058; отбор 2174 → 2264, экзамен 1436 → 1450, 50 сл. 459 → 465, 100 новых 390 → 397' },
    { param: 'доли с выносом OI: сильный страх / страх / без страха, %', was: '25 / 50 / 50', now: '25 / 50 / 50', plateau: 'a1: ✔ только 25; a2: ✔ 46…50; a3: ✔ 45,5…50 (полка); рост дохода за краем ломает худшие половины на 0,1–0,9 п.п.', effect: 'не меняю' },
    { param: 'доли сильной паники (с выносом, usdt > 1,2), %', was: '37,5 / 75 / 75', now: '62,5 / 100 / 100', plateau: 'следствие m', effect: 'см. m' },
    { param: 'доли без выноса OI (неподтверждённая паника), %', was: '10 / 10 / 10', now: '10 / 10 / 10', plateau: 'b вместе: полка 6…10 (Δ −0,011…0), 0% — −0,79; вперёд по времени подбор −0,006…0', effect: 'нужна, не меняю' },
  ],
  results_fast: res(R), results_fast_combo2: res(B), income: q.d, strict_ok: q.ok,
  results_lab: { how: 'node app/combo2_lab.js <страницы> <кандидаты> (медиана / монет в плюсе / половин / худшая половина / худшая монета)',
    combo2: { sel: '2176/17/32/-2,7/18', ex: '1436/14/28/13,0/143', rnd: '459/48/94/-63,3', n100: '390/91/176', income: 0 },
    tune2: { sel: '2264/17/32/-2,7/19', ex: '1450/14/28/13,0/145', rnd: '465/48/94/-63,3', n100: '397/91/176 (лучше/хуже 48/15)', income: '+0,058 ✔; крупные +0,038 ✔, альты +0,040 ✔ (50 сл. 513 → 510, 100н 530 → 546), мемы +0,041 ✔' } },
  walk_forward: { m: 'выбор по данным до Y и Δ лог-медианы после Y к combo2: 2021 +0,008 (выбрано 2), 2022 +0,014 (3), 2023 +0,004 (2), 2024 0 (1,5); у m 2,5 после Y: +0,014 / +0,011 / +0,008 / +0,007',
    b: 'неподтверждённая паника: подбор по данным до Y → вне выборки −0,006 / −0,006 / 0 / −0,004; без доли −0,10 (2021), +0,03…+0,15 (2022–2024)' },
  note: 'Подробности — app/research/tune2_journal.md. Стенд (combo2_lab.js) повторяет быстрый оценщик: m 2,5 — доход +0,058, строгая ✔ во всём и в каждом сегменте, 100 новых 390 → 397% (91 монета, 176 половин), лучше/хуже 48/15.',
};
fs.writeFileSync(__dirname + '/found/tune2-best.json', JSON.stringify(out, null, 1));
// маржа
const MJ = D + '/tune2_margin.json';
if (fs.existsSync(MJ)) {
  const M = JSON.parse(fs.readFileSync(MJ, 'utf8')), sm = (k) => Object.fromEntries(Object.entries(M[k]).map(([p, o]) => [p, { m0: Math.round(o.m0), m1: Math.round(o.m1), lvl: +o.lvl.toFixed(2), safe: o.safe, liq: o.liq }]));
  const keys = Object.keys(M).filter((k) => k.startsWith('m2.5 |') || k.startsWith('combo2 |'));
  fs.writeFileSync(__dirname + '/found/tune2-best-margin.json', JSON.stringify({
    strategy: 'found/tune2-best.json (combo2 + сильная паника ×2,5)', how: 'python3 app/combo2_margin.py <кандидаты> <выход> — схемы combo2-best-margin.json без изменений (R16 + A4 + шорт BTC), 5 портфелей, ставки 11/15%, в срок и на день позже, стресс −20/−30%',
    verdict: 'итоги со схемами плеча совпадают с combo2 до процента (в схеме маржи доли паники ×2 с потолком 100% — сильная паника там уже весь резерв); 0 ликвидаций у осторожной, средней и лучшей; край ×1,45 — те же ликвидации B и P2 при −30%, что у combo2. Без плеча чуть лучше: P9 549 → 559, B 236 → 241, M 584 → 595, P2 247 → 253, P3 535 → 546%.',
    results: Object.fromEntries(keys.map((k) => [k, sm(k)])),
  }, null, 1));
}
console.log('сохранено');
