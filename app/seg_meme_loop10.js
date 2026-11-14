/* Круг 10: P35 + CM2 не держится на одном эпизоде? Решение (заранее): часть, не держащая знак в обоих периодах, в основной вариант не входит. Правила включены только до 2025-01-01 / только с 2025-01-01 (по дате дня решения),
   по отдельности P35 и CM2; средний лог-прирост мемов и лучше/хуже. Сохраняет found/seg_meme-best.json (основной — CM2, рискованный — P35 + CM2). Запуск: node app/seg_meme_loop10.js */
const M = require('./seg_meme_lib.js'), K = M.K, c = M.c, fs = require('fs');
const G = M.load(); M.flags(G);
for (const g in G) for (const X of G[g]) X.ind.tday = X.t;
const b = M.evs(G, M.S0), D = 20089; // 2025-01-01
const lim = (S, op) => ({ ...S, rules: S.rules.map((r) => (r.conds.some((q) => q.ind === 'meme') ? { ...r, conds: [...r.conds, c('tday', op, D)] } : r)) });
const V = [['P35 + CM2', M.cand(35, 2)], ['только P35', M.cand(35, 1.25)], ['только CM2', M.cand(0, 2)]];
const res = {};
for (const [t, S] of V) for (const [tt, SS] of [['всё время', S], ['до 2025', lim(S, '<')], ['с 2025', lim(S, '>')]]) {
  const r = M.evs(G, SS), C = M.cmp(r, b).out, o = M.robust(r, b); res[`${t} | ${tt}`] = { inc: C, robust: o };
  console.log(`${t.padEnd(10)} ${tt.padEnd(10)} | доход все ${C.all.inc.toFixed(3)}${C.all.pass ? '✔' : '·'} мемы ${C.meme.inc.toFixed(3)}${C.meme.pass ? '✔' : '·' + C.meme.why} | ${M.rs(o)}`);
}
const SA = M.cand(35, 2), rA = M.evs(G, SA), S = M.cand(0, 2), r = M.evs(G, S), R0 = K.ev(G, M.S0, false), R1 = K.ev(G, S, false), Sm = M.sum(r), Sb = M.sum(b);
const pick = (s) => ({ med: +s.med.toFixed(1), pos: s.pos, n: s.n, worst: +s.worst.toFixed(1), hpos: s.hpos, hn: s.hn, hworst: +s.hworst.toFixed(1) });
const best = {
  name: 'CM2 для мемов поверх F + C1.25 + C6 (агент «МЕМЫ»); рискованный вариант — P35 + CM2',
  base: S.base, rules: S.rules,
  note: 'Основа — found/combo-best.json (F + C1.25 + C6) без изменений для всех монет, кроме мемов. Индикатор meme = 1 у мем-монет по списку (см. memes), иначе 0. ' +
    'CM2: перед каждым правилом C (продажа с rel180 < −15, ×1,25) — копия с условием meme > 0,5 и долей ×2/1,25 (итог ×2 к исходной продаже).',
  rules_human: [
    'Всё из F + C1.25 + C6 (found/combo-best.json) — без изменений для всех монет, не входящих в список мемов.',
    'CM2 (только мемы): если мем за 180 дней отстал от BTC больше чем на 15% (rel180 < −15), каждая продажа ×2 (у остальных монет ×1,25): страх 16→32%, сильный страх 30→60%, фандинг 5→10%, тихая вершина 40→80%, широкая 50→100%, памп 10→20%.',
  ],
  aggressive: { name: 'P35 + CM2 (сильнее, но выигрыш P35 целиком из 2025–26: до 2025 P35 хуже на 8 из 12 старых мемов)', rules: SA.rules,
    note: 'P35: перед каждым правилом покупки паники (все правила с usdt, кроме разворота BTC) — копия с условиями meme > 0,5 и ddm90 < 35 и act = 1 (только взнос; grp 0 для маржи).',
    groups: Object.fromEntries(['sel', 'ex', 'rnd', 'n100'].map((g) => [g, { new: pick(K.ev(G, SA, false)[g]), betterWorse: M.bw(rA, b, g), memes_new: pick(M.sum(rA)[g].meme) }])), vsBase: M.cmp(rA, b).out, robust_memes: M.robust(rA, b), per_meme: M.diffMemes(rA, b) },
  rules_human_aggressive: [
    'P35 (только мемы): в день паники в стейблах (правила покупки паники #3–#8, #11–#13 основы) мем, который ближе 35% к своему максимуму закрытия за 90 дней, покупается только взносом — резерв ждёт дней, когда мем сам упал минимум на 35%.',
    'CM2 (только мемы): если мем за 180 дней отстал от BTC больше чем на 15% (rel180 < −15), каждая продажа ×2 (у остальных монет ×1,25): страх 16→32%, сильный страх 30→60%, фандинг 5→10%, тихая вершина 40→80%, широкая 50→100%, памп 10→20%.'],
  memes: { list: M.MEMES, border_not_included: M.BORDER, margin_portfolios: ['DOGE-USD', 'PEPE24478-USD', 'PUMP36507-USD', 'SHIB-USD', 'WIF-USD', 'BONK-USD', 'FLOKI-USD', 'FARTCOIN-USD'],
    behavior: 'поведенческий признак (бета180 > 1,3) отмечает 72–80% дней мемов экзамена и 50 случайных против 25% остальных, но с P35 не работает (−0,07…+0,03) — мем задаётся списком' },
  indicators: { ddm90: 'просадка закрытия монеты от максимума закрытий за 90 дней (включая сегодня), %', meme: '1 у монеты из списка мемов, иначе 0', rel180: 'как в combo-best.json' },
  results: { groups: Object.fromEntries(['sel', 'ex', 'rnd', 'n100'].map((g) => [g, { base: pick(R0[g]), new: pick(R1[g]), betterWorse: M.bw(r, b, g), memes_base: pick(Sb[g].meme), memes_new: pick(Sm[g].meme), memes_betterWorse: M.bw(r, b, g, (x) => x.meme) }])),
    vsBase: M.cmp(r, b).out, robust_memes: M.robust(r, b), by_period: res,
    metrics_memes_old: { base: K.metrics(['sel', 'ex', 'rnd'].flatMap((g) => G[g]).filter((x) => x.meme), M.S0), new: K.metrics(['sel', 'ex', 'rnd'].flatMap((g) => G[g]).filter((x) => x.meme), S) },
    per_meme: M.diffMemes(r, b) },
  margin: 'см. found/seg_meme-best-margin.json (схема маржи combo-best-margin.json без изменений)',
  rejected: [
    'широкая тихая вершина мемов меньше (×0…×0,75): −0,08…−0,32 у мемов; больше (×1,5) — плюс только старым мемам (DOGE, SHIB, FLOKI), молодым минус',
    'P для всех монет (паника только взносом, пока монета ближе X% к 90-дн. максимуму): отбор 2116 → 1035% при X = 35; по бете > 1,3 — без эффекта',
    'продажа пампа мема при любом BTC (> 200/300/500% от 90-дн. минимума, 5–20% в день): −0,01…−0,08 средней, распродаёт ранние пампы NPC, B, TIBBIR',
    'молодые мемы без продаж на страхе в первые 90/180/365 дней: в старых группах хуже больше мемов, чем лучше',
    'возврат после тихой вершины для мемов ×2/×3 или окно 90 дней: ≈0 или минус (помогает только DOGE)',
    'C4 агента 3 и «ниже средней 200» для мемов: плюс в старых группах, минус в 100 новых']
};
fs.writeFileSync(__dirname + '/found/seg_meme-best.json', JSON.stringify(best, null, 1));
console.log('сохранено: app/found/seg_meme-best.json');
