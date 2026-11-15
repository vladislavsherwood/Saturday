"""imp5: сохраняет found/imp5-best.json и found/imp5-best-margin.json из результатов кругов 2–5 (JSON в папке расчётов)."""
import json, os
D = "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad"
HERE = os.path.dirname(os.path.abspath(__file__))
r4 = json.load(open(os.path.join(D, "imp5_r4.json"))); r4b = json.load(open(os.path.join(D, "imp5_r4b.json")))
c2 = json.load(open(os.path.join(D, "imp5_r5_combo2.json"))); rt = json.load(open(os.path.join(D, "imp5_r5_rate.json")))
nw = json.load(open(os.path.join(D, "imp5_r5_new.json")))
keep = lambda R: {k: {x: (round(v, 2) if isinstance(v, float) else v) for x, v in o.items() if x != "worst1"} for k, o in R.items()}  # noqa: E731
rules = {
    "per_coin_rules": "без изменений: found/combo-best.json (или found/combo2-best.json) и схемы маржи found/combo-best-margin.json",
    "S2 (лучший)": {
        "spill": "25% выручки каждой продажи монеты (после погашения её долга в той же доле) идёт в ОБЩИЙ котёл; 75% — в резерв этой монеты, как раньше",
        "allocation": "покупка монеты на правиле с долей a: сумма = взнос + (a − 1) × (свой резерв + доля котла); доля котла монеты = вес / Σ весов монет с ценой; "
                      "вес = число дневных взносов монеты с начала (новая монета не получает сразу накопленный котёл) × exp(rel180 / 100), "
                      "rel180 — обгон монетой BTC за 180 дней в % (нет 180 дней истории — множитель 1); деньги берутся сначала из своего резерва, потом из котла",
        "rebalance": "раз в 91 день от начала: 10% разрыва между чистой стоимостью каждой монеты (монеты − её долг) и равной долей среди монет с ценой закрывается "
                     "обменом (продажа перевеса, покупка недовеса на вырученные деньги, без плеча)",
        "params": {"spill": 0.25, "wmode": 1, "weight": "exp(rel180/100)", "RB": 91, "rho": 0.1}},
    "S1 (проще)": {"same_as": "S2 без ребалансировки", "params": {"spill": 0.25, "wmode": 1, "weight": "exp(rel180/100)"}},
    "edge": "вес exp(2·rel180/100) — ликвидации (B, лучшая схема, −30%); потолок доли монеты — ликвидации; ребалансировка с полосой ×2–3 и ρ1 — ликвидации; "
            "ребалансировка ρ ≥ 0,25 раз в месяц — худшие 10% −3…−4 п.п.",
    "rejected": ["общий резерв поровну (новые монеты сразу получают котёл — отбор задним числом)", "котёл к глубже упавшим (dd365)", "котёл к слабым к BTC",
                 "котёл по бете", "потолок доли 25/35/50%", "полная ребалансировка 30/91 дн (рост M/P3, но худшие 10% −8…−10 п.п.)", "ребалансировка с полосой"],
}
best = {"name": "imp5 S2: перенос 25% выручки продаж в общий котёл, котёл по взносам × силе к BTC (rel180), раз в квартал 10% разрыва к равным долям",
        "base": "found/combo-best.json (проверено и поверх found/combo2-best.json)", "tool": "app/imp5_port.py (simP, опции spill/wmode/WT/RB/rho)",
        "rules": rules, "journal": "app/research/imp5_journal.md",
        "results_five_plus_K": {"основа": keep(r4["основа"]), "S1": keep(r4["S1"]), "S2": keep(r4b["S1 + RB91 ρ0.1"])},
        "random_new_portfolios": {"how": "30 портфелей: BTC + 8 случайных монет из 100 новых (страницы n0…n9), seed 5", **nw},
        "note": "отбор/экзамен/50 случайных не применимы: правила по монетам не меняются, изменения только на уровне портфеля"}
json.dump(best, open(os.path.join(HERE, "found", "imp5-best.json"), "w"), ensure_ascii=False, indent=1)
margin = {"strategy": best["name"], "schemes": "без плеча; лучшая (R16 + A4 ×1,4 + шорт BTC 20%); осторожная (R16 + A4 ×1,25 + шорт 10%) — из combo-best-margin.json без изменений",
          "safety": "0 ликвидаций на P9, B, M, P2+BTC, P3+BTC и K в срок и на день позже, стресс −20/−30% (+20/+30% шорт), ставки 11% и 15%, поверх combo-best и combo2-best",
          "rate_check": keep({k: v for k, v in rt["S2"].items()}), "rate_base": keep(rt["основа"]),
          "over_combo2": {k: keep(v) for k, v in c2.items()},
          "warning": "на случайных портфелях из 100 новых монет лучшая схема плеча НЕ безопасна уже у основы: ликвидации в стрессе на 14 из 30 портфелей (S1 — 7, S2 — 8)"}
json.dump(margin, open(os.path.join(HERE, "found", "imp5-best-margin.json"), "w"), ensure_ascii=False, indent=1)
print("saved")
