# Progress log: Reddit → Instagram meme automation

Last updated: 2026-10-16. Read this first when you come back to the project.

## Where things stand

**All planned coding is done and covered by automated tests (156 tests, lint, typecheck and production build pass).**
What has *not* happened yet is a run against the real services. Everything external (Reddit, Cloudinary,
Instagram) has only been exercised with mocks, and the database with a local Docker Postgres.

Nothing has been pushed to GitHub. There is no remote yet. Everything is committed locally.

### What's built

| Area | What it does |
|---|---|
| Scraper | Pulls image memes from chosen subreddits (Reddit OAuth), filters out NSFW/video/gallery/GIF/stickied, skips duplicates (Reddit id + SHA-256 of the image bytes), uploads to Cloudinary |
| Dashboard `/` | Tabs New / Approved / Rejected / Posted with counts, 24 per page, Approve / Reject / Move back, "Scrape now" |
| Scheduling | Next free daily slots (default 09:00, 14:00, 20:00), timezone and DST aware, never double-booked. "Schedule N approved" button, or automatic on approval (setting) |
| `/schedule` | Posts grouped by day with status, Unschedule, Publish now / Retry, edit caption and time |
| `/settings` | Subreddits, memes per scrape, post times, timezone, automation switches, Instagram connection card |
| Instagram | OAuth (Instagram Login API, no Facebook Page needed), encrypted token, container → poll → publish, credit caption by default |
| Auto-publish | Inngest cron every 5 min: publishes the next due post (max one per run) |
| Auto-scrape | Inngest cron daily 06:00 UTC (switchable) |
| Token refresh | Inngest cron daily 03:00 UTC, refreshes when under 15 days left |
| Cleanup | Inngest cron daily: deletes Cloudinary images of memes rejected >14 days ago (rows stay, so no re-scrape) |
| Safety nets | Atomic claim so a post can't be published twice; posts >6h late are marked failed instead of posted late; posts stuck "publishing" >15 min are marked failed with a "check Instagram first" warning; failed posts are never auto-retried |
| Alerts banner | Failed posts, Instagram not connected / token expiring or expired, fewer than 2 days queued, approved-but-unscheduled |
| Login | Single admin password (scrypt hash) + signed 7-day cookie; every action, route and data component checks it |

### Deliberately NOT built
- **AI captions / hashtags** (you deferred it). The caption field and the edit form already exist, so it slots in: generate text, store in `scheduled_posts.caption`.
- **Video memes / Reels.** Only static images (JPEG/PNG/WebP from i.redd.it).
- **Email/push notifications.** Alerts are shown in the dashboard only.

## What you need to set up before testing

Status of `.env.local` as of the last check (names only):

| Variable | State | How to get it |
|---|---|---|
| `DATABASE_URL` | set (local Docker) | `docker compose up -d db`, then `npm run db:push` |
| `TOKEN_ENCRYPTION_KEY` | set | already generated |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | set | from Meta dashboard → Instagram → Business login settings |
| `APP_URL` | optional (defaults to `http://localhost:3000`) | |
| `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` | **missing** | run `npm run admin:setup` (prompts for a password, writes both) |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | **missing** | free Cloudinary account → dashboard |
| `REDDIT_CLIENT_ID/CLIENT_SECRET/USER_AGENT` | **missing** | https://www.reddit.com/prefs/apps → "script" app (Reddit now vets new API access, which can take a while) |

**Until `npm run admin:setup` is run, the app is locked: every page redirects to /login and login is refused.** That's intentional (fail closed).

Meta app checklist (still to finish in the Meta dashboard):
1. Use case "Manage messaging and content on Instagram" added to the app (done).
2. Add the permission **`instagram_business_content_publish`** (it was missing from the list).
3. Instagram account is Business/Creator, public, and added as an **Instagram Tester** (App roles → Roles); accept the invite in the Instagram app.
4. In "Set up Instagram business login", add the redirect URI `http://localhost:3000/api/instagram/callback`. If Meta rejects http://localhost, use an HTTPS tunnel and set `APP_URL` to it.

## First real test: checklist

Use a **throwaway Instagram account**; the post is public.

1. `docker compose up -d db` and `npm run db:push`
2. `npm run admin:setup`, then `npm run dev`, then sign in at http://localhost:3000
3. Settings → set your **timezone**, post times, subreddits
4. Dashboard → **Scrape now**. Expect memes with images. If it errors, read the message (Reddit/Cloudinary credentials are the usual cause)
5. Approve 3 memes → **Schedule** (or switch on auto-schedule first)
6. Settings → **Connect Instagram** → approve in the popup → card shows `@username`
7. Schedule page → **Publish now** on one post. Confirm it appears on Instagram. Watch for: image rejected (aspect ratio / format), caption wrong, token errors
8. Automatic publishing: run `INNGEST_DEV=1 npm run dev` plus `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`, sync with `curl -X PUT localhost:3000/api/inngest`, then schedule a post a few minutes ahead and watch it go out
9. Try the failure paths: disconnect Instagram and Publish now (expect a clear failure + Retry), edit a caption, move a time, unschedule

Things most likely to need a small fix on first contact with the real services:
- Instagram's image requirements (we send a padded 4:5, 1080px-wide JPEG from Cloudinary)
- Whether Meta accepts the `http://localhost` redirect URI
- Reddit returning 403/429 to the app (user agent / approval)
- The `INSTAGRAM_API_VERSION` env var is empty (uses the app default); set it if Meta complains

## Before deploying
1. Neon database; set `DATABASE_URL` (the driver switches to Neon automatically for `*.neon.tech`) and run migrations (`drizzle-kit migrate`; the local DB was created with `db:push`)
2. Vercel project with all env vars; `APP_URL` must be the HTTPS site URL, and that callback URL must be added in the Meta dashboard
3. Inngest Cloud: `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` (without them `/api/inngest` refuses to run in production, which is safe)
4. Run `npm run admin:setup` against the production env, or generate the hash locally and paste `ADMIN_PASSWORD_HASH` and `SESSION_SECRET` into the host's env
5. Create the GitHub repo and push **only when you say so**
6. Consider moving the Meta app out of development mode only if other people will connect accounts (needs App Review); not needed for your own account

## Design decisions worth remembering
- **One Instagram account, one admin.** Simple on purpose. Multi-user would need real accounts and per-user tokens.
- **Never auto-retry a failed publish.** If Instagram accepted the post but the response was lost, a retry would double-post. A human clicks Retry.
- **One post per 5-minute run.** After downtime, overdue posts trickle out instead of flooding the account.
- **Late posts are not published automatically** (more than 6h late become "failed: missed slot").
- **Rejected memes keep their DB row** after the image is deleted so they are never scraped again.
- **Tokens are AES-256-GCM encrypted** in the DB; losing `TOKEN_ENCRYPTION_KEY` means reconnecting Instagram.
- **Local Docker Postgres** is a dedicated container (`reddit_instagram_postgres`, port 5433). Don't touch the `atlas_*` / `sendify_*` containers or port 5432.
- Package manager is **npm** (the machine's pnpm/corepack is broken).
- The migration `drizzle/0000_*.sql` was regenerated several times during development because nothing had been deployed. From the first deployment on, add new migrations instead of regenerating.

## Handy commands
```
npm run dev | build | start
npm run typecheck | lint | test
npm run db:push | db:generate | db:studio
npm run admin:setup
docker compose up -d db
```

## Ideas for later
AI captions and hashtags, Reels/video, email or push alerts, multiple Instagram accounts, per-subreddit quality filters (min score), a preview of exactly what Instagram will receive, analytics on which memes perform.
