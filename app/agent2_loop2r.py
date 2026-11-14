"""Агент 2, круг 2: разбор сетки agent2_loop2.py. Запуск: python3 app/agent2_loop2r.py <loop2.json>"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent2_margin import fmt2, safe

R = json.load(open(sys.argv[1]))
S = [o for o in R if safe(o)]
print(f"схем {len(R)}, без ликвидаций без стресса {sum(o['liq'] == 0 for o in R)}, проверено в стрессе {sum('l20' in o for o in R)}, безопасных {len(S)}")
cf = lambda o: "дно {}%, паника ×{}, неподтв. {}, разворот {}%, отложенная {}% | плечо дно ×{}, паника ×{}, неподтв. ×{}, разворот ×{}, отложенная ×{}".format(  # noqa: E731
    int(o["cfg"][0] * 100), o["cfg"][1], o["cfg"][2] if o["cfg"][2] == "K1" else f"{int(o['cfg'][2] * 100)}%", int(o["cfg"][3] * 100), int(o["cfg"][4] * 100), *o["cfg"][5:])
print("\nлучшие безопасные:")
for o in S[:12]:
    print(f"  {fmt2(o)}\n      {cf(o)}")
print("\nлучшая безопасная по размеру неподтверждённой паники:")
for su in (0.1, 0.25, 0.5, "K1"):
    q = [o for o in S if o["cfg"][2] == su]
    if q:
        print(f"  {str(su):5s}: {fmt2(q[0])}\n         {cf(q[0])}")
print("\nлучшая безопасная по плечу отложенной покупки:")
for ld in (1, 1.5, 2):
    q = [o for o in S if o["cfg"][9] == ld]
    if q:
        print(f"  ×{ld}: {fmt2(q[0])}\n        {cf(q[0])}")
print("\nсхема K3 (дно 25% ×2, паника ×2 ×1,25, неподтв. 10%, разворот 50% ×2) с разной отложенной:")
for o in R:
    c = o["cfg"]
    if c[:4] == [0.25, 2.0, 0.1, 0.5] and c[5:9] == [2, 1.25, 1, 2]:
        print(f"  отложенная {int(c[4] * 100)}% ×{c[9]}: {fmt2(o)}")
