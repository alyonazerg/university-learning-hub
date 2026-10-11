# Student invitations for @mooncampusbot

Teacher: Groups → Invite a student → Create invitation. Each generated Telegram link registers one student, expires in seven days and is stored only as a hash. Generate a separate link for every student. Students cannot create invitations. Creating a link does not send any Telegram messages.

In @BotFather, open /mybots → @mooncampusbot → Bot Settings → Configure Mini App (Main Mini App). Enable/configure the main Mini App with:

https://alyonazerg.github.io/university-learning-hub/preview/index.html

Keep the menu button Open Campus pointed to learning.html for returning students. The main Mini App registration URL receives the invitation in signed Telegram start_param via links of the form https://t.me/mooncampusbot?startapp=TOKEN. A regular browser URL cannot substitute for opening the Mini App in Telegram. Do not paste the bot token into chat or frontend configuration.

Update the server to add the authenticated invitation endpoint:

```bash
cd /opt/moon-campus
git pull --ff-only
docker compose -f docker-compose.yml -f compose.beget.yml up -d --build
```

No database migration is required. Registration uses the existing reservation and invitation-consumption checks. After choosing an alias and creating the profile, Open learning hub opens learning.html inside the Telegram Mini App. Returning students use Open Campus in the bot menu.
