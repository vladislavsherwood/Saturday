/* r4, круг 10: финал — combo4 + «эйфория мемов 10%» (M10): 100 новых, сегменты, соседи; сочетание с упрощением до 49 правил (круг 1). Пишет found/r4-best.json.
   Запуск: node r4_r10.js */
const fs = require('fs'), L = require('./r4_lib.js'), { S0, c, P, Z } = L;
const M = (s = 0.1, u = 0.9, b = 0.9, A = 540) => ({ act: -s, conds: [c('usdt', '<', u), c('age', '>', A), c('meme', '>', 0.5), c('beta180', '>', b)] });
const best = () => { const S = L.clone(); S.rules.push(M()); return S; };
const has = (r, ind, op, v) => r.conds.some((x) => x.ind === ind && (op == null || (x.op === op && x.v === v)));
const cls = (r) => { if (r.act >= 0) return null; if (has(r, 'usdt')) return 'euph'; if (has(r, 'fng', '<', 40)) return 'fear40'; if (has(r, 'fng', '<', 52)) return 'fear52'; if (has(r, 'fund30')) return 'fund'; if (has(r, 'qt')) return 'qt'; if (has(r, 'up90')) return 'pump'; if (has(r, 'btcath')) return 'wide'; return 'as'; };
const simp = (S) => { const T = L.clone(S); T.rules = T.rules.filter((r) => !((cls(r) === 'fear52' && has(r, 'isbig')) || (cls(r) === 'fund' && has(r, 'meme')) || (cls(r) === 'wide' && has(r, 'meme')) || (cls(r) === 'pump' && has(r, 'rel180')))); return T; };
const B = best(), fmt = (s) => (s ? P.f(s) : '—');
const r0 = L.run('combo4', S0, L.pol0, { n100: true }), r1 = L.run('combo4 + M10', B, L.pol0, { n100: true }), r2 = L.run('combo4 + M10, 49+1 правил', simp(B), L.pol0, { n100: true });
// сегменты
const seg = (S) => { const R = P.evc(S, L.pol0, ['sel', 'ex', 'rnd', 'n100']), s = Z.sum(R); const o = {}; for (const q of Z.SEGS) o[q] = Object.fromEntries(['sel', 'ex', 'rnd', 'n100'].map((g) => [g, fmt(s[g][q])])); return { o, R }; };
const s0 = seg(S0), s1 = seg(B);
for (const q of Z.SEGS) console.log(q.padEnd(5), 'combo4:', JSON.stringify(s0.o[q]), '\n      M10:   ', JSON.stringify(s1.o[q]));
const ml = Object.fromEntries(['all', 'big', 'alt', 'meme'].map((q) => { const m = Z.mlog(s1.R, s0.R, q, ['n100']); return [q, { m: +m.m.toFixed(4), better: m.u, worse: m.d, n: m.n }]; }));
const ml81 = Object.fromEntries(['all', 'meme'].map((q) => { const m = Z.mlog(s1.R, s0.R, q, ['sel', 'ex', 'rnd']); return [q, { m: +m.m.toFixed(4), better: m.u, worse: m.d, n: m.n }]; }));
console.log('100 новых, средний лог:', JSON.stringify(ml), '| 81 монета:', JSON.stringify(ml81));
console.log('— соседи M10 —');
const nb = [];
for (const [s, u, b, A] of [[0.08, 0.9, 0.9, 540], [0.15, 0.9, 0.9, 540], [0.2, 0.9, 0.9, 540], [0.1, 0.92, 0.9, 540], [0.1, 0.88, 0.9, 540], [0.1, 0.9, 1.0, 540], [0.1, 0.9, 1.2, 540], [0.1, 0.9, 0.9, 730], [0.1, 0.9, 0.9, 365]]) { const S = L.clone(); S.rules.push(M(s, u, b, A)); const r = L.run(`доля ${s * 100}% usdt ${u} бета ${b} возраст ${A}`, S); nb.push({ share: s, usdt: u, beta: b, age: A, income_meme: +r.dseg.meme.toFixed(3), strict: r.w ? 'no: ' + r.w.slice(0, 80) : 'ok' }); }
const out = {
  name: 'r4-best: combo4 + «эйфория мемов» (копия правила эйфории для мемов, 10% в день)',
  base_file: 'found/combo4-best.json (56 правил + отложенная паника Boost(2, k 0, A 0))',
  change: { add_rule_last: M(), human: 'Мем (по списку combo4), возраст > 540 дней, бета180 > 0,9, usdt (USDT.D к 200-дн. средней) < 0,9 → продать 10% монеты в день; последним правилом, после эйфории для не-мемов (5%).' },
  rules: B.rules, rules_count: B.rules.length, base: 1, panic_defer: { k: 0, m: 2, t: 0.98, rv: 0.965, A: 0, su: 1.2 },
  results: {
    format: 'медиана к DCA, % / монет в плюсе / половин в плюсе / худшая половина',
    combo4: s0.o, r4_best: s1.o,
    vs_combo4: { income: Object.fromEntries(Object.entries(r1.dseg).map(([k, v]) => [k, +v.toFixed(3)])), strict: r1.w ? r1.w : 'ok (всё и каждый сегмент)', n100_mean_log: ml, coins81_mean_log: ml81 },
    neighbors: nb,
  },
  simplification_optional: { what: 'круг 1: убрать 7 копий (fear52 × «крупная по списку», фандинг × мем, широкая вершина × мем, памп × «отстаёт»)', with_M10: { income: +r2.dseg.all.toFixed(3), income_meme: +r2.dseg.meme.toFixed(3), strict: r2.w || 'ok', n100: r2.n100 } },
  honest_notes: [
    'Общий доход (Σ лог-медиан всей выборки) не меняется: мемы не медианные монеты; выигрыш — только в сегменте мемов (12 мемов старых выборок, 6 — на 100 новых).',
    'Левый край по порогу usdt: 0,88 и 0,85 — строгая ✗ (2-я половина PEPE); возраст 365 — ✗ (PUMP).',
    'По эпохам M10 в плюсе в 2022–23, 2024, 2025 и 2026; часть 2026 (+0,22 из +0,71) — конец выборки (авг.–окт. 2026), подтверждена только ценой 12.11.2026; до 2026-08 — +0,535 ✔.',
    'У самой эйфории combo4 подтверждено +0,15 из +0,36 (остальное — тот же конец выборки).',
    'Перевес combo4 быстро тает с задержкой исполнения: 2 дня −0,4, 3 дня −1,2 (Σ лог-медиан 8,56).',
    'Порог othd < 25 — обрыв (сдвиг −5% → −2,44); сгладить не удалось (круг 2).',
  ],
  journal: 'research/r4_journal.md',
};
fs.writeFileSync(__dirname + '/found/r4-best.json', JSON.stringify(out, null, 1));
console.log('записан found/r4-best.json');
