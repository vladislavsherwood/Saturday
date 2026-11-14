"""Агент «МЕМЫ»: сохраняет found/seg_meme-best-margin.json из результатов seg_meme_margin.py (основа, CM2, P35 + CM2 на пяти портфелях).
Схема маржи — combo-best-margin.json без изменений (R16 + A4 ×1,4 (60 дн) + шорт BTC 20%; осторожная ×1,25 + 10%; средняя ×1,3 + 15%).
Запуск: python3 app/seg_meme_best_margin.py <margin_CM2.json> <margin_P35CM2.json>"""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__))
A = json.load(open(sys.argv[1])); B = json.load(open(sys.argv[2]))
keep = ("m0", "m1", "p10", "p10_1", "lvl", "liq", "safe", "worst_start", "by_year")
res = {k: {p: {q: o[q] for q in keep} for p, o in v.items()} for k, v in {**B, **A}.items()}
out = {"strategy": "found/seg_meme-best.json: основной CM2, рискованный P35 + CM2 (aggressive); основа — found/combo-best.json",
       "scheme": "без изменений: found/combo-best-margin.json (лучшая R16 + A4 ×1,4 (60 дн) + шорт BTC 20%, средняя ×1,3 + 15%, осторожная ×1,25 + 10%)",
       "model": "combo_margin.py (agent4d_margin.Book/sim4), 105 стартов, в срок и на день позже, стресс −20/−30% и +20/+30% для шорта, ставка 11% (и 15% для лучшей); "
                "индикаторы meme (agent4d_margin.MEMES) и ddm90 добавлены в Book.ind (seg_meme_margin.py)",
       "safe_all_five": {k: all(o["safe"] for o in v.values()) for k, v in res.items()},
       "results": res}
json.dump(out, open(os.path.join(HERE, "found", "seg_meme-best-margin.json"), "w"), ensure_ascii=False, indent=1)
print("сохранено: app/found/seg_meme-best-margin.json"); print(json.dumps(out["safe_all_five"], ensure_ascii=False, indent=1))
