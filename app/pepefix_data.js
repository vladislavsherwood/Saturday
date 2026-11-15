/* pepefix: сравнение выгрузок memes6 — Yahoo (memes6_yahoo.*) и Binance (memes6.*): число разных цен, колонки, сколько выгруженных индикаторов изменилось
   (бета/корреляция считаются в оценщике — см. pepefix_check.js). Запуск: node app/pepefix_data.js [папка agent_data] */
const fs = require('fs');
const DD = process.argv[2] || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent_data';
function load(nm) {
  const j = JSON.parse(fs.readFileSync(`${DD}/${nm}.json`, 'utf8')), buf = fs.readFileSync(`${DD}/${nm}.bin`);
  const all = new Float64Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  return j.meta.map((m) => { const X = { name: m.name, n: m.n, cols: m.cols, ind: {} }; m.cols.forEach((c, q) => { X.ind[c] = all.subarray(m.off + q * m.n, m.off + (q + 1) * m.n); }); return X; });
}
const Y = load('memes6_yahoo'), B = load('memes6');
const uniq = (a) => new Set(Array.from(a).filter((x) => x === x)).size;
const med = (a) => { const v = Array.from(a).filter((x) => x === x).sort((x, y) => x - y); return v.length ? v[v.length >> 1] : NaN; };
const r2 = (x) => (x === x ? x.toFixed(2) : '—');
const out = [];
for (let k = 0; k < B.length; k++) {
  const x = Y[k], y = B[k];
  const sameCols = x.cols.length === y.cols.length && x.cols.every((c) => y.cols.includes(c));
  const missing = x.cols.filter((c) => !y.cols.includes(c)), extra = y.cols.filter((c) => !x.cols.includes(c));
  const changed = x.cols.filter((c) => y.ind[c] && Array.from(x.ind[c]).some((v, i) => !(v === y.ind[c][i] || (v !== v && y.ind[c][i] !== y.ind[c][i]) || Math.abs(v - y.ind[c][i]) <= 1e-12 * Math.max(1, Math.abs(v)))));
  const nanNew = y.cols.filter((c) => { const a = y.ind[c]; let nn = 0; for (const v of a) if (v !== v) nn++; const b = x.ind[c]; if (!b) return false; let no = 0; for (const v of b) if (v !== v) no++; return nn > no + 5; });
    const row = {
    coin: x.name, n: [x.n, y.n], uniqAll: [uniq(x.ind.c), uniq(y.ind.c)], uniq200: [uniq(x.ind.c.subarray(x.n - 200)), uniq(y.ind.c.subarray(y.n - 200))],
    cols: [x.cols.length, y.cols.length], sameCols, missing, extra, changed: changed.length, nanNew,
  };
  out.push(row);
  console.log(`${row.coin.padEnd(9)} дней ${row.n.join('/')} | разных цен: вся история ${row.uniqAll.join(' → ')}, 200 дн ${row.uniq200.join(' → ')} | колонок ${row.cols.join('/')} ${sameCols ? 'те же' : 'ОТЛИЧАЮТСЯ −' + missing + ' +' + extra} | изменилось ${row.changed}${nanNew.length ? ' | больше NaN: ' + nanNew : ''}`);
}
fs.writeFileSync(__dirname + '/found/pepefix_data.json', JSON.stringify(out, null, 1));
