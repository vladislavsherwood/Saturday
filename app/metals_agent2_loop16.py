"""Круг 16: простота — абляция каждой части R5. Критерий удаления — в журнале.
Запуск: python3 app/metals_agent2_loop16.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent_lib as L
from metals_monthly import BOT, TOP


def main():
    D = A.load()
    thr = D["_thr3"]
    for k in A.metals(D):
        d = D[k]
        d["_tn7"], d["_bn7"] = L.count(d, thr, TOP), L.count(d, thr, BOT)
    R5 = A.evaluate(D, A.ver("R5"))
    acc = A.ACC
    C = {
        "(1) без группового маркера вершины": lambda d: A.r3(d, **acc, tn=d["_tn7"], nt=7),
        "(2) без маркера дна «пром. индекс»": lambda d: A.r3(d, **acc, bn=d["_bn7"], nb=7),
        "(4) без ценового перегрева": lambda d: A.r3(d, **acc, hot3=99.0),
        "(5) без растягивания серии (весь резерв за месяц)": lambda d: A.r3(d, **acc, g=1.0),
        "(6) ступени продаж 10/30% вместо 15/50%": lambda d: A.r3(d, **acc, s5=0.10, s6=0.30),
        "(8) без крупнее продаж после роста ×2,5": lambda d: A.r3(d, **{**acc, "rise_h": 0.0}),
    }
    # (3) lead=0: правило «медь-лидер» превращается в продажу 0 → план должен остаться взносом
    def no_leader(d):
        p = A.r3(d, **acc, lead=0.0)
        return np.where(p == 0.0, 1.0, p)
    C["(3) без правила «медь-лидер»"] = no_leader
    rows = []
    for nm, fn in C.items():
        R = A.evaluate(D, fn)
        s = A.cmp(R, R5)
        b = s["before"]
        removable = b["ok"] >= 7 and b["logsum"] >= -2 and s["h1"]["logsum"] >= -2 and s["h2"]["logsum"] >= -2 and s["before_lag1"]["logsum"] >= -2
        rows.append((nm, s, removable, R))
        print(f"  {'УБРАТЬ?' if removable else 'нужна  '} {nm}: {A.fb(s)}\n      до 1999 по металлам: {A.bymetal(s, 'before')}")
    print("\nВЕТО для кандидатов на удаление:")
    for nm, s, removable, R in rows:
        if removable:
            ok, why = A.veto_ok(s)
            print(f"  {nm}: {A.fa(s)} → {'удалить' if ok else 'оставить: ' + why}")
    # (7) страховка: при обычном пороге нейтральна; при строгом — помогает ли R5
    def strict(d, persist):
        return A.r3(d, **{**acc, "persist": persist, "k_on": 2})
    RS0 = A.evaluate(D, lambda d: strict(d, 0))
    RS4 = A.evaluate(D, lambda d: strict(d, 4))
    s = A.cmp(RS4, RS0)
    print(f"\n(7) страховка при строгом пороге дна (6 из 8), R5 с ней против R5 без неё: {A.fb(s)}")
    s0 = A.cmp(A.evaluate(D, lambda d: A.r3(d, **{**acc, "persist": 0})), R5)
    print(f"    при обычном пороге без страховки к R5: {A.fb(s0)}")


if __name__ == "__main__":
    main()
