"""Круг 10 mvd: итог — таблица к DCA и к mb1 по металлам (A / B / 2005–25 / вся история 2000–26) для mb1 и ближайшей непринятой шкалы;
«что сейчас» на последний день данных (mb1 — принятая основа; шкала — справочно). Запуск: python3 app/mvd_r10.py"""
import json
import os

import numpy as np

import mb_lib as B
import mvd_lib as V
from mvd_r8 import near


def main():
    V.tee("r10.txt")
    D, DD, MM, base = V.load()
    N0 = near()
    N1 = near(W=2520)
    out = {"table": {}, "now": {}}
    print("=== ИТОГ К DCA, % (A 2005–15 / B 2016–25 / 2005–25 / вся история 2000-09…2026-11) ===")
    for k in V.ALL5:
        X = MM[k]
        sg = V.segs(X)
        segs = {"A": sg["A"], "B": sg["B"], "2005–25": (sg["A"][0], sg["B"][1]), "2000–26": (0, X.n)}
        row = {}
        for nm, fn in (("mb1", lambda s: V.run_mb1(X, s)), ("шкала реальн. (5 лет)", lambda s: V.run(N0, X, s)[0]),
                       ("шкала реальн. (10 лет)", lambda s: V.run(N1, X, s)[0])):
            row[nm] = {h: (float(fn(s)) if s[1] - s[0] >= 250 else None) for h, s in segs.items()}
        out["table"][k] = row
        f = lambda v: "—" if v is None else f"{v:+.1f}"  # noqa: E731
        print(f"  {V.NAME[k]}: " + " | ".join(f"{nm} " + "/".join(f(row[nm][h]) for h in segs) for nm in row))
        print("      шкала (5 лет) к mb1: " + "/".join("—" if row["mb1"][h] is None else f"{V.rel(row['шкала реальн. (5 лет)'][h], row['mb1'][h]):+.1f}" for h in segs))

    print("\n=== ЧТО СЕЙЧАС (последний день данных 2026-11-23; месячные макро — по 2026-10) ===")
    thr = D["_thr3"]
    for k in V.ALL5:
        X = MM[k]
        d = D[k]
        p = B.Q2M(d)
        F = d["F"]
        p3 = float(F[B.A.P3].values[-1])
        lvl = d["c"][-1] / p3 * thr[(B.A.P3, "lo")]
        since = B.M.L.since(p <= -0.2 + 1e-9)[-1]
        cool_left = max(0, 24 - int(since)) if since < 10 ** 5 else 0
        a = float(base[k][-1])
        act = "серия: взнос + доля резерва" if a > 1 else ("продажа" if a < 0 else ("копить взнос (остывание после продажи)" if a == 0 else "обычный взнос"))
        nb = int(d["bn3"][-1])
        u = N0.u(X)[-1]
        m = float(N0.mult(X)[-1])
        raw = V.ind(X, "rr")
        hist = raw[max(0, X.n - 1260):]
        q30, q90 = np.nanquantile(hist, 0.3), np.nanquantile(hist, 0.9)
        out["now"][k] = {"price": float(X.c[-1]), "mb1_today": act, "mb1_mult": 0.0 if a == 0 else 1.0, "bottom_markers": nb,
                         "cooldown_months_left": cool_left, "price_marker_level_month_avg": float(lvl), "scale_u": float(u), "scale_mult": m,
                         "rr_dev_now": float(-raw[-1]), "rr_dev_cheap_if_above": float(-q30), "rr_dev_expensive_if_below": float(-q90)}
        print(f"  {V.NAME[k]} {X.c[-1]:.2f}: mb1 — {act} (×{0 if a == 0 else 1} взноса); маркеров дна {nb}/8 (серия при ≥ 5); остывание ещё {cool_left} мес.; "
              f"ценовой маркер дна загорится при средней месяца < {lvl:.1f}")
        print(f"      непринятая шкала (реальная ставка): u = {u:.2f} → ×{m:g} взноса; реальная ставка к средней 3 лет {-raw[-1]:+.2f} п.п.; "
              f"«дёшево ×2» при > {-q30:+.2f}, «дорого ×0,5» при < {-q90:+.2f}")
    Xm = D["_X"]
    rr = Xm["y10"] - (Xm["cpi"] / Xm["cpi"].shift(12) - 1) * 100
    print(f"  реальная ставка 10 лет (10 лет минус инфляция за год): {rr.iloc[-1]:.2f}%, средняя 3 лет {rr.rolling(36).mean().iloc[-1]:.2f}%")
    json.dump(B.clean(out), open(os.path.join(V.LOGDIR, "r10.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
