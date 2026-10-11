# mooncampus.ru on Beget

A records for mooncampus.ru and www.mooncampus.ru must point to 159.194.202.155. Keep api.mooncampus.ru on that VPS. Leave MX/TXT intact; remove conflicting AAAA records only after confirming they point elsewhere.

On the server in /opt/moon-campus:

```bash
git pull --ff-only
python3 deploy/configure-site.py
docker compose -f docker-compose.yml -f compose.beget.yml up -d --build
docker compose -f docker-compose.yml -f compose.beget.yml exec https caddy reload --config /etc/caddy/Caddyfile
```

Caddy serves frontend on mooncampus.ru, redirects www to the apex and retains the existing API domain. HTTPS certificates are managed by Caddy. Persistent database volumes remain intact. The configure script preserves secrets and existing CORS origins while adding https://mooncampus.ru. Explicit reload is required because changing a mounted Caddyfile does not necessarily recreate the container.

Verify https://mooncampus.ru/learning.html and https://api.mooncampus.ru/health before changing BotFather:
- Menu Button Open Campus: https://mooncampus.ru/learning.html
- Main App: https://mooncampus.ru/index.html

Existing Telegram invitations remain usable after changing Main App URL. Do not change the bot token or clear volumes. GitHub preview stays available during cutover.
