/* wk, круг 1: модель исполнения (одно исполнение уровня за окно, размер при выставлении) и геометрия заявок:
   частота обновления, сдвиг уровней × размер долей (карта плато), уровни от волатильности монеты (σ дневная из vol90), по сегменту,
   опорная цена (максимум N дней), число уровней. Запуск: node wk_r1.js > scratchpad/wk/r1.log */
const W = require('./wk_lib.js'), { ev, pol, LV0, sd } = W;
const R3 = { every: 3, once: 1, size: 'place' };
const sc = (lv, a = 1, m = 1) => lv.map(([k, f]) => [1 - Math.pow(1 - k, a), f * m]); // a — масштаб уровней в лог-шкале (−ln(1−k) × a), m — множитель долей
const tag = (lv) => lv.map(([k, f]) => `−${Math.round(k * 100)}:${Math.round(f * 100)}`).join(' ');
W.head();
console.log('— A: модель исполнения и частота (уровни T0) —');
ev('T0 (каждый день, как dcaf)', W.T0, { n100: true });
for (const e of [1, 2, 3, 4, 5, 7]) ev(`раз в ${e} дн, once, place`, pol({ every: e, once: 1, size: 'place' }), { n100: true });
ev('раз в 3 дн, once (размер от резерва при исполнении)', pol({ every: 3, once: 1 }), { n100: true });
console.log('— B: карта плато: уровни × a (лог-шкала), доли × m; раз в 3 дн —');
for (const a of [0.7, 0.8, 0.9, 1, 1.1, 1.25]) for (const m of [0.5, 0.75, 1, 1.5, 2]) { const lv = sc(LV0, a, m); ev(`a ${a} m ${m}: ${tag(lv)}`, pol({ ...R3, lv }), { n100: true }); }
console.log('— C: уровни от волатильности: −ln(1−k) = z·σ90·(σ/σmed)^β, σmed 0,05; раз в 3 дн —');
const Z0 = LV0.map(([k]) => -Math.log(1 - k));
const VL = (b, a = 1, m = 1) => (X, j) => { const s = sd(X, j), r = isFinite(s) ? Math.pow(s / 0.05, b) : 1; return LV0.map(([, f], q) => [1 - Math.exp(-Z0[q] * a * r), f * m]); };
for (const b of [0.25, 0.5, 0.75, 1]) for (const a of [0.8, 0.9, 1, 1.1]) ev(`β ${b} a ${a}`, pol({ ...R3, lv: VL(b, a) }), { n100: true });
console.log('— D: по сегменту: крупные / мемы с другим масштабом уровней; раз в 3 дн —');
const SEG = (ab, aa, am) => (X) => sc(LV0, X.seg === 'big' ? ab : X.seg === 'meme' ? am : aa);
for (const [ab, aa, am] of [[0.6, 1, 1], [0.8, 1, 1], [1, 1, 1.2], [1, 1, 0.8], [0.8, 0.9, 1], [0.6, 0.8, 1]]) ev(`сегм к×${ab} а×${aa} м×${am}`, pol({ ...R3, lv: SEG(ab, aa, am) }), { n100: true });
console.log('— E: опорная цена: максимум закрытий N дней / максимум дня; раз в 3 дн —');
const MX = (N) => (X, j) => { let m = -Infinity; for (let k = Math.max(0, j - N + 1); k <= j; k++) if (X.c[k] > m) m = X.c[k]; return m; };
for (const N of [2, 3, 5, 7, 14]) ev(`ref = max закрытий ${N} дн`, pol({ ...R3, ref: MX(N) }), { n100: true });
ev('ref = максимум дня', pol({ ...R3, ref: (X, j) => Math.max(X.c[j], X.h[j] || 0) }), { n100: true });
console.log('— F: число уровней; раз в 3 дн —');
for (const lv of [[[0.3, 0.3]], [[0.25, 0.2], [0.5, 0.4]], [[0.2, 0.05], [0.3, 0.1], [0.45, 0.2], [0.65, 0.3]], [[0.2, 0.1], [0.35, 0.2], [0.5, 0.3]], [[0.15, 0.05], [0.25, 0.1], [0.4, 0.2], [0.6, 0.3]]])
  ev(`уровни ${tag(lv)}`, pol({ ...R3, lv }), { n100: true });
require('fs').writeFileSync(process.argv[2] || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/wk/r1.json', JSON.stringify(W.rows.map(({ R, RS, N, ...o }) => o)));
