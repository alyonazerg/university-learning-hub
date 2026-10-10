# Beget API deployment while keeping the frontend on Pages

Beget offers a VPS image with Docker and Docker Compose already installed:
https://beget.com/ru/cloud/marketplace/docker
The application is prepared for a VPS/cloud server with Docker, not for uploading
the Python backend as files to a shared website hosting directory.

This document does not purchase a server, change DNS, configure credentials or
deploy to Beget. Before those actions, identify the actual hosting service and
arrange server access. The existing mooncampus.ru site can stay where it is.
Use a separate API subdomain (for example api.mooncampus.ru), or a dedicated test
subdomain, and keep the frontend at the existing Pages preview during testing.

## Server setup

1. Obtain a VPS/cloud server with Docker and Compose. For an initial small pilot,
   2 CPU cores and 2 GiB RAM are a starting estimate, not a load-test guarantee.
   Photo usage determines storage requirements; monitor usage and keep backups.
2. Clone the repository and check out the current sprint-2-registration branch.
3. Copy `.env.example` to `.env` privately on the server. Set a strong database
   password in both POSTGRES_PASSWORD and DATABASE_URL; URL-encode special
   characters in the URL. Generate an independent ADMIN_TOKEN, set
   TELEGRAM_BOT_TOKEN when the project bot exists, and set APP_ENV=production.
   Add API_DOMAIN with the chosen API hostname. Do not upload this file to GitHub.
4. Set CORS_ORIGINS to `["https://alyonazerg.github.io"]` for the current Pages
   frontend. Add other exact frontend origins only if they are actually used.
5. Point only the chosen API/test subdomain's A record to the server IPv4.
   Configure AAAA only if the server really supports that address. Allow inbound
   ports 80 and 443 and retain controlled SSH access. PostgreSQL has no published
   port; the development API/frontend ports bind only to loopback.
6. Check configuration without displaying secret values, then launch:

   ```sh
   docker compose -f docker-compose.yml -f compose.beget.yml config --quiet
   docker compose -f docker-compose.yml -f compose.beget.yml up -d --build
   ```

   Caddy obtains HTTPS certificates for API_DOMAIN. API startup applies Alembic
   migrations; its database persists in the pgdata volume. Caddy certificate
   state persists in separate volumes. Do not use `down --volumes` on a server
   holding records. The optional Docker build secret `proxy_ca` is only for build
   environments with a custom CA; ordinary Beget builds do not need it.

## Connecting Pages

Confirm that the API health URL returns the expected response over trusted HTTPS.
In GitHub repository Settings → Secrets and variables → Actions → Variables,
set MOON_CAMPUS_API_BASE to the API's HTTPS origin, with no path or credentials.
The Pages workflow writes this public address to config.js. Trigger the existing
Publish frontend preview workflow for sprint-2-registration. An empty variable
keeps connected login disabled; malformed/insecure values fail the build.

Sign into the teacher cabinet with the privately configured ADMIN_TOKEN. Do not
place it in a repository variable, config.js, URL or chat. Use synthetic groups
and accounts first. The project bot and its server-side token are still required
for student Telegram authentication and registration. Without a bot, teachers
can test their own cabinet but students cannot log in.

## Checks before real student use

Verify login, group isolation, submission attempts, certificate revocation and
private attendance using the actual HTTPS address. Restart services and confirm
records survive. Configure login rate limiting at the gateway, monitoring,
database/photo backups and a tested restore process. Caddy's example here adds
HTTPS and a request size cap; it does not implement login rate limiting itself.
Medical certificates and legal names are not required by the coursework or
attendance forms. Photos are presently stored with submissions in the database;
include them in backups and plan private object storage as volume grows.

The main domain and frontend do not need to move for this deployment. Switching
mooncampus.ru to a new frontend is a separate later action.
