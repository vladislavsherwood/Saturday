/* Отчёт «тихая вершина против DCA»: отдельная лёгкая страница (не конструктор) — по каждой монете график цены
   с покупками и продажами, график счёта против DCA и статистика. Данные берутся со страницы стратегии.
   Запуск: node app/build_report.js <страница стратегии.html> <куда.html> */
const fs = require('fs');
const { chromium } = require('playwright');
const { open } = require('./simple.js');

const collect = () => {
  const out = [];
  for (const k of SETS.avg) {
    setup(k, true);
    const plan = decide().acts, unit = 10, r6 = (x) => +x.toPrecision(5);
    let cash = 0, units = 0, du = 0;
    const c = [], kind = [], amt = [], eq = [], dq = [];
    for (let i = 0; i < N; i++) {
      const p = H.c[i], a = i > 0 ? plan[i - 1] : 1, before = cash; cash += unit; du += unit / p;
      let kd = 0, am = unit;
      if (a < 0) {
        const v = -a * units * p; am = 0;
        if (v > 0.005) { units += a * units; cash += v; am = v; kd = i > 0 && IND.qt.v[i - 1] > 0 && !(IND.fng.v[i - 1] < 52 && IND.usdtd.v[i - 1] < 7.6) ? 3 : 2; } else kd = 4;      // 4 — сигнал продажи, но продавать нечего
      } else if (a > 0) { const v = Math.min(cash, unit + (a - 1) * before); units += v / p; cash -= v; am = v; kd = v > unit * 1.001 ? 1 : 0; }
      else { am = 0; kd = 4; }
      c.push(r6(p)); kind.push(kd); amt.push(Math.round(am * 100) / 100); eq.push(Math.round(cash + units * p)); dq.push(Math.round(du * p));
    }
    out.push({ name: RAW.title, ticker: RAW.ticker, t0: H.t[0], c, kind, amt, eq, dq, last: RAW.last });
  }
  return out;
};

(async () => {
  const [src, dst] = process.argv.slice(2), b = await chromium.launch(), p = await open(b, src, 'rep');
  await p.waitForTimeout(600);
  const data = await p.evaluate(collect);
  await b.close();
  const tpl = fs.readFileSync(__dirname + '/report_template.html', 'utf8');
  fs.writeFileSync(dst, tpl.replace('/*DATA*/null', JSON.stringify(data)));
  console.log(dst, Math.round(fs.statSync(dst).size / 1024), 'КБ;', data.map((d) => `${d.ticker} ${d.c.length} дн.`).join(', '));
})();
