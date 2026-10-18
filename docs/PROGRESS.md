# Progress log: Reddit → Instagram meme automation

Last updated: 2026-10-19. Read this first when you come back to the project.

## Where things stand

**Decision 2026-10-19 (Reddit): staying on manual uploads.** `reddit.com/prefs/apps` is gone; new API access now needs approval under Reddit's Responsible Builder Policy, and personal scrapers may be refused. The `developers.reddit.com` "create a project / playtest" steps are for Devvit apps that run inside Reddit and give an external server no client id, so we are not using them. The scraper code stays in place, untested against real Reddit and switched off by missing credentials; revisit only if access is granted. Scrape-related items below ("Reddit scraping", daily auto-scrape) therefore stay unverified on purpose. Fallbacks if ever needed: a third-party Reddit data service, or scraping from a home IP (breaks Reddit's terms, fragile). Also: the repo now has a GitHub remote (`origin`, in sync with `main`), so older lines saying "no remote" are outdated.

**Update 2026-10-19 (month calendar).** Schedule now has List / Month views plus a per-day view. The month grid (Monday first, in the schedule's timezone) shows thumbnails ringed by status (dots on phones), highlights today, dims neighbouring months and marks planned days with fewer posts than daily post times ("2 of 3", "0 of 3") up to the last scheduled day. Past months stay browsable, which fixes posted history vanishing after 24 hours in the list view. New queries `listScheduleBetween` and `lastPendingAt`; invalid `?day=`/`?month=` values fall back safely. Verified in the browser at 1280 and 375px with a seeded month. 272 tests, lint, typecheck and build pass.

**Update 2026-10-19 (faster reviewing).** Memes board: J/K and arrow keys move a visible cursor, A/R/B approve, reject or move back, X selects, V opens a large view (arrows browse, A/R act from inside it). Checkboxes (Shift+click for a range) plus a sticky bulk bar approve or reject many at once, always with an Undo toast. Server side: `reviewPosts` (up to 100 memes, never touches posted ones). Verified in the browser at 1280 and 375px. 248 tests, lint, typecheck and build pass.

**Update 2026-10-19 (fewer queries).** Measured with Postgres statement logging on a scratch DB: every page ran about 10 SQL statements, 2 of them `INSERT INTO settings` (a write on every page view, because `getSettings()` always upserted). Now: **3-4 statements per page and no writes.** The alerts banner uses one aggregated query (`getAlertInputs`) instead of five, and `getSettings()` reads first and only inserts when the row is missing. I deliberately did not cache settings per request, because a stale value right after a save is worse than one extra query. On Neon (HTTP driver) each statement is a network round trip, so this should be most noticeable in production; local timings are too small to show it. 235 tests, lint, typecheck and build pass.

**Update 2026-10-19 (image delivery).** On-screen images no longer go through the Next/Vercel image optimizer (which downloaded the full original from Cloudinary for every size). A global loader now asks Cloudinary for `f_auto,q_auto,c_limit,w_<96|480|960|1280>`, so browsers fetch small AVIF/WebP files straight from Cloudinary's CDN; the first three cards load eagerly. Measured on a 1870x1250 original: 477 KB before, 1.6 KB (thumbnail), 18 KB (480px) or 61 KB (960px) now. **Cloudinary free-plan budget (1 credit = 1K transformations, 1 GB storage or 1 GB bandwidth):** each image costs a few transformations once (up to ~3 display widths, plus a second format for older browsers, plus 1 for the Instagram version), then they are cached; a Memes page of 24 cards is roughly 0.5-1.5 MB of bandwidth. Watch the Cloudinary dashboard for the first month. The likelier long-term cost is **storage**: only rejected images are cleaned up, approved/posted ones are kept. 231 tests, lint, typecheck and build pass.

**Update 2026-10-19 (later still): pad only when needed.** Images are no longer forced onto a 4:5 canvas. Images already between 4:5 and 1.91:1 are only converted to JPEG and capped at 1080px wide; taller ones are padded to 4:5 and wider ones to 1.91:1. Verified against real Cloudinary output for tall, square, 4:5, 3:2, 16:9, 2:1 and 3:1 shapes (all returned valid ratios). Because the output changes, **check one post on a throwaway Instagram account** before relying on it. 226 tests, lint, typecheck and build pass.

**Update 2026-10-19 (later): Instagram preview.** The Schedule edit panel has Edit / Preview tabs (live caption), and Approved cards have a Preview button. It renders the exact image URL and caption publishing sends, with size/aspect, character and hashtag counts and errors for >2,200 characters, >30 hashtags, an unloadable image or a bad aspect ratio. Publishing now uses the same `pickCaption`/`buildCaption` as the preview. Checked in the browser against Cloudinary's public demo cloud (desktop, mobile, broken image, 31 hashtags). 221 tests, lint, typecheck and build pass. Not changed: a caption Instagram would reject is flagged but still not blocked from saving or publishing.

**Update 2026-10-19: error pages.** Added `error.tsx`, `global-error.tsx` and `not-found.tsx` (see CLAUDE.md, UI conventions). Verified in the browser with a deliberately failing page and a deliberately failing root layout (both removed again): the reference shown to the user matches the digest in the server log. 207 tests, lint, typecheck and build pass.

**Update 2026-10-18 (later): UI/UX redesign.** Sidebar app shell (menu on mobile), light/dark themes, new design tokens, toasts with Undo, slide-overs for edits, named confirm dialogs for publish/disconnect, skeleton/empty/error states, search on Memes and Schedule, instant-save automation switches. Checked in the browser at 375px and 1280px (light and dark) against a scratch Postgres database (`ui_check`) with demo rows and a test-only admin password, never the real dev data. Automated: 202 tests, lint, typecheck and build pass. Not covered by automated tests: the visual components themselves (verified by hand), and real Instagram publishing.

**Update 2026-10-18: deployed and verified end to end in production.**
Live at https://reddit-instagram.vercel.app (Vercel + Neon + Inngest Cloud). Confirmed working with a real Instagram account:
- Upload via "Add your own meme", Cloudinary storage, approve and schedule
- Instagram connect (OAuth), **Publish now** posts to Instagram
- **Automatic publishing**: a post scheduled for 11:02 was posted by the Inngest 5-minute job at about 11:05
- Login, Activity log and alerts on the live site

**Still unverified:** Reddit scraping (no Reddit API access yet), the daily auto-scrape, the token-refresh job (needs a token under 15 days from expiry), the image-cleanup job, and the failure paths against the real Instagram API (expired token, image rejected).

**All planned coding is done and covered by automated tests (202 tests, lint, typecheck and production build pass).**
What has *not* happened yet is a run against the real services. Everything external (Reddit, Cloudinary,
Instagram) has only been exercised with mocks, and the database with a local Docker Postgres.

The GitHub remote exists and `main` was in sync with it as of 2026-10-19. Push only when the user says so.

### What's built

| Area | What it does |
|---|---|
| Add your own meme | Dashboard form: upload a JPEG/PNG/WebP (max 4 MB, Vercel limits request bodies to 4.5 MB) + title. Goes straight to Approved (auto-scheduled if that setting is on). Caption is just the title. Lets you test everything without Reddit |
| Scraper | Pulls image memes from chosen subreddits (Reddit OAuth), filters out NSFW/video/gallery/GIF/stickied, skips duplicates (Reddit id + SHA-256 of the image bytes), uploads to Cloudinary |
| Memes `/` | Tabs New / Approved / Rejected / Posted with counts, title/author search, 24 per page, Approve / Reject / Move back with Undo toast, "Scrape now", "Add meme" slide-over |
| Scheduling | Next free daily slots (default 09:00, 14:00, 20:00), timezone and DST aware, never double-booked. "Schedule N approved" button, or automatic on approval (setting) |
| `/schedule` | Table grouped by day (Today / Tomorrow / date), filters All / Upcoming / Posted / Failed + search, Publish now / Retry (confirm dialog), edit caption and time in a slide-over, remove from schedule |
| `/settings` | Subreddits, memes per scrape, post times, timezone, automation switches, Instagram connection card |
| Instagram | OAuth (Instagram Login API, no Facebook Page needed), encrypted token, container → poll → publish, credit caption by default |
| Auto-publish | Inngest cron every 5 min: publishes the next due post (max one per run) |
| Auto-scrape | Inngest cron daily 06:00 UTC (switchable) |
| Token refresh | Inngest cron daily 03:00 UTC, refreshes when under 15 days left |
| Cleanup | Inngest cron daily: deletes Cloudinary images of memes rejected >14 days ago (rows stay, so no re-scrape) |
| Safety nets | Atomic claim so a post can't be published twice; posts >6h late are marked failed instead of posted late; posts stuck "publishing" >15 min are marked failed with a "check Instagram first" warning; failed posts are never auto-retried |
| Logging | Pino logger (pretty in dev, JSON in prod, secrets redacted) + permanent `activity_log` table shown on `/activity` (filter to warnings/errors, 90-day retention). No Sentry on purpose: see CLAUDE.md |
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
| `REDDIT_CLIENT_ID/CLIENT_SECRET/USER_AGENT` | **missing, not pursuing** | `prefs/apps` no longer exists; access needs Reddit approval (see decision above). Use Add your own meme |

**Until `npm run admin:setup` is run, the app is locked: every page redirects to /login and login is refused.** That's intentional (fail closed).

Meta app checklist (still to finish in the Meta dashboard):
1. Use case "Manage messaging and content on Instagram" added to the app (done).
2. Add the permission **`instagram_business_content_publish`** (it was missing from the list).
3. Instagram account is Business/Creator, public, and added as an **Instagram Tester** (App roles → Roles); accept the invite in the Instagram app.
4. In "Set up Instagram business login", add the redirect URI `http://localhost:3000/api/instagram/callback`. If Meta rejects http://localhost, use an HTTPS tunnel and set `APP_URL` to it.

## Deployment plan
The ngrok tunnel was ruled out (the account's tunnel is used by another service), so testing happens on Vercel. Follow **docs/DEPLOY.md** step by step.

## Meta needs HTTPS (confirmed): tunnel notes, kept for reference
Meta rejected `http://localhost:3000/api/instagram/callback` ("Error saving redirect URIs"). Use an HTTPS tunnel; `ngrok` (already logged in on this Mac) and `cloudflared` are installed.

1. ngrok dashboard → Domains → copy your free static domain, e.g. `something.ngrok-free.app`
2. `ngrok http --url=something.ngrok-free.app 3000` (leave running)
3. In `.env.local` set `APP_URL=https://something.ngrok-free.app`
4. Meta → Business login settings → redirect URI `https://something.ngrok-free.app/api/instagram/callback`
5. Start the app (`npm run dev`) and **open the app through the https URL for the whole session** (cookies are per-host; logging in on localhost and connecting through the tunnel will fail the state check). `next.config.ts` allows the tunnel host automatically from `APP_URL`; restart the dev server after changing it.
6. ngrok's free plan shows a one-time "Visit site" warning page in the browser; click through.
No-signup alternative: `cloudflared tunnel --url http://localhost:3000` (the URL changes every run, so Meta + `APP_URL` need updating each time).
Vercel works too (stable HTTPS URL) but needs Neon, all env vars, Inngest Cloud keys and a redeploy per fix; better once the flow is proven.

## Testing without Reddit (no Reddit API access needed)
Reddit API access wasn't granted. Everything except scraping can be tested with uploads:
1. Needs only: `npm run admin:setup`, the three Cloudinary values, the tunnel above, and the Meta setup
2. Dashboard → **Add your own meme** → pick an image + title → it appears in Approved
3. Approved tab → Schedule (or Settings → auto-schedule). To test automatic posting soon: Schedule page → **Edit caption or time** → set a time ~5 minutes ahead → Save
4. Immediate test: **Publish now**. Automatic test: run Inngest dev (step 8 below) and wait for the time to pass (the job runs every 5 minutes, on the :00/:05/:10 marks)

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
9. Open **Activity** after each step: every scrape, publish, login and failure should appear there with details
10. Try the failure paths: disconnect Instagram and Publish now (expect a clear failure + Retry), edit a caption, move a time, unschedule

Things most likely to need a small fix on first contact with the real services:
- Instagram's image requirements (we send a JPEG at most 1080px wide; only images outside 4:5 to 1.91:1 are padded, see `INSTAGRAM_TRANSFORMATION`)
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

## Debugging tips
- **What happened?** Open `/activity` (filter: Warnings and errors). Each entry has a Details section with ids and reasons.
- **Terminal:** `npm run dev` prints colored logs; set `LOG_LEVEL=debug` to also see each Instagram API response status and each publish step.
- **Cron jobs:** the Inngest dashboard shows each run, its output and retries.
- **On Vercel:** logs are JSON, so search for fields such as `"kind":"publish.failed"` (history is short on the free plan, so rely on `/activity` for older events).

## Handy commands
```
npm run dev | build | start
npm run typecheck | lint | test
npm run db:push | db:generate | db:studio
npm run admin:setup
docker compose up -d db
```

## Choosing post times (engagement)
These are rules of thumb, not measured results for this account.
- Weekdays: late morning (about 10:00-12:00), lunch (12:00-14:00) and evening (19:00-22:00). Weekends: later mornings and evenings.
- Memes tend to do best in the evening and on lunch breaks.
- Use the audience's local time: check that the timezone in Settings matches where most followers live.
- Current default slots are 09:00, 14:00, 20:00. Suggested experiment: move 09:00 to about 11:00-12:00 and add a late slot around 21:30.
- Find the real answer in Instagram → Insights → Total followers → Most active times, then after a few weeks compare reach and likes per post by slot. Keep times slightly varied (spam flags).
- Slots are a setting (`/settings`), so nothing in code needs to change.

## Ideas for later
AI captions and hashtags, Reels/video, email or push alerts, multiple Instagram accounts, per-subreddit quality filters (min score), analytics on which memes perform.
