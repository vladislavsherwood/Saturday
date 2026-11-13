"""Распознавание скриншота сделки через Claude: из картинки с биржи или кошелька достаётся черновик записи в журнал.

Нужен ключ ANTHROPIC_API_KEY (или вход через `ant auth login`). Без него приложение работает, но сделки вводятся руками.
Функция ничего не записывает: черновик показывается человеку, и в журнал он попадает только после подтверждения.
"""
import base64
from typing import Literal, Optional

from pydantic import BaseModel

MODEL = "claude-opus-5-5"
MEDIA = ("image/jpeg", "image/png", "image/webp", "image/gif")
LIMIT = 8 * 1024 * 1024          # больше 8 МБ картинку не принимаем


class ScanError(Exception):
    def __init__(self, status, text):
        super().__init__(text)
        self.status = status


class Draft(BaseModel):
    found: bool                                   # есть ли на картинке совершённая сделка покупки или продажи
    side: Optional[Literal["buy", "sell"]]
    asset: Optional[str]                          # тикер актива, как он написан на скриншоте: BTC, SOL, AAPL
    symbol: Optional[str]                         # какой из тикеров пользователя это, или null, если такого нет
    amount_usd: Optional[float]                   # сумма сделки в долларах (USD, USDT, USDC считаются долларами)
    quantity: Optional[float]                     # сколько единиц актива куплено или продано
    price: Optional[float]                        # цена за единицу в долларах
    fee_usd: Optional[float]
    date: Optional[str]                           # дата сделки ГГГГ-ММ-ДД
    currency: Optional[str]                       # валюта суммы, как на скриншоте
    note: str                                     # одно короткое предложение по-русски: что не удалось прочитать или в чём сомнение; пусто, если всё ясно


PROMPT = """На картинке — скриншот из приложения биржи, брокера или кошелька. Найди на нём одну совершённую сделку покупки или продажи актива и перепиши её данные.

Правила:
- Бери только то, что написано на картинке. Чего нет — оставляй null, не вычисляй и не догадывайся. Исключение: дату можно собрать из написанного на экране дня и месяца, взяв год из сегодняшней даты.
- Сумма — в долларах. USDT, USDC и USD считай долларами один к одному. Если сумма в другой валюте, оставь amount_usd и price пустыми, запиши валюту в currency и скажи об этом в note.
- Десятичный разделитель может быть запятой, разряды могут быть разделены пробелами или точками — приведи числа к обычному виду.
- Если на экране заявка, которая ещё не исполнена, пополнение, вывод или перевод, а не сделка, — ставь found = false и объясни в note.
- Если сделок на экране несколько, возьми самую верхнюю и напиши об этом в note.
- symbol выбери из списка тикеров пользователя, если актив сделки есть в этом списке; иначе null.

Тикеры пользователя: {tickers}
Сегодня: {today}"""


def read(image_b64, media_type, tickers, today):
    """Черновик сделки со скриншота: словарь с полями для формы подтверждения."""
    if media_type not in MEDIA:
        raise ScanError(400, "Нужна картинка в формате JPEG, PNG или WebP")
    try:
        if len(base64.b64decode(image_b64, validate=True)) > LIMIT:
            raise ScanError(413, "Картинка больше 8 МБ — сделайте скриншот поменьше")
    except ValueError:
        raise ScanError(400, "Картинка повреждена")
    try:
        import anthropic
    except ImportError:
        raise ScanError(503, "Распознавание не настроено: на сервере не установлен пакет anthropic")
    try:
        client = anthropic.Anthropic()
        resp = client.messages.parse(
            model=MODEL,
            max_tokens=16000,
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
                {"type": "text", "text": PROMPT.format(tickers=", ".join(tickers) or "пока нет", today=today)},
            ]}],
            output_format=Draft,
        )
    except anthropic.AuthenticationError:
        raise ScanError(503, "Распознавание не настроено: нет ключа доступа к Claude")
    except anthropic.RateLimitError:
        raise ScanError(429, "Слишком много запросов на распознавание — попробуйте через минуту")
    except anthropic.APIStatusError as e:
        raise ScanError(502, f"Сервис распознавания ответил ошибкой {e.status_code}")
    except anthropic.APIConnectionError:
        raise ScanError(502, "Нет связи с сервисом распознавания")
    except TypeError:                          # клиент не нашёл ни ключа, ни профиля входа
        raise ScanError(503, "Распознавание не настроено: нет ключа доступа к Claude")
    if resp.stop_reason == "refusal":
        raise ScanError(422, "Не удалось прочитать эту картинку — введите сделку вручную")
    d = resp.parsed_output
    if d is None:
        raise ScanError(422, "Не удалось разобрать картинку — введите сделку вручную")
    out = d.model_dump()
    # дополняем только простой арифметикой из уже прочитанных чисел и помечаем, что поле посчитано, а не прочитано
    out["computed"] = []
    if out["amount_usd"] is None and out["quantity"] and out["price"]:
        out["amount_usd"] = round(out["quantity"] * out["price"], 2)
        out["computed"].append("amount_usd")
    if out["quantity"] is None and out["amount_usd"] and out["price"]:
        out["quantity"] = out["amount_usd"] / out["price"]
        out["computed"].append("quantity")
    if out["price"] is None and out["amount_usd"] and out["quantity"]:
        out["price"] = out["amount_usd"] / out["quantity"]
        out["computed"].append("price")
    if out["symbol"] not in tickers:
        out["symbol"] = None
    return out
