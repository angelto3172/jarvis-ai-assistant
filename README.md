# Jarvis: AI Productivity Assistant

Jarvis is a personal AI assistant that keeps school, content creation, and client work in one place. It pairs a web dashboard with a Telegram bot, so I can check my week, add tasks, and block time on my calendar just by chatting with it.

## What it does

- **Two-way AI chat on Telegram**: ask "what should I focus on today?" or "block 2 hours for my essay on Thursday" and Claude answers using live data from the app.
- **Tool use with Claude**: the assistant can list, add, and update school tasks, content posts, and client projects, read Google Calendar events, and create calendar time blocks.
- **Automated alerts**: a morning briefing, exam reminders 7, 3, and 1 days out, and a Sunday weekly-planning prompt.
- **Dashboard**: React views for school, content, agency projects, and weekly goals.
- **Google Calendar integration** through OAuth 2.0.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Docker), Drizzle ORM |
| AI | Anthropic Claude API (tool use) |
| Integrations | Google Calendar API (OAuth), Telegram Bot API |
| Scheduling | node-cron |

## Running it locally

Requirements: Node.js 20+ and Docker Desktop.

```bash
git clone <this repo>
cd <repo folder>
cp .env.example .env    # then fill in your own keys
./start.sh               # starts Postgres, installs deps, pushes the schema, runs both servers
```

- Frontend: http://localhost:5173
- Backend: http://127.0.0.1:3000

You'll need your own Anthropic API key, a Google Cloud OAuth client (redirect URI `http://localhost:3000/auth/callback`), and a Telegram bot token from BotFather.

## Security notes

- All secrets live in `.env`, which is git-ignored. `.env.example` lists the variable names with placeholder values only.
- The backend binds to `127.0.0.1` by default and Postgres is published only on localhost. The API has no login, so it's meant to run on your own machine, not on a public server.
- The Telegram bot only responds to the chat ID set in `TELEGRAM_CHAT_ID`.
