/* h2, круг 5: другие признаки капитуляции (идеи 4–6), место — перед продажами на страхе (индекс 10), условие btcr30 < 20.
   A — деривативы (с 2020-09): отрицательный фандинг, вынос OI, лонг/шорт; B — недельный RSI BTC; C — капитуляция самой монеты (глубина падения + недельный RSI);
   D — «не продавать у локального дна» в зоне (RSI монеты / близость к 30-дн. минимуму); E — дней в медвежьем рынке; F — всплеск волатильности BTC.
   Запуск: node h2_r5.js [wick|plain] */
const H = require('./h2_lib.js'), { L, c } = H;
const kind = process.argv[2] || 'wick', pol = H.base(kind);
console.log(`ОСНОВА: combo4 (57)${kind === 'wick' ? ' + фитили' : ''}`);
const ext = (r) => { const m = H.m81(r); return `${r.s.slice(0, 150)} | 81 ${L.sg(m.m)} ${m.u}/${m.d}${r.w ? ' | ' + r.w.slice(0, 120) : ''}`; };
const go = (nm, conds, act) => console.log(ext(H.run(nm, H.ins([{ act, conds: [...conds, c('btcr30', '<', 20)] }], 10), pol, { n100: true, quiet: true })));
const acts = [['взнос', 1], ['+5%', 1.05], ['+10%', 1.1]];
const grid = {
  'A фандинг7<0, ath>50': [c('fund7', '<', 0), c('btcath', '>', 50)],
  'A фандинг30<0, ath>50': [c('fund30', '<', 0), c('btcath', '>', 50)],
  'A фандинг7<-0,5': [c('fund7', '<', -0.5)],
  'A вынос10<-15, mvrv<1,2': [c('flush10', '<', -15), c('mvrv', '<', 1.2)],
  'A OI30<-15, mvrv<1,2': [c('oidd30', '<', -15), c('mvrv', '<', 1.2)],
  'A л/ш<1, ath>60': [c('lsr', '<', 1), c('btcath', '>', 60)],
  'B нед.RSI BTC<30': [c('h2bwr', '<', 30)], 'B нед.RSI BTC<33': [c('h2bwr', '<', 33)], 'B нед.RSI BTC<36': [c('h2bwr', '<', 36)],
  'C dd365>80, нед.RSI<30': [c('dd365', '>', 80), c('h2cwr', '<', 30)], 'C dd365>85, нед.RSI<30': [c('dd365', '>', 85), c('h2cwr', '<', 30)],
  'C dd365>80, нед.RSI<30, mvrv<1': [c('dd365', '>', 80), c('h2cwr', '<', 30), c('mvrv', '<', 1)],
  'C dd365>75, RSI<25, ath>60': [c('dd365', '>', 75), c('rsi', '<', 25), c('btcath', '>', 60)],
  'E медведь>300 дн, ath>65': [c('h2bear', '>', 300), c('btcath', '>', 65)], 'E медведь>365 дн, ath>60': [c('h2bear', '>', 365), c('btcath', '>', 60)],
  'F волат.BTC 30/365>1,5, ath>60': [c('h2bvr', '>', 1.5), c('btcath', '>', 60)], 'F волат.BTC>2, ath>50': [c('h2bvr', '>', 2), c('btcath', '>', 50)],
};
for (const [nm, cs] of Object.entries(grid)) for (const [an, a] of acts) go(`${nm} → ${an}`, cs, a);
const gridD = {
  'D mvrv<1, RSI<30': [c('mvrv', '<', 1), c('rsi', '<', 30)], 'D mvrv<1, RSI<35': [c('mvrv', '<', 1), c('rsi', '<', 35)], 'D mvrv<1, RSI<40': [c('mvrv', '<', 1), c('rsi', '<', 40)],
  'D mvrv<1, монета <+10% от мин30': [c('mvrv', '<', 1), c('h2cup', '<', 10)], 'D mvrv<1, монета <+20% от мин30': [c('mvrv', '<', 1), c('h2cup', '<', 20)],
  'D ath>70, RSI<35': [c('btcath', '>', 70), c('rsi', '<', 35)],
};
for (const [nm, cs] of Object.entries(gridD)) for (const [an, a] of [['копить', 1e-6], ['взнос', 1], ['+5%', 1.05]]) go(`${nm} → ${an}`, cs, a);
