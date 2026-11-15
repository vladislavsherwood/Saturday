"""imp9, круг 2: основа маржи по правилам Hyperliquid (залог перпов — только USDC). Пять портфелей; без плеча / с плечом; шорт 0/10/20%;
потолок шорта по свободному залогу. Запуск: python3 app/imp9_loop2.py"""
import os, json, time, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from imp9_margin import HPort, SETS, scheme, hl_full, fmt, HERE
BEST = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
S0 = {"base": BEST["base"], "rules": BEST["rules"]}
PS = {k: HPort(v) for k, v in SETS.items()}
only = sys.argv[1:] or None
t = time.time()
CFG = [("без плеча", dict(lev=False), 0.0, 0.0, "strict"),
       ("без плеча + шорт 20%", dict(lev=False), 0.2, 0.0, "strict"),
       ("без плеча + шорт 10%", dict(lev=False), 0.1, 0.0, "strict"),
       ("без плеча + шорт 20%, потолок 1× залога", dict(lev=False), 0.2, 1.0, "strict"),
       ("без плеча + шорт 20%, потолок 0,5× залога", dict(lev=False), 0.2, 0.5, "strict"),
       ("ЛУЧШАЯ основы: R16 + A4 ×1,4 + шорт 20%", dict(D=60, lp=1.4, lr=1.5), 0.2, 0.0, "strict"),
       ("ЛУЧШАЯ основы, режим real (DOGE/PEPE и др. — перп 1×)", dict(D=60, lp=1.4, lr=1.5), 0.2, 0.0, "real"),
       ("R16 + A4 ×1,4 без шорта", dict(D=60, lp=1.4, lr=1.5), 0.0, 0.0, "strict"),
       ("ОСТОРОЖНАЯ основы: R16 + A4 ×1,25 + шорт 10%", dict(D=60, lp=1.25, lr=1.5), 0.1, 0.0, "strict")]
for tag, kw, sh, cap, mode in CFG:
    if only and not any(x in tag for x in only):
        continue
    S, L = scheme(S0, **kw)
    print(f"== {tag}", flush=True)
    for nm, P in PS.items():
        o = hl_full(P, S, L, sh, cap=cap, mode=mode)
        print(f"   {nm:7s} {fmt(o)}", flush=True)
print(f"[{time.time() - t:.0f} с]")
# потолок всего номинала перпов (плечевые ноги + шорт) по стоимости счёта перпов
if only and "acap" in only:
    for lp, sh, acap in ((1.4, 0.2, 1.0), (1.4, 0.2, 0.5), (1.25, 0.1, 1.0), (1.4, 0.0, 1.0)):
        S, L = scheme(S0, D=60, lp=lp, lr=1.5)
        print(f"== R16 + A4 ×{lp} + шорт {sh:.0%}, номинал перпов ≤ {acap}× счёта перпов", flush=True)
        for nm, P in PS.items():
            print(f"   {nm:7s} {fmt(hl_full(P, S, L, sh, mode='strict', acap=acap))}", flush=True)
