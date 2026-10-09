import hashlib
import hmac
import json
import time
from typing import Mapping
from urllib.parse import parse_qsl


def valid_auth_date(value: str, max_age: int) -> bool:
    try:
        age = time.time() - int(value)
        return 0 <= age <= max_age
    except (TypeError, ValueError):
        return False


def verify_telegram_login(data: Mapping[str, str], bot_token: str, max_age: int = 300) -> bool:
    if not data.get('hash') or not valid_auth_date(data.get('auth_date', ''), max_age):
        return False
    check = '\n'.join(f'{k}={data[k]}' for k in sorted(data) if k != 'hash')
    digest = hmac.new(hashlib.sha256(bot_token.encode()).digest(), check.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, data['hash'])


def telegram_user_id(telegram_data: Mapping[str, str], init_data: str, bot_token: str) -> int | None:
    try:
        if init_data:
            if telegram_data:
                return None
            pairs = parse_qsl(init_data, strict_parsing=True)
            data = dict(pairs)
            if len(pairs) != len(data) or not valid_auth_date(data.get('auth_date', ''), 300):
                return None
            received = data.pop('hash', '')
            check = '\n'.join(f'{k}={data[k]}' for k in sorted(data))
            secret = hmac.new(b'WebAppData', bot_token.encode(), hashlib.sha256).digest()
            expected = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(expected, received):
                return None
            user_id = json.loads(data['user'])['id']
        else:
            if not verify_telegram_login(telegram_data, bot_token):
                return None
            user_id = int(telegram_data['id'])
        if isinstance(user_id, bool) or not isinstance(user_id, int):
            return None
        return user_id if 0 < user_id <= 9223372036854775807 else None
    except (ValueError, KeyError, TypeError):
        return None
