"""Создаёт сервер Hetzner для приложения и печатает его адрес и ссылку первой настройки.

Токен Hetzner в скрипт не передаётся: запросы идут через прокси сессии, который подставляет его сам.
Вне такой сессии задайте переменную HCLOUD_TOKEN.

Запуск: python3 app/deploy/provision.py [тип сервера] [локация]
"""
import json
import os
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request

API = "https://api.hetzner.cloud/v1"
HERE = os.path.dirname(os.path.abspath(__file__))
NAME = "dca"


def call(method, path, body=None):
    headers = {"Content-Type": "application/json"}
    if os.environ.get("HCLOUD_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["HCLOUD_TOKEN"]
    req = urllib.request.Request(API + path, method=method, headers=headers, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Hetzner ответил {e.code}: {e.read().decode()[:300]}")


def main(server_type="cx22", location="nbg1"):
    have = [s for s in call("GET", "/servers")["servers"] if s["name"] == NAME]
    if have:
        ip = have[0]["public_net"]["ipv4"]["ip"]
        raise SystemExit(f"Сервер «{NAME}» уже есть: {ip}, https://{ip.replace('.', '-')}.sslip.io — второй не создаю.")
    branch = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], capture_output=True, text=True, cwd=HERE).stdout.strip() or "main"
    code = secrets.token_urlsafe(18)
    user_data = open(os.path.join(HERE, "cloud-init.yaml"), encoding="utf-8").read().replace("__BRANCH__", branch).replace("__SETUP_CODE__", code)
    r = call("POST", "/servers", {"name": NAME, "server_type": server_type, "image": "ubuntu-24.04", "location": location, "user_data": user_data,
                                   "public_net": {"enable_ipv4": True, "enable_ipv6": True}, "labels": {"app": "dca"}})
    sid, ip = r["server"]["id"], r["server"]["public_net"]["ipv4"]["ip"]
    url = f"https://{ip.replace('.', '-')}.sslip.io"
    print(f"сервер {sid} создаётся: {ip}, тип {server_type}, локация {location}, ветка {branch}")
    for _ in range(60):
        if call("GET", f"/servers/{sid}")["server"]["status"] == "running":
            break
        time.sleep(5)
    print("адрес:", url)
    print("настройка:", f"{url}/setup?code={code}")
    json.dump({"id": sid, "ip": ip, "url": url, "setup": f"{url}/setup?code={code}"}, open(os.path.join(HERE, ".server.json"), "w"))


if __name__ == "__main__":
    main(*sys.argv[1:])
