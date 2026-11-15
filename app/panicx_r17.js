/* Круг 17: (а) k 0 / 0,1 / 0,15 × порог сильной паники 1,2 / 1,25 / 1,3 — найти вариант с плато и по порогу; (б) выдача долга с «надбавкой»:
   на развороте usdt тратится долг × m (m 1,5 / 2; сверх долга — из резерва), объединение отсрочки и докупки на развороте (круг 4). Сравнение — к panicx-best. Запуск: node panicx_r17.js */
const H = require('./panicx_p2.js'), P = H.P;
H.init();
const Boost = (m, o) => { const b = H.Pol2(o); return { buy: b.buy, release: (ctx) => { const k = b.release(ctx); if (k > 0 && !ctx.X.ind.pend[ctx.j]) ctx.st.rl = k * ctx.st.owed; return k; }, extra: ({ before, st }) => { if (!st.rl) return 0; const e = ((m - 1) * st.rl) / Math.max(before, 1e-9); st.rl = 0; return e; } }; };
for (const k of [0, 0.1, 0.15]) for (const su of [1.2, 1.25, 1.3]) H.run(`k ${k} сильная > ${su}`, H.Pol2({ k, su }));
for (const k of [0, 0.25]) for (const m of [1.5, 2]) H.run(`k ${k} выдача ×${m}`, Boost(m, { k }));
console.log(H.summary());
