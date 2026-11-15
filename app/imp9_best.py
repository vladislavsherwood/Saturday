"""imp9: сохраняет found/imp9-best.json (правила по монетам — без изменений, combo-best / combo2-best) и found/imp9-best-margin.json
(шорт BTC по правилам Hyperliquid) по результатам круга 5 (scratchpad/imp9_loop5.json). Запуск: python3 app/imp9_best.py"""
import os, json
HERE = os.path.dirname(os.path.abspath(__file__))
R = json.load(open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp9_loop5.json"))
c = lambda i, o, v: {"ind": i, "op": o, "v": v}  # noqa: E731
EXIT = [[c("usdt", ">", 1.07), c("othd", "<", 25)], [c("fng", "<", 10)], [c("oidd30", "<", -28)], [c("btcr30", ">", 20)]]
SHORT = {"coin": "BTC (перп Hyperliquid, кросс-маржа)", "entry": [[c("fng", ">", 75)]], "exit": EXIT, "size_of_equity": 0.15,
         "cap_of_free_collateral": 0.5,
         "rule": "в день после «жадность > 75» открыть шорт перпа BTC на min(15% капитала счёта, 0,5 × свободный залог перпов), "
                 "где свободный залог = USDC + нереализованный PnL перпов (спотовые монеты не считаются); добавлять не нужно; "
                 "закрыть reduce-only на следующий день после сигнала дна (паника в стейблах, страх < 10, вынос OI −28%) или разворота BTC (+20% за 30 дней)",
         "funding": "шорт получает фандинг перпа BTC (в модели — исторический дневной ряд Binance с 2020 г., раньше 0); заём BTC не нужен"}
ALT = {"20% / 0,5×": "то же, 20% капитала, ≤ 0,5× залога: чуть больше дохода (+0,06 по сумме), 2019–21 −1,5%",
       "20% / 0,75×": "агрессивнее: запас при +30% лишь 0,16; не рекомендую",
       "жадность > 75 или qt, 20% / 0,5×": "ровнее по циклам (2019–21 +0,19, 2022–26 +0,21 к варианту без шорта), по сумме хуже"}
best = {"name": "imp9: правила по монетам без изменений (основа combo-best, проверено и поверх combo2-best); меняется только исполнение шорта BTC",
        "rules_source": {"combo-best": "found/combo-best.json", "combo2-best": "found/combo2-best.json"},
        "per_coin": "правила продаж/покупок не менялись → отбор/экзамен/50 случайных/100 новых и метрики дна/вершин — как у основы",
        "hedge_instead_of_sell": "отвергнуто (круг 1): без USDC-залога шорт ликвидируется (спот на Hyperliquid не залог), "
                                  "своим перпом — ликвидации на пампах альтов даже при залоге 3×; шорт BTC вместо продажи безопасен, но доход −1,1…−2,5",
        "journal": "research/imp9_journal.md"}
json.dump(best, open(os.path.join(HERE, "found", "imp9-best.json"), "w"), ensure_ascii=False, indent=1)
margin = {"model": "imp9_margin.simhl: правила Hyperliquid — залог перпов только USDC + PnL перпов, спот не считается; поддерживающая маржа BTC 1,25%, ETH 2%, SOL 2,5%, "
                   "прочие 5%; ликвидация по минимуму/максимуму дня; стресс −20/−30/−50% минимумов и +20/+30/+50% максимумов; в срок и на день позже; 105 стартов; пять портфелей; "
                   "строгий режим (ни одна монета не залог), для P9 также real (DOGE/PEPE — перп 1×)",
          "leverage": "без плеча: по правилам Hyperliquid плечо R16 + A4 (лонг перпа (L−1)·v при покупке почти всем резервом) ликвидируется во всех 105 стартах; "
                      "с запретом тратить залог перпов на спот — безопасно, но хуже, чем без плеча (P9 +368% против +505%)",
          "short": SHORT, "alternatives": ALT,
          "base_short_under_HL": "шорт основы (20% капитала без потолка) — 56–62 ликвидации из 105 уже без стресса, 91–92 при +20/+30%",
          "results": R}
json.dump(margin, open(os.path.join(HERE, "found", "imp9-best-margin.json"), "w"), ensure_ascii=False, indent=1, default=float)
print("сохранено")
