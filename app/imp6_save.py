"""imp6: сохраняет found/imp6-best.json и found/imp6-best-margin.json из результатов imp6_best.py (found/imp6_results_tmp.json)."""
import os, json
import combo2_margin  # noqa: F401
from imp6_common import scheme, HERE, BOT, c

R = json.load(open(os.path.join(HERE, "found", "imp6_results_tmp.json")))
B2 = json.load(open(os.path.join(HERE, "found", "combo2-best.json")))
S0 = {"base": B2["base"], "rules": B2["rules"]}
S13, L13 = scheme(S0, D=60, lp=1.3, lr=1.5); S135, L135 = scheme(S0, D=60, lp=1.35, lr=1.5)
EXEC = {
    "when": "исполнять в конце дня t (около 23:30–23:55 UTC), т. е. по закрытию дня, СЛЕДУЮЩЕГО за днём решения (как в модели). "
            "Исполнение сразу после закрытия дня решения (00:10 UTC) хуже, чем на день позже: B −23%, M −32%, P3 −37% медианы к модели (основа ×1,4), "
            "и делает основу ×1,4 небезопасной (12 ликвидаций на B и 6 на P2 при −30%).",
    "split": "сигналы дна (группа 1), паники (2, 5, 7) и продажи (4): половина в день исполнения, половина на следующий день "
             "(продажа — половина доли от монет на день сигнала; покупка — половина суммы (act − 1)·резерв дня сигнала, с тем же плечом, не больше резерва). "
             "Обычный взнос, разворот, отложенная и возврат — без размазывания. Только для портфеля с плечом: по-монетно без плеча размазывание не проходит строгую проверку.",
    "oi": "OI BTCUSDT того же дня — из REST Binance futures/data/openInterestHist (period=1d, 30 дней); архив data.binance.vision — только сверка. "
          "Опоздание OI на день стоит 4–8% медианы, и вся потеря — в правиле дна «oidd30 < −28». Если REST недоступен — исполнять по устаревшему OI; "
          "ценовая замена (BTC за день < −x%) хуже или даёт ликвидации.",
    "prices": "SHIB, PEPE, BONK, FLOKI — закрытия Binance (data-api.binance.vision) или Hyperliquid вместо Yahoo (округление до 1e-6; found/imp6_prices.json).",
    "hyperliquid": "плечо и шорт — только если ВСЯ позиция держится на перпах (1× + плечо, залог — весь USDC счёта). Схема «спот на v + перп на (L−1)·v» "
                   "и шорт BTC на счёте со спотом небезопасны: залог перпов — только USDC, а после покупок на панике его нет (ликвидации на всех пяти портфелях). "
                   "Цена — фандинг на весь номинал: 6% годовых — около −10% медианы, 10% — около −25%. Без плеча — спот как есть (DOGE, PEPE — перп 1×)."}
best = {"name": "imp6: combo2-best (правила по монетам без изменений) + правила исполнения", "base": B2["base"], "rules": B2["rules"],
        "per_coin": "по-монетные правила, отбор/экзамен/50 случайных/100 новых и метрики дна/вершин — как в combo2-best.json (не менялись)",
        "execution": EXEC, "source": "app/research/imp6_journal.md"}
json.dump(best, open(os.path.join(HERE, "found", "imp6-best.json"), "w"), ensure_ascii=False, indent=1)
marg = {"strategy": "found/combo2-best.json", "safety_rule": "0 ликвидаций на пяти портфелях при исполнении −1 (по закрытию дня решения), в срок и +1 день, стресс −20/−30% (+20/+30% для шорта); "
        "для Hyperliquid — также по правилу биржи (залог USDC + PnL перпов ≤ поддерживающей маржи)",
        "best_safe": {"name": "R16 + A4 ×1,3 (60 дн) + шорт BTC 20% + размазывание 50/50 дна, паники и продаж",
                      "rules_with_sizes": S13, "group_leverage": {str(g): v for g, v in enumerate(L13)},
                      "split": {"weights": [0.5, 0.5], "groups": [1, 2, 5, 7, 4], "leverage_of_second_part": "как у первой"},
                      "short": {"coin": "BTC", "size": 0.2, "entry": [[c("fng", ">", 75)]], "exit": BOT + [[c("btcr30", ">", 20)]]}},
        "simple_safe": {"name": "R16 + A4 ×1,35 (60 дн) + шорт BTC 20%, без размазывания", "rules_with_sizes": S135, "group_leverage": {str(g): v for g, v in enumerate(L135)}},
        "unsafe": "R16 + A4 ×1,4 (лучшая безопасная combo/combo2) — ликвидации на B и P2 при −30% при исполнении по закрытию дня решения; "
                  "50/50 ×1,35 — 7 ликвидаций на B при −1; 50/50 ×1,4 — ликвидации на B и P2 уже в срок",
        "execution": EXEC, "results": R}
json.dump(marg, open(os.path.join(HERE, "found", "imp6-best-margin.json"), "w"), ensure_ascii=False, indent=1)
os.remove(os.path.join(HERE, "found", "imp6_results_tmp.json"))
print("сохранено")
