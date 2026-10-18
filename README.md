# Reddit → Instagram Memes

A small admin tool that collects memes, lets you review them on a dashboard, and posts the ones you approve to an Instagram account automatically at scheduled times.

```
 Reddit (scrape)  ┐
                  ├─►  Review queue  ─►  Approve  ─►  Schedule  ─►  Auto-post to Instagram
 Your own uploads ┘     (dashboard)                  (daily slots)    (every 5 min check)
```

It is built for **one admin and one Instagram account**.

## Contents

1. [What it does](#what-it-does)
2. [How it works](#how-it-works)
3. [Tech stack](#tech-stack)
4. [Prerequisites](#prerequisites)
5. [Quick start (local, about 10 minutes)](#quick-start-local-about-10-minutes)
6. [Configuration reference](#configuration-reference)
7. [Connecting the external services](#connecting-the-external-services)
8. [Using the app](#using-the-app)
9. [Scripts](#scripts)
10. [Testing](#testing)
11. [Project structure](#project-structure)
12. [Database and migrations](#database-and-migrations)
13. [Deploying](#deploying)
14. [Logging and debugging](#logging-and-debugging)
15. [Security notes](#security-notes)
16. [Troubleshooting](#troubleshooting)
17. [Contributing](#contributing)
18. [Status and roadmap](#status-and-roadmap)

---

## What it does

- **Scrapes** image memes from subreddits you choose (static JPEG/PNG/WebP only; NSFW, video, gallery, GIF and pinned posts are skipped; duplicates are detected by Reddit id and by image content).
- **Lets you upload your own** memes (JPEG/PNG/WebP, up to 4 MB). Uploaded memes skip review and go straight to *Approved*.
- **Review dashboard** with New / Approved / Rejected / Posted tabs, search, paging, and Approve / Reject buttons (each action has an Undo toast). Review from the keyboard: **J/K** or the arrow keys move, **A** approves, **R** rejects, **B** moves back to New, **X** selects, **V** opens a large view (with ←/→ to browse); select several (click the checkbox, Shift+click for a range) and approve or reject them in one go.
- **Scheduling** into daily time slots (default 09:00, 14:00, 20:00 in your timezone), either by clicking *Schedule*, or automatically when you approve a meme.
- **Publishes to Instagram** through the official Instagram API, at the scheduled time (checked every 5 minutes), or immediately with *Publish now*.
- **Edit before posting:** change a caption or the scheduled time, or unschedule.
- **Instagram preview:** see the exact image and caption that will be sent (with size, character and hashtag counts, and warnings for anything Instagram would reject) before it goes out. Open it from a post's ⋯ menu on the Schedule page (Edit → Preview tab) or the **Preview** button on Approved memes.
- **Safety nets:** never posts the same meme twice, never posts one that is more than 6 hours late, flags posts that got stuck, and shows alerts for anything needing attention.
- **Activity log** page recording what the app did (posted, failed, scraped, logins...) for 90 days.
- **Password-protected** dashboard.

## How it works

**Pages** (all behind the login)

| Page | Purpose |
|---|---|
| `/` Memes (dashboard) | Review memes, search, scrape, upload, schedule |
| `/schedule` | Upcoming and past posts, edit, publish now, retry |
| `/activity` | Event log (filter to warnings and errors) |
| `/settings` | Instagram connection, subreddits, post times, timezone, automation switches |

**Background jobs** (run by [Inngest](https://www.inngest.com), served from `/api/inngest`)

| Job | When | What it does |
|---|---|---|
| `publish-due-posts` | every 5 minutes | Publishes the next due post (max one per run, so catch-up posts are spaced out). Marks posts more than 6 h late as *failed* instead of posting them late. Marks posts stuck in *publishing* for more than 15 min as *failed*. |
| `scrape-memes-daily` | daily 06:00 UTC | Fetches new memes into the review queue (can be switched off in Settings) |
| `refresh-instagram-token` | daily 03:00 UTC | Renews the Instagram token when fewer than 15 days remain |
| `cleanup-rejected-images` | daily 03:30 UTC | Deletes Cloudinary images of memes rejected over 14 days ago, and prunes activity entries older than 90 days |

**Publishing flow:** the image is stored in Cloudinary; Instagram is given a public JPEG URL (a 4:5, 1080 px-wide version made by Cloudinary); the app creates a media container, waits until Instagram has processed it, then publishes. A post is claimed with an atomic database update first, so two jobs can never publish the same meme. A failed publish is **never retried automatically** (if Instagram accepted the post but the reply was lost, a retry would post twice); click *Retry* instead.

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, Cache Components), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui |
| Database | PostgreSQL with Drizzle ORM. Neon in production, a Docker container locally |
| Images | Cloudinary |
| Jobs | Inngest |
| Instagram | Instagram API with Instagram Login (no Facebook Page needed) |
| Logging | Pino |
| Tests | Vitest, with an in-memory Postgres (PGlite) for database tests |
| Hosting | Vercel |

## Prerequisites

| You need | Why |
|---|---|
| **Node.js 22.12 or newer** and **npm** | Runtime and package manager (the project uses npm; there is a `package-lock.json`) |
| **Docker** | Runs the local Postgres database |
| **Git** | |
| A **Cloudinary** account (free) | Image storage. Needed to upload or scrape memes |
| A **Meta developer** account, and an Instagram **Business or Creator** account | Posting to Instagram |
| A **Reddit API** app *(optional)* | Scraping. Reddit now vets new API access, so approval can be slow or refused. You can use *Add your own meme* instead |
| An **Inngest** account *(production only)* | Triggers the scheduled jobs in production. Locally you run a free dev server instead |
| **Neon** and **Vercel** accounts *(deployment only)* | See [Deploying](#deploying) |

## Quick start (local, about 10 minutes)

This gets the app running on your machine with **no external accounts**. You can browse the UI, change settings and run all the tests. Connecting Cloudinary, Instagram and so on comes later ([next section](#connecting-the-external-services)).

```bash
# 1. Get the code and install dependencies
git clone https://github.com/Adarsh-Raut/reddit-instagram.git
cd reddit-instagram
npm ci

# 2. Start the local database (Postgres 16 in Docker, on 127.0.0.1:5433)
docker compose up -d db

# 3. Create your local environment file
cp .env.example .env.local
```

Now edit `.env.local` and fill in these values:

```ini
# Matches docker-compose.yml
DATABASE_URL=postgres://reddit_ig:reddit_ig_dev@127.0.0.1:5433/reddit_instagram

# Encrypts the Instagram token stored in the database. Generate one:
#   openssl rand -base64 32
TOKEN_ENCRYPTION_KEY=<paste the generated value>

INNGEST_DEV=1
APP_URL=http://localhost:3000
```

Then:

```bash
# 4. Set the dashboard password (prompts twice, 12+ characters, nothing is echoed).
#    This writes ADMIN_PASSWORD_HASH and SESSION_SECRET into .env.local for you.
npm run admin:setup

# 5. Create the database tables
npm run db:push

# 6. Run the app
npm run dev
```

Open <http://localhost:3000> and sign in with the password from step 4.

> **If you skip step 4 the app stays locked.** Every page redirects to the login page and login is refused. That is intentional: without a password configured, nothing is reachable.

Without any external service you can already: open the dashboard, change Settings (timezone, post times, automation), and run `npm test`. To **upload a meme** you need Cloudinary; to **post** you also need Instagram.

## Configuration reference

All configuration lives in environment variables. Locally use `.env.local` (never committed); in production set them in Vercel. `.env.example` is the template.

| Variable | Required for | Description |
|---|---|---|
| `DATABASE_URL` | everything | Postgres connection string. Local Docker URL above; production uses a Neon URL (hosts ending in `.neon.tech` automatically use Neon's serverless driver) |
| `TOKEN_ENCRYPTION_KEY` | Instagram | 32 random bytes, base64. `openssl rand -base64 32`. Losing it means reconnecting Instagram |
| `ADMIN_PASSWORD_HASH` | login | Written by `npm run admin:setup` (scrypt hash, never the password) |
| `SESSION_SECRET` | login | Written by `npm run admin:setup`. Signs the login cookie |
| `APP_URL` | Instagram | Public base URL of the app. The OAuth redirect is `APP_URL/api/instagram/callback`. Must be `https` for Instagram |
| `INSTAGRAM_APP_ID` | Instagram | **Instagram** app ID from the Meta dashboard (not the Meta app ID) |
| `INSTAGRAM_APP_SECRET` | Instagram | Instagram app secret, same page |
| `INSTAGRAM_API_VERSION` | optional | e.g. `v23.0`. Empty uses the app's default |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | uploads, scraping, posting | From the Cloudinary dashboard |
| `REDDIT_CLIENT_ID` / `_CLIENT_SECRET` / `_USER_AGENT` | scraping only | From a Reddit "script" app |
| `INNGEST_DEV` | local jobs | Set to `1` locally. **Do not set in production** |
| `INNGEST_SIGNING_KEY` / `INNGEST_EVENT_KEY` | production jobs | From Inngest Cloud (or added by its Vercel integration) |
| `LOG_LEVEL` | optional | `debug`, `info`, `warn`, `error` or `silent`. Default: `debug` in dev, `info` in production |

Each integration only checks its own variables, so, for example, uploading works without any Reddit settings.

## Connecting the external services

Do these in any order; each unlocks one capability.

### 1. Cloudinary (image storage)

1. Create a free account at [cloudinary.com](https://cloudinary.com).
2. Open the dashboard → **API Keys** and copy the cloud name, API key and API secret.
3. Put them in `.env.local` as `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, then restart `npm run dev`.
4. Test it: Dashboard → **Add your own meme**. The image should appear under *Approved*.

### 2. Instagram (posting)

**Instagram account:** it must be a **Business or Creator** account and **public**. In the Instagram app: Settings → Account type and tools → Switch to professional account. For testing, use a throwaway account, because posts are public.

**Meta app:**

1. Go to [developers.facebook.com](https://developers.facebook.com), register as a developer, and click **Create app**.
2. Choose the use case **"Manage messaging and content on Instagram"** (app type *Business*).
3. Open **Use cases → Customize**. Under permissions, make sure **`instagram_business_basic`** and **`instagram_business_content_publish`** are both added.
4. Step "Generate access tokens": assign your Instagram account the **Instagram Tester** role (**App roles → Roles**), then accept the invitation in the Instagram app (Settings → Apps and websites → Tester invitations). While the app is in development mode only accounts with a role can log in.
5. Step "Set up Instagram business login": click **Set up** and add the redirect URI (see the HTTPS note below):
   ```
   https://<your-domain>/api/instagram/callback
   ```
   It must match exactly (no trailing slash).
6. On the same page copy the **Instagram App ID** and **Instagram App secret** into `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`. These are *not* the values under App settings → Basic.
7. Set `APP_URL` to `https://<your-domain>`.
8. In the app: **Settings → Connect Instagram**, log in as the tester account and approve. The card should show `@yourusername`.

> **HTTPS is required.** Meta rejects `http://localhost` redirect URIs ("Error saving redirect URIs"). So Instagram can only be connected from a deployed site ([Deploying](#deploying)) or through an HTTPS tunnel. For a tunnel, run for example `cloudflared tunnel --url http://localhost:3000` (or `ngrok http 3000`), set `APP_URL` to the `https://…` address it prints, restart `npm run dev` (the dev server needs to allow that host; it reads it from `APP_URL`), register that callback URL in Meta, and **open the app through the tunnel address for the whole session** (login cookies are per host). Quick tunnels change address on every restart, so the Meta redirect URI and `APP_URL` must be updated each time. A deployed site avoids all of that.

Tokens last about 60 days. A daily job renews them; if one ever expires you simply press **Reconnect**.

### 3. Reddit (scraping, optional)

1. Go to <https://www.reddit.com/prefs/apps> and create an app of type **script**.
2. Copy the client id (under the app name) and the secret into `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`.
3. Set `REDDIT_USER_AGENT` to something identifying, e.g. `web:reddit-instagram:v0.1 (by /u/yourname)`.
4. Dashboard → **Scrape now**.

Reddit now reviews API access for new apps, so this can take time or be refused. Everything else works without it; use *Add your own meme*.

### 4. Inngest (running the scheduled jobs)

**Locally**, jobs don't run on their own; start Inngest's free dev server:

```bash
# terminal 1
npm run dev                                   # with INNGEST_DEV=1 in .env.local

# terminal 2
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest

# if the functions don't show up in http://localhost:8288:
curl -X PUT http://localhost:3000/api/inngest
```

Open <http://localhost:8288> to see runs, and invoke functions by hand.

**In production**, connect Inngest Cloud; see [docs/DEPLOY.md](docs/DEPLOY.md).

## Using the app

First-run walkthrough once the services are connected:

1. **Settings:** set your **timezone** (default is UTC), post times (default `09:00, 14:00, 20:00`) and subreddits. Decide whether to tick *Schedule memes automatically when I approve them*.
2. **Get memes:** Dashboard → **Scrape now**, or **Add your own meme** (image + title; the title becomes the caption).
3. **Review:** *Approve* or *Reject* each meme in the **New** tab.
4. **Schedule:** *Approved* tab → **Schedule N approved** (each gets the next free time slot), unless auto-schedule is on.
5. **Check:** the **Schedule** page lists what will go out and when. Click a post's title (or ⋯ → **Edit caption or time**) to change its caption (add your own hashtags) or time, ⋯ → **Remove from schedule** to unschedule it, or **Publish now** (after a confirmation) to post immediately.
6. **Sit back:** the 5-minute job posts each meme at its time (up to 5 minutes late is normal).
7. **Watch:** the **Activity** page and the alerts banner show failures, an expiring token, or a nearly empty queue.

Captions: scraped memes get `<title>` plus a credit line (`Credit: u/author on Reddit (r/sub)`); uploaded memes get just their title. A caption you edit is used as-is.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` / `npm start` | Production build / run it |
| `npm test` | Run all tests (no external services needed) |
| `npm run typecheck` | Generate Next route types, then TypeScript check |
| `npm run lint` | ESLint |
| `npm run admin:setup` | Set the dashboard password (writes to `.env.local`) |
| `npm run db:push` | Sync the schema to your **local** database (development shortcut) |
| `npm run db:generate` | Create a new migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (use this for Neon/production) |
| `npm run db:studio` | Browse the database in a web UI |
| `docker compose up -d db` | Start the local database |
| `docker compose down` | Stop it (data is kept in a Docker volume) |

## Testing

```bash
npm test
```

Runs about 190 tests in a few seconds with **no accounts, no network and no Docker**: database tests use an in-memory Postgres (PGlite) with the real migrations, and Reddit, Cloudinary and Instagram are mocked.

Before committing, also run `npm run typecheck && npm run lint`, and `npm run build` for larger changes.

**Never post to a real Instagram account from tests or scripts.** Only a human click on *Publish now*, or a scheduled post, posts for real.

## Project structure

```
src/
  app/
    (app)/             Memes (/), /schedule, /activity, /settings (sidebar shell + alerts)
    login/             Sign-in page
    actions/           Server actions (all call requireAdmin first)
    api/inngest/       Inngest endpoint (the scheduled jobs)
    api/instagram/     OAuth connect + callback
  components/          UI components; ui/ holds the design-system primitives (button, sheet, tooltip, field...)
  db/                  schema.ts, queries.ts (all database access), tests
  inngest/             Job functions (functions.ts), job logic (jobs.ts), tests
  lib/
    auth/              Password hashing, signed sessions, login throttling
    instagram/         API client, publishing service, config
    reddit/            Reddit client, scraping service
    schedule/          Slot assignment (timezone/DST aware), scheduling service
    memes/             Admin-uploaded memes
    activity.ts        recordActivity(): logs and stores business events
    log.ts             Pino logger with secret redaction
    cloudinary.ts, crypto.ts, env.ts, alerts.ts, settings.ts
  proxy.ts             Sends logged-out visitors to /login
drizzle/               SQL migrations
scripts/               admin-setup.mjs
docs/                  PROGRESS.md (status log), DEPLOY.md (Vercel checklist)
docker-compose.yml     Local Postgres
```

Pure logic (slot assignment, scraping, publishing, jobs) takes its dependencies as parameters, which is why it is easy to test without real services.

## Database and migrations

- **Locally:** `npm run db:push` syncs `src/db/schema.ts` straight to your Docker database. Quick, no migration files.
- **Changing the schema:** edit `src/db/schema.ts`, run `npm run db:generate` (creates a new file in `drizzle/`), commit it, then apply it with `db:push` locally and `db:migrate` in production.
- **Production (Neon):**
  ```bash
  DATABASE_URL='<neon connection string>' npm run db:migrate
  ```
  The inline value overrides `.env.local`, so your local database is untouched.
- **Never regenerate or edit existing migration files.** Only add new ones.
- **Reset local data:** `docker compose down -v` deletes the volume; then repeat `up -d db` and `db:push`.

## Deploying

The app is designed for **Vercel + Neon + Inngest Cloud**. The full, ordered checklist (database, secrets, importing the repo, environment variables, Inngest, Meta redirect URI, smoke test) is in **[docs/DEPLOY.md](docs/DEPLOY.md)**.

Things that are different in production:
- Uploads are capped at **4 MB** (Vercel rejects larger request bodies).
- Functions are given up to 60 s (publishing can take about 30 s).
- Do not set `INNGEST_DEV`; set the two Inngest keys instead.
- `APP_URL` must be the public `https` address, and the same callback URL must be registered in Meta.
- Every push to `main` redeploys automatically once the repo is connected to Vercel.

## Logging and debugging

- **Terminal (dev):** readable colored logs. `LOG_LEVEL=debug` also shows each Instagram API response and each publish step.
- **Production:** JSON log lines, searchable in Vercel (e.g. `"kind":"publish.failed"`). Vercel keeps logs only briefly on the free plan.
- **Activity page:** the permanent record of important events, with a *Details* section per entry. Start here when something goes wrong.
- **Inngest dashboard:** every job run, its output and retries.
- Secrets (tokens, passwords, cookies) are redacted from logs automatically.

## Security notes

- The whole app is behind a single admin password (scrypt hash) and a signed 7-day cookie. A failed-login limiter helps against guessing. Use a long password, especially in production.
- **Every server action, route handler and data-loading component must call `await requireAdmin()` first.** `src/proxy.ts` is only a first gate. See `src/lib/auth/session.ts`.
- The Instagram token is stored **encrypted** (AES-256-GCM) in the database.
- **Never commit `.env.local`.** It is git-ignored; only `.env.example` (no values) is tracked.
- Only `/login` and `/api/inngest` (which Inngest signs) are public.
- Posting reposts other people's content. Captions credit the original poster, and you should expect that Instagram or a rights holder may still object. Keeping the human approval step is deliberate.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Every page redirects to `/login`, or login says it isn't set up | `ADMIN_PASSWORD_HASH` / `SESSION_SECRET` missing. Run `npm run admin:setup` and restart the server (on Vercel: add both and redeploy) |
| "Couldn't load posts" | `DATABASE_URL` wrong, the database isn't running (`docker compose up -d db`), or tables not created (`npm run db:push`) |
| Upload says Cloudinary isn't configured | The three `CLOUDINARY_*` variables are missing. Restart `npm run dev` after editing `.env.local` |
| Scrape fails immediately | Reddit variables missing, or Reddit hasn't approved API access |
| Meta says "Error saving redirect URIs" | You used `http://localhost`. Use an `https` address |
| Connect Instagram returns `bad-state` | Open the app through the **same** `APP_URL` address for the whole flow |
| Instagram login says the account isn't allowed | The account isn't an accepted **Instagram Tester**, isn't Business/Creator, or isn't public |
| Publishing fails | Open **Activity → Details** for Instagram's exact message. Common causes: missing `instagram_business_content_publish` permission, expired token (press Reconnect), or an image Instagram rejects |
| Nothing posts automatically | Jobs aren't running: locally start the Inngest dev server; in production check the app is synced in Inngest Cloud and shows 4 functions. Also check the post isn't more than 6 h past its time (it becomes *failed*; use Retry) |
| `/api/inngest` returns 500 in production | `INNGEST_SIGNING_KEY` isn't set (this is the safe default) |
| Port 5433 already in use | Another database is using it. Change the port in `docker-compose.yml` and `DATABASE_URL` |
| Tests fail on a fresh clone | Use Node 22.12+ and run `npm ci` |

## Contributing

- Use **npm**, not pnpm or yarn.
- Keep changes small, add or update tests for new logic, and make sure `npm test`, `npm run typecheck` and `npm run lint` pass before committing.
- Use the logger (`getLogger("name")` from `src/lib/log.ts`), never `console.*`; record user-relevant events with `recordActivity`.
- Next.js 16 differs from older versions. Read `node_modules/next/dist/docs/` before using an unfamiliar API (see `AGENTS.md`). Components that read cookies, the current time or the database must sit inside `<Suspense>`.
- `CLAUDE.md` holds conventions for AI coding assistants; `docs/PROGRESS.md` is the running status log. Keep both current.

## Status and roadmap

**Verified end to end in production:** upload, approve, schedule, Instagram connect, *Publish now*, and automatic publishing through Inngest.

**Not yet verified against the real services:** Reddit scraping (needs Reddit API access), the daily token refresh, the image cleanup job, and real-world failure cases such as an expired token.

**Not built (ideas):** AI-generated captions and hashtags, video memes / Reels, email or push alerts, multiple Instagram accounts, post analytics.
