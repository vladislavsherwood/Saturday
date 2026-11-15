/* Агент «ЛОУКАП», круг 1: событийный разбор признаков объёма/оборота/капитализации на отборе лоукапов.
   (A) Сигналы как события (первый день, затем пауза 30 дней): доходность монеты через 30/90/180 дней — сырая и сверх медианы всех лоукапов
       отбора в тот же день (убирает режим рынка); доля эпизодов в нужную сторону; отдельно до и после 2025-06-01.
   (B) Дни рыночной паники, в которые основа тратит резерв (правила паники): корзины признака монеты → доходность через 90/180 дней.
   Будущее используется ТОЛЬКО для оценки. Запуск: node app/lowcap_loop1.js [lsel|lchk] */
const L = require('./lowcap_sim.js'), K = L.K;
const G = L.load(), g = process.argv[2] || 'lsel', A = G[g];
const H = [30, 90, 180];
// медиана доходности всех лоукапов группы на день t через h дней (по календарю)
const fwd = (X, i, h) => (i + h < X.n ? X.c[i + h] / X.c[i] - 1 : NaN);
const xs = {};
for (const h of H) { const m = new Map(); for (const X of A) for (let i = 0; i < X.n; i++) { const f = fwd(X, i, h); if (!isNaN(f)) { const t = X.t[i]; if (!m.has(t)) m.set(t, []); m.get(t).push(f); } } const o = new Map(); for (const [t, v] of m) o.set(t, L.med(v)); xs[h] = o; }
const ex = (X, i, h) => { const f = fwd(X, i, h), m = xs[h].get(X.t[i]); return isNaN(f) || m == null ? NaN : (1 + f) / (1 + m) - 1; };
const pct = (v) => (isNaN(v) ? '  -' : ((v >= 0 ? '+' : '') + (100 * v).toFixed(0)).padStart(4));
function events(name, cond, dir, gap = 30) {
  const res = { all: [], pre: [], post: [] }, coins = new Set();
  for (const X of A) { let last = -1e9; for (let i = 200 > X.n ? 0 : 0; i < X.n; i++) { if (!cond(X, i)) continue; if (i - last < gap) { continue; } last = i; coins.add(X.name);
    const e = { X, i, r: H.map((h) => fwd(X, i, h)), x: H.map((h) => ex(X, i, h)) }; res.all.push(e); res[X.t[i] < L.SPLIT ? 'pre' : 'post'].push(e); } }
  const fmt = (E) => { if (!E.length) return 'нет'; const s = H.map((h, q) => { const r = E.map((e) => e.r[q]).filter((v) => !isNaN(v)), x = E.map((e) => e.x[q]).filter((v) => !isNaN(v)); return `${h}д ${pct(L.med(r))}/${pct(L.med(x))} (${(100 * x.filter((v) => v * dir > 0).length / Math.max(1, x.length)).toFixed(0)}%)`; }); return `${E.length} эп. | ${s.join(' | ')}`; };
  console.log(`${name}  [монет ${coins.size}]\n    всё: ${fmt(res.all)}\n    до 06.2025: ${fmt(res.pre)}\n    после: ${fmt(res.post)}`);
  return res;
}
const I = (X) => X.ind;
const dn = (X, i) => i > 0 && X.c[i] < X.c[i - 1], upd = (X, i) => i > 0 && X.c[i] > X.c[i - 1];
console.log(`Группа ${g} (${A.length} монет). Формат: эпизодов | через N дней: медиана сырая / сверх медианы лоукапов того же дня (доля эпизодов в нужную сторону)\n`);
console.log('— контроль: любой день (каждые 30 дней) —'); events('контроль', (X, i) => true, 1);
console.log('\n— КАПИТУЛЯЦИЯ: объём дня > k × 20-дн. среднего на падении, монета −30% за 14 дней (ожидаем дно: «+») —');
for (const k of [2, 3, 5]) events(`капитуляция vr1>${k}, r14<−30`, (X, i) => dn(X, i) && I(X).vr1[i] > k && I(X).r14[i] < -30, 1);
console.log('\n— ПАМП/РАСПРЕДЕЛЕНИЕ: объём > k × среднего на росте, монета +100% от 90-дн. минимума (ожидаем вершину: «−») —');
for (const k of [2, 3, 5]) events(`памп-объём vr1>${k}, up90>100`, (X, i) => upd(X, i) && I(X).vr1[i] > k && I(X).up90[i] > 100, -1);
for (const t of [50, 100]) events(`оборот дня > ${t}% капитализации, up90>100`, (X, i) => I(X).turn[i] > t && I(X).up90[i] > 100, -1);
console.log('\n— ВЫСЫХАНИЕ ОБЪЁМА у дна: неделя к 90 дням < k, монета −70% от 365-дн. максимума (ожидаем дно: «+») —');
for (const k of [0.3, 0.5, 0.7]) events(`высох vr7_90<${k}, dd365>70`, (X, i) => I(X).vr7_90[i] < k && I(X).dd365[i] > 70, 1);
for (const k of [0.1, 0.2]) events(`объём затух: неделя < ${k} годового пика, dd365>70`, (X, i) => I(X).vpk[i] < k && I(X).dd365[i] > 70, 1);
console.log('\n— ОБОРОТ (объём/капитализация за 30 дней) —');
for (const [a, b] of [[0, 3], [3, 10], [10, 30], [30, 1e9]]) events(`оборот30 ${a}…${b}%`, (X, i) => I(X).turn30[i] >= a && I(X).turn30[i] < b, 1);
console.log('\n— ВОЗРАСТ (дней с начала истории CMC) —');
for (const [a, b] of [[20, 60], [60, 120], [120, 240], [240, 480], [480, 1e9]]) events(`возраст ${a}…${b}`, (X, i) => I(X).agel[i] >= a && I(X).agel[i] < b, 1);
console.log('\n— ДОЛЯ В КАПИТАЛИЗАЦИИ РЫНКА (б.п., средняя 90 дн) —');
for (const [a, b] of [[0, 0.3], [0.3, 1], [1, 3], [3, 1e9]]) events(`доля ${a}…${b} б.п.`, (X, i) => I(X).mcsh90[i] >= a && I(X).mcsh90[i] < b, 1);
console.log('\n— РАСХОЖДЕНИЕ ЦЕНА/OBV: цена на 90-дн. максимуме, OBV ниже своего 90-дн. максимума на 20%+ от размаха (ожидаем «−») —');
events('OBV-расхождение на максимуме', (X, i) => { if (i < 90 || !(I(X).hi90[i] > 0.5)) return false; const o = I(X).obv; let mx = -Infinity, mn = Infinity; for (let j = i - 89; j <= i; j++) { mx = Math.max(mx, o[j]); mn = Math.min(mn, o[j]); } return o[i] < mx - 0.2 * (mx - mn); }, -1);

