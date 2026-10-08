import hashlib, hmac, time
from typing import Mapping
def verify_telegram_login(data: Mapping[str, str], bot_token: str, max_age: int = 86400) -> bool:
    received, auth_date = data.get("hash"), data.get("auth_date")
    if not received or not auth_date: return False
    try:
        if time.time() - int(auth_date) > max_age: return False
    except (TypeError, ValueError): return False
    check = "\n".join(f"{k}={data[k]}" for k in sorted(data) if k != "hash")
    return hmac.compare_digest(hmac.new(hashlib.sha256(bot_token.encode()).digest(), check.encode(), hashlib.sha256).hexdigest(), received)
