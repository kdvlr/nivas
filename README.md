# Family Dashboard Hub

A wall-mounted family command center, responsive from a 21" 1920×1080 tablet down to an iPad or a Mac window. Two switchable themes (Material 3 Expressive and Liquid Glass), light/dark/auto modes, five selectable fonts, and your family name on the Home screen (set it in Setup):

- **📅 Calendar** — everyone's Google calendars, one color per person, weekly grid with touch drag-and-drop editing and per-day weather (sunny/cloudy/rainy) in the headers
- **⭐ Chores** — in-app chores with coin rewards, per-person assignment, daily/weekly recurrence, and missed-chore penalties
- **✅ To-Dos** — Apple Reminders (iCloud CloudKit) + Alexa to-dos merged into daily/weekly views
- **🎉 Celebrations** — completing anything fires a random fullscreen animation (confetti · fireworks · rocket · flowers · pixie sparkle · unicorn rainbow · superhero · bubbles)
- **🏪 Rewards store** — kids spend earned coins; redemptions play their own animations (fairy wish · treasure chest · sweet treats · puppy party · race car victory lap)
- **🛒 Shopping** — Apple Reminders "Shopping" list + Alexa shopping list, deduped into one list; checking off writes back to both
- **🍽️ Meal plan** — breakfast/lunch/dinner for the week, each linkable to a recipe
- **📖 Recipes** — paste any recipe URL; the built-in scraper (or Gemini, for unsupported sites) standardizes it into a kitchen-friendly card with a step-by-step cook mode; while cooking, say **"next" / "previous" / "exit"** to flip steps hands-free (Web Speech API — allow mic access in the kiosk browser)
- **🔒 Setup PIN** — set `SETUP_PIN` in `.env` to keep kids out of the Setup tab; forgot it? edit `.env` and restart
- **🎨 Shared colors** — each family member has one color (Setup → Family members); assign calendars to a person and their events, chores, and coins all match
- **🌤️ Weather** — current conditions on the Home header + 7-day forecast, via Open-Meteo (free, no key; set coordinates in Setup)

The tablet only runs a fullscreen browser. The app itself (FastAPI + React) runs on any always-on box on your LAN via Docker.

## Quick start (server)

```bash
cp .env.example .env        # fill in what you have; everything is optional
docker compose up -d --build
```

Open `http://<server-ip>:8080` → **Setup** tab.

### Google Calendar

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project → enable the **Google Calendar API**.
2. *APIs & Services → OAuth consent screen*: External, add your family's emails as test users.
3. *Credentials → Create credentials → OAuth client ID → Web application*; add redirect URI
   `http://<server-ip>:8080/api/calendar/auth/callback` (must match `BASE_URL` in `.env`).
4. Download the JSON into the docker volume:
   `docker compose cp client_secret.json dashboard:/data/credentials/google_client_secret.json`
5. Setup tab → **Connect a Google account** for each family member (or one account with shared calendars). Pick each calendar's person + color.

### Apple Reminders (iCloud)

Set `ICLOUD_USERNAME` / `ICLOUD_PASSWORD` in `.env` (or type them in Setup), press **Sign in to iCloud**, and enter the 2FA code when your Apple device shows one. The session is saved, so this is rare afterwards. Then choose which Reminders list is the shopping list and which lists are chores.

### Alexa lists

Set `AMAZON_EMAIL`, `AMAZON_PASSWORD`, and ideally `AMAZON_OTP_SECRET` (the code Amazon shows when you add an "authenticator app" to your account — this lets the dashboard pass 2FA automatically). Press **Connect Alexa** in Setup.

> ⚠️ Both the iCloud Reminders and Alexa integrations use unofficial/private APIs (pyicloud / alexapy). Apple or Amazon can break them at any time; when that happens the rest of the dashboard keeps working and the Setup tab shows what's failing.

### Recipe AI

Set `GEMINI_API_KEY` (from [Google AI Studio](https://aistudio.google.com/apikey)) and optionally `GEMINI_MODEL` in `.env`. Supported recipe sites are parsed locally for free; Gemini handles everything else.

## Tablet kiosk setup

1. Install **Fully Kiosk Browser** (recommended) on the tablet.
2. Start URL: `http://<server-ip>:8080`.
3. Enable fullscreen/kiosk mode, screen always on, and "reload on network reconnect".

The UI auto-returns to the Home screen after 5 minutes of inactivity.

## Development

```bash
# backend (http://localhost:8000)
cd backend && uv venv --python 3.12 && uv pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --reload

# frontend dev server with API proxy (http://localhost:5173)
cd frontend && npm install && npm run dev

# tests
cd backend && .venv/bin/python -m pytest
```

`npm run build` outputs into `backend/static/`, which the backend serves directly — that's all Docker does too.

## Architecture

```
Android tablet (Fully Kiosk, 1920×1080)
        │ http
┌───────▼──────────────────────────────┐
│ FastAPI  (backend/app)               │
│  • REST + WebSocket push             │
│  • APScheduler: google 2m,           │
│    icloud 3m, alexa 5m               │
│  • SQLite in /data                   │
├──────────────────────────────────────┤
│ integrations/                        │
│  google_calendar (official OAuth)    │
│  icloud_reminders (pyicloud, private)│
│  alexa_lists (alexapy, private)      │
│  recipe_ai (recipe-scrapers → Gemini)│
└──────────────────────────────────────┘
```

Sync is snapshot-based: each source's current items are reconciled into local tables (`services/merge.py`), dashboard actions write back to the owning source(s), and the UI refreshes over WebSocket.

## License & bundled assets

Code is MIT licensed (see [LICENSE](LICENSE)). Bundled assets:

- [Material Symbols Rounded](https://fonts.google.com/icons) — Apache 2.0
- [Outfit](https://fonts.google.com/specimen/Outfit), [Nunito](https://fonts.google.com/specimen/Nunito), [Quicksand](https://fonts.google.com/specimen/Quicksand) — SIL Open Font License
- [Roboto](https://fonts.google.com/specimen/Roboto) — Apache 2.0
