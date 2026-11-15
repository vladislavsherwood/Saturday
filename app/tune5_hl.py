"""tune5: схемы плеча и шорта combo2 в модели Hyperliquid агента imp9 (app/imp9_margin.py: залог перпов — только USDC + PnL перпов, спот
не залог; поддерживающая маржа BTC 1,25%, ETH 2%, SOL 2,5%, прочие 5%; фандинг перпа BTC). Пять портфелей, строгий режим, в срок и на день
позже, стресс −20/−30% (+20/+30% для шорта), ставка 11% и 15%. Плечо — по группам схемы tune5_margin.scheme5; acap — потолок номинала перпов
(лонги плеча + шорт) ≤ acap × стоимость счёта перпов, и спот не тратит USDC, нужный этому залогу (иначе — ликвидации во всех стартах, imp9).
raw — combo2 как есть без плеча (без размеров R16). Шорт BTC: доля sh капитала, номинал ≤ cap × свободный залог (imp9: 15%, 0,5×).
Запуск: python3 app/tune5_hl.py <варианты.json> <выход.json>; вариант — {"m": параметры scheme5 + lev: {группа: плечо}, sh, cap, acap}"""
import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import combo2_margin as CM  # noqa: F401,E402
from combo_margin import SETS  # noqa: E402
from imp9_margin import HPort, hl_full  # noqa: E402
from tune5_margin import scheme5, DEF, S_C2  # noqa: E402
from agent2_margin import grouped  # noqa: E402

if __name__ == "__main__":
    V = json.load(open(sys.argv[1])); out = sys.argv[2]
    PS = {k: HPort(v) for k, v in SETS.items()}
    RES = json.load(open(out)) if os.path.exists(out) else {}
    t = time.time()
    for vn, o in V.items():
        if vn in RES: continue
        m = {**DEF, "cap": 0.5, "acap": 0.0, **o.get("m", {})}
        S, L = scheme5(o.get("S") or S_C2, **m)
        if m.get("raw"):                    # combo2 как есть (доли без размеров R16), без плеча
            S, L = grouped(o.get("S") or S_C2), [1.0] * 8
        if "lev" in m:                      # явное плечо по группам (остальные 1)
            L = [1.0] * 8
            for g, v in m["lev"].items(): L[int(g)] = v
        row = {}
        for pn, P in PS.items():
            for rate, sfx in ((0.11 / 365, ""), (0.15 / 365, " 15%")):
                if sfx and max(L) <= 1: continue
                r = hl_full(P, S, L, sh=m["sh"], cap=m["cap"], acap=m["acap"], rate=rate, fund=True)
                row[pn + sfx] = {k: r[k] for k in ("m0", "m1", "p10", "hlm", "hlm30", "safe", "liq", "worst")}
        ok = all(x["safe"] for x in row.values())
        RES[vn] = {"m": m, "L": L, "ok": ok, "row": row}
        print(f"{'OK' if ok else '✘ '} {vn:40s} " + " | ".join(f"{pn} {row[pn]['m0']:+.0f}/{row[pn]['m1']:+.0f} з{min(row[pn]['hlm30'], 99):.2f}" + ("" if all(row[k]['safe'] for k in row if k.startswith(pn)) else f" ЛИКВ{max(row[pn]['liq'])}") for pn in PS) + f" [{time.time() - t:.0f} с]", flush=True)
        json.dump(RES, open(out, "w"), ensure_ascii=False, default=float)
