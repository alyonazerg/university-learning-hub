# Telegram bot

No live bot/runtime is configured yet. `contracts.py` provides offline contracts
for opt-in audience-filtered notifications and private text/photo homework,
without API calls or token handling. Run `python -m unittest bot.test_contracts`
from the repository root. These contracts do not save submissions or deliver
messages. See [hosting and integration requirements](../docs/hosting-and-telegram.md).