// (B) дни паники: основа покупает резерв правилом паники
console.log('\n=== (B) Дни паники (правила паники основы срабатывают), корзины признаков монеты: дней | через 90 / 180 дн: медиана сырая / сверх лоукапов дня; доля дней с падением > 50% за 120 дн ===');
const S0 = L.S0, panicDays = [];
for (const X of A) { const R = S0.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])), tr = K.edge(X, S0, 0, 'full', true).tr;
  for (const t of tr) if (t.s > 0 && L.isPanic(R[t.q])) { let mn = Infinity; for (let j = t.i; j < Math.min(X.n, t.i + 120); j++) mn = Math.min(mn, X.c[j]); panicDays.push({ X, i: t.i, amt: t.amt, knife: mn < 0.5 * X.c[t.i] }); } }
function bucket(name, f, edges) {
  console.log(`  ${name}`);
  for (let q = 0; q < edges.length - 1; q++) { const B = panicDays.filter((d) => { const v = f(d.X, d.i); return v >= edges[q] && v < edges[q + 1]; }); if (!B.length) continue;
    const tot = B.reduce((s, d) => s + d.amt, 0), w = (h) => { let s = 0, k = 0; for (const d of B) { const v = fwd(d.X, d.i, h); if (!isNaN(v)) { s += d.amt * v; k += d.amt; } } return s / k; };
    const pre = B.filter((d) => d.X.t[d.i] < L.SPLIT), post = B.filter((d) => d.X.t[d.i] >= L.SPLIT), kn = (E) => (E.length ? (100 * E.filter((d) => d.knife).length / E.length).toFixed(0) : '-');
    console.log(`    ${String(edges[q]).padStart(6)}…${String(edges[q + 1]).padEnd(6)} дней ${String(B.length).padStart(5)} (до/после ${pre.length}/${post.length}) | деньги: 90д ${pct(w(90))} 180д ${pct(w(180))} | медиана сверх: 90д ${pct(L.med(B.map((d) => ex(d.X, d.i, 90)).filter((v) => !isNaN(v))))} 180д ${pct(L.med(B.map((d) => ex(d.X, d.i, 180)).filter((v) => !isNaN(v))))} | нож ${kn(B)}% (до ${kn(pre)} / после ${kn(post)})`); }
}
bucket('просадка от 90-дн. максимума ddm90, %', (X, i) => I(X).ddm90[i], [0, 35, 50, 65, 80, 101]);
bucket('просадка от 365-дн. максимума dd365, %', (X, i) => I(X).dd365[i], [0, 50, 70, 85, 95, 101]);
bucket('объём неделя/90 дней vr7_90', (X, i) => I(X).vr7_90[i], [0, 0.4, 0.6, 0.8, 1.2, 2, 1e9]);
bucket('объём месяц/180 дней vr30_180', (X, i) => I(X).vr30_180[i], [0, 0.3, 0.5, 0.7, 1, 1.5, 1e9]);
bucket('неделя к годовому пику объёма vpk', (X, i) => I(X).vpk[i], [0, 0.05, 0.1, 0.2, 0.4, 1.01]);
bucket('оборот30, % капитализации в день', (X, i) => I(X).turn30[i], [0, 2, 5, 10, 20, 1e9]);
bucket('возраст, дней', (X, i) => I(X).agel[i], [0, 90, 180, 365, 730, 1e9]);
bucket('доля в рынке (90 дн), б.п.', (X, i) => I(X).mcsh90[i], [0, 0.2, 0.5, 1, 3, 1e9]);
bucket('сила к BTC за 180 дн rel180, %', (X, i) => I(X).rel180[i], [-100, -80, -60, -40, -15, 1e9]);
bucket('сила к BTC за 30 дн rel30, %', (X, i) => I(X).rel30[i], [-100, -40, -20, 0, 20, 1e9]);
