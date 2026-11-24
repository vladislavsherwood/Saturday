"""Круг 8: ловушка для фитилей на металлах (частота провалов внутри дня и лимитные заявки ниже вчерашнего закрытия). Запуск: python3 app/mt4_r8.py"""
import itertools

import numpy as np

import mt4_lib as M

KS, FS = [0.03, 0.05, 0.08], [0.1, 0.2, 0.3]


def main():
    M.tee("r8.txt")
    D = M.mload()
    DD = M.dload()
    MM = M.dmetals(DD, M.DSEL + M.DEXAM, start="2009-01-01")
    print("H8a: частота провалов минимума дня ниже вчерашнего закрытия (в год, с 2009) | доля «настоящих фитилей» (закрытие выше уровня) | минимум < 0,8×закрытия:")
    for k in M.DSEL + M.DEXAM:
        X = MM[k]
        lo, c = X.l, X.c
        ok = np.isfinite(lo) & (lo > 0)
        bad = ok & (lo < 0.8 * c)
        yrs = ok.sum() / 252
        row = []
        for kk in (0.02, 0.03, 0.05, 0.08):
            hit = np.r_[False, ok[1:] & ~bad[1:] & (lo[1:] <= c[:-1] * (1 - kk))]
            real = hit & np.r_[False, c[1:] > c[:-1] * (1 - kk)]
            row.append(f"−{kk:.0%}: {hit.sum() / yrs:.1f}/год (фитиль {real.sum() / max(hit.sum(), 1) * 100:.0f}%)")
        print(f"  {M.NAME[k]}: " + "; ".join(row) + f" | ошибочных минимумов {bad.sum()}")
    # H8b
    BP = {k: M.mmap(M.VERS["Q2"](D[k]), D[k]["t"], MM[k].t, True) for k in MM}
    print("\nH8b: лимит по вчерашнему закрытию × (1 − k) на долю f резерва Q2д — к Q2д (половины 2009–17 / 2018–26):")
    res, by = {}, {}
    for kk, f in itertools.product(KS, FS):
        cells, nfs = {}, 0
        for k in M.DSEL:
            X = MM[k]
            lo = np.where(np.isfinite(X.l) & (X.l > 0.8 * X.c), X.l, 0.0)
            b = int(np.searchsorted(X.t.values, np.datetime64("2018-01-01")))
            for nm, (a0, a1) in (("h1", (0, b)), ("h2", (b, X.n))):
                e, nf = M.dsim_wick(X.c, lo, BP[k], a0, a1, 0, kk, f, 0.001)
                e0 = M.dsim(X.c, BP[k], a0, a1, 0, X.rate0, 0.001)[0]
                cells[(k, nm)] = M.rel(e, e0)
                nfs += nf
        v = np.array(list(cells.values()))
        s = float(np.log1p(v / 100).sum() * 100)
        h1 = float(sum(np.log1p(cells[(k, "h1")] / 100) for k in M.DSEL) * 100)
        h2 = float(sum(np.log1p(cells[(k, "h2")] / 100) for k in M.DSEL) * 100)
        ok = s >= 2 and h1 >= 0 and h2 >= 0 and (v >= -0.5).sum() >= 7
        res[(kk, f)] = (s, h1, h2, cells, nfs, ok); by[(kk, f)] = ok
    for key, (s, h1, h2, cells, nfs, ok) in sorted(res.items(), key=lambda kv: -kv[1][0]):
        pl = M.dplateau(by, key, [KS, FS])
        print(f"  {'✓' if ok and pl else '·'} k {key[0]:.0%} f {key[1]:.0%}: сумма {s:+.2f} (H1 {h1:+.2f}, H2 {h2:+.2f}), исполнений {nfs} | "
              + " ".join(f"{M.NAME[k][:3]} {cells[(k, 'h1')]:+.2f}/{cells[(k, 'h2')]:+.2f}" for k in M.DSEL))


if __name__ == "__main__":
    main()
