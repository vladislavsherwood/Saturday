"""Данные дня для DCA-помощника (SNAP) в JSON — для встраивания в другие приложения (ShiftMate).
Сначала обновляет деривативы (liq_data.py: OI, фандинг, лонг/шорт из архива Binance — нужны правилам combo4), затем считает SNAP
так же, как build_app_artifact.py (build_snap), и пишет JSON атомарно. Запускать раз в день после закрытия дня UTC (например, в 00:30–02:00 UTC).
Запуск: python3 app/build_snap.py <куда.json> [--no-refresh]"""
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def main(out, refresh=True):
    t0 = time.time()
    if refresh:   # архив Binance отстаёт на 1–2 дня; при ошибке сети остаются прежние данные, сборка продолжается
        r = subprocess.run([sys.executable, os.path.join(HERE, "liq_data.py")], capture_output=True, text=True, timeout=900)
        print("liq_data.py:", "ok" if r.returncode == 0 else "ошибка " + r.stderr[-300:], f"[{time.time() - t0:.0f} с]", flush=True)
    import build_app_artifact as BA
    snap = BA.build_snap()
    tmp = out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(snap, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, out)
    print(out, round(os.path.getsize(out) / 1024), "КБ, данные по", snap["as_of"], f"[{time.time() - t0:.0f} с]")


if __name__ == "__main__":
    main(sys.argv[1], "--no-refresh" not in sys.argv)
