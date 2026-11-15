/* imp3: итог. Ни одна правка продаж на страхе не прошла заранее заданный критерий — основа не меняется (combo2-best / combo-best).
   Сохраняет found/imp3-best.json: решение, сводку кругов из логов loop1…loop5 и лучшую отвергнутую заметку (продажи на страхе ×1,25, пока BTC
   ниже начала эпизода страха больше чем на 20%) в виде правил поверх combo2-best — для объединения, если координатор ослабит критерий.
   Запуск: node app/imp3_best.js <папка с loop*.json> */
const Z = require('./imp3_sim.js');
const fs = require('fs');
const { c } = Z;
const dir = process.argv[2];
const C2 = JSON.parse(fs.readFileSync(__dirname + '/found/combo2-best.json', 'utf8'));
const L5 = JSON.parse(fs.readFileSync(dir + '/loop5.json', 'utf8'));
const pick = (b, t) => { const r = L5[b].find((x) => x.tag === t); return r && { income: +r.d.toFixed(3), userCheck: r.ok, why: r.why, sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med, n100: { med: r.n100.med, pos: r.n100.pos, hpos: r.n100.hpos, betterWorse: r.bw }, sellToTop: r.m.sellToTop, missedTops: r.m.missedTops }; };
const note = Z.mod({ base: C2.base, rules: C2.rules }, [[[c('fepb14', '<', -20)], 1.25]]);
const out = {
  name: 'imp3: продажи на страхе — изменений нет',
  decision: 'Основа не меняется: ни одна форма продаж на страхе (5 кругов, ~270 вариантов) не прошла критерий «доход ≥ +0,02 и не хуже по монетам в плюсе, половинам, худшей половине и худшей монете на отборе, экзамене и 50 случайных». Маржа не менялась.',
  base: 'found/combo2-best.json (проверено и поверх found/combo-best.json)',
  rounds: [
    'круг 1: убывающая лесенка внутри эпизода (по номеру дня страха, «уже проданному», длительности) — хуже монотонно (−0,09…−3,6); крупнее в начале — +0,03…+0,045, но ломает худшие монеты/половины',
    'круг 2: меньше продавать при собственном росте монеты / у дна (fepc, fepb, rel30/90, up90, dd365, btcath) — −0,02…−0,87; больше при падении BTC > 20% от начала эпизода — +0,037…+0,049, не проходит на волос',
    'круг 3: относительный USDT.D (к средней 180/365, к максимуму 365) — −0,05…−2,5; абсолютный порог 7,6 — шумный пик (7,0 → −0,90, 8,0 → −0,18)',
    'круг 4: продажа раз в N дней — пила без плато (N=3 +0,36 при фазе 0, −0,31/−0,39 при фазах 1/2) — подгонка под даты',
    'круг 5: продолжение падения BTC (плато по окну 7/14/30 и порогу −15…−30%) и разворот/углубление страха — на обеих основах лучшие +0,02…+0,08, все ломают худшую монету/половину отбора'
  ],
  indicators: { fepb14: 'изменение цены BTC от первого дня текущего эпизода страха (дни fng < 52 и usdtd < 7,6; разрыв без страха ≤ 14 дней — тот же эпизод), %; только прошлое' },
  rejected_note: {
    what: 'каждая продажа на страхе ×1,25, если BTC ниже цены первого дня эпизода страха больше чем на 20% (копия правила перед исходным)',
    over_combo_best: pick('combo-best', 'BTC от начала эпизода (g14) < -20% → ×1.25'),
    over_combo2_best: pick('combo2-best', 'BTC от начала эпизода (g14) < -20% → ×1.25'),
    plateau: 'порог −15% → −0,004/−0,001; −20% → +0,037/+0,020; −25% → +0,016/+0,003; −30% → +0,008/−0,003 (combo-best/combo2-best) — узкий пик',
    rules_over_combo2: note.rules
  }
};
fs.writeFileSync(__dirname + '/found/imp3-best.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.rejected_note.over_combo2_best), JSON.stringify(out.rejected_note.over_combo_best));
