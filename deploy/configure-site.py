"""Add the frontend origin to the private server .env without displaying secrets."""
import json
from pathlib import Path

path = Path('.env')
lines = path.read_text().splitlines()
indexes = [i for i, line in enumerate(lines) if line.startswith('CORS_ORIGINS=')]
origins = []
if indexes:
    raw = lines[indexes[-1]].split('=', 1)[1].strip()
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "\"'":
        raw = raw[1:-1]
    origins = json.loads(raw)
if not isinstance(origins, list) or not all(isinstance(item, str) for item in origins):
    raise SystemExit('CORS_ORIGINS must be a JSON array; no changes made.')
if 'https://mooncampus.ru' not in origins:
    origins.append('https://mooncampus.ru')
replacement = 'CORS_ORIGINS=' + json.dumps(origins, separators=(',', ':'))
lines = [line for i, line in enumerate(lines) if i not in indexes]
lines.append(replacement)
path.write_text('\n'.join(lines) + '\n')
print('mooncampus.ru enabled. Existing settings preserved.')
