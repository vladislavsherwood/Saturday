"""Круг 2: месячные планы R3 / R6 / Q2 в дневной модели (размазанное исполнение и «в первый день») против дневного DCA и против месячной модели
на том же отрезке. Запуск: python3 app/mt4_r2.py"""
import numpy as np

import mt4_lib as M

KEYS = M.DSEL + M.DEXAM


def mplans(D, M_):
    """{версия: {металл: дневной план (размазанный), дневной план (первый день)}}."""
    out = {}
    for v, fn in M.VERS.items():
        out[v] = {}
        for k in KEYS:
            d = D[k]
            p = fn(d)
            X = M_[k]
            out[v][k] = (M.mmap(p, d["t"], X.t, True), M.mmap(p, d["t"], X.t, False))
    return out


def main():
    M.tee("r2.txt")
    D = M.mload()
    DD = M.dload()
    MM = M.dmetals(DD, KEYS)
    P = mplans(D, MM)
    one = lambda X: np.ones(X.n)  # noqa: E731
    print("Итог к дневному DCA, % (H1 2000-09…2013-09 / H2 2013-10…2026-11 / весь) — размазанное исполнение; [первый день]; (месячная модель на том же отрезке):")
    for v in M.VERS:
        print(f"\n{v}:")
        for k in KEYS:
            X = MM[k]
            d = D[k]
            sp, fd = P[v][k]
            r = {part: X.run(sp, part)[0] for part in ("h1", "h2", "full")}
            r1 = {part: X.run(fd, part)[0] for part in ("h1", "h2", "full")}
            # месячная модель на тех же отрезках
            t = d["t"]
            a0 = int(np.searchsorted(t.values, np.datetime64(M.START)))
            hs = int(np.searchsorted(t.values, np.datetime64(M.HSPLIT)))
            pm = M.VERS[v](d)
            if a0 >= len(t) - 1:
                a0 = 0
            mo = {"h1": M.msim(d["c"], pm, max(a0, 0), hs)[0] if hs > a0 + 24 else np.nan, "h2": M.msim(d["c"], pm, hs, len(t))[0], "full": M.msim(d["c"], pm, a0, len(t))[0]}
            print(f"  {M.NAME[k]:9s} " + " / ".join(f"{r[p]:+6.1f}" for p in ("h1", "h2", "full")) + "   [" + " / ".join(f"{r1[p]:+6.1f}" for p in ("h1", "h2", "full"))
                  + "]   (" + " / ".join("—" if not np.isfinite(mo[p]) else f"{mo[p]:+6.1f}" for p in ("h1", "h2", "full")) + ")")
        o = M.dstat(MM, lambda X, v=v: P[v][X.k][0], one, episodes=True)
        ok, why = M.dok(o)
        print(f"  к DCA по протоколу: {M.dfmt(o)}\n  без эпизода: " + ", ".join(f"{a} {b:+.1f}" for a, b in o["epsum"].items()) + f" → {'проходит' if ok else 'нет: ' + why}")
        o2 = M.dstat(MM, lambda X, v=v: P[v][X.k][1], lambda X, v=v: P[v][X.k][0], starts=False, episodes=False)
        print(f"  первый день к размазанному: {M.dfmt(o2)}")
    # медиана разницы дневная − месячная (Q2, весь отрезок, 4 металла)
    diffs = []
    for k in M.DSEL:
        X, d = MM[k], D[k]
        a0 = int(np.searchsorted(d["t"].values, np.datetime64(M.START)))
        diffs.append(X.run(P["Q2"][k][0], "full")[0] - M.msim(d["c"], M.VERS["Q2"](d), a0, len(d["c"]))[0])
    print(f"\nQ2: дневная − месячная (весь отрезок, п.п.): " + ", ".join(f"{M.NAME[k][:4]} {x:+.1f}" for k, x in zip(M.DSEL, diffs)) + f"; медиана {np.median(diffs):+.1f}")
    # R6 и Q2 к R3 в дневной модели
    for v in ("R6", "Q2"):
        o = M.dstat(MM, lambda X, v=v: P[v][X.k][0], lambda X: P["R3"][X.k][0], episodes=False)
        print(f"{v} к R3 (дневная): {M.dfmt(o)}")


if __name__ == "__main__":
    main()


def same_end():
    """Дневная и месячная Q2 на одинаковом конце (2025-12 и 2026-10): разница п.п."""
    D = M.mload()
    DD = M.dload()
    MM = M.dmetals(DD, M.DSEL)
    P = mplans(D, MM) if False else None  # noqa: F841
    for end in ("2025-12-31", "2026-10-31"):
        diffs = []
        for k in M.DSEL:
            X, d = MM[k], D[k]
            sp = M.mmap(M.VERS["Q2"](d), d["t"], X.t, True)
            b = int(np.searchsorted(X.t.values, np.datetime64(end), "right"))
            a0 = int(np.searchsorted(d["t"].values, np.datetime64(M.START)))
            bm = int(np.searchsorted(d["t"].values, np.datetime64(end), "right"))
            e_d = X.run(sp, (0, b))[0]
            e_m = M.msim(d["c"], M.VERS["Q2"](d), a0, bm)[0]
            diffs.append((k, e_d, e_m))
        print(f"конец {end}: " + ", ".join(f"{M.NAME[k][:4]} дн. {a:+.1f} / мес. {b:+.1f}" for k, a, b in diffs)
              + f"; медиана разницы {np.median([a - b for _, a, b in diffs]):+.1f} п.п.")


if __name__ == "__main__":
    same_end()
