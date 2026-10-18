# Reddit → Instagram Meme Automation

> `README.md` is the setup guide for new developers (keep it in sync when setup steps, env vars or scripts change). Project status, setup checklist and test plan live in `docs/PROGRESS.md`; deployment steps in `docs/DEPLOY.md`. Read it first and keep it updated when something significant changes.

A dashboard tool that scrapes memes from Reddit, lets an admin approve them, and automatically posts them to Instagram on a schedule.

## Git rules

- Commit changes locally after finishing a change.
- **Never push to the remote (GitHub) unless the user explicitly says so in chat.** Approval for one push does not carry over to later pushes.
- Never force-push, rewrite published history, or delete branches without being asked.

## Testing rules

- After changing or adding any feature, test it properly before committing or calling it done.
- Run the relevant automated tests (unit/integration) and add new ones for new logic, such as scheduling, slot assignment, dedupe and token refresh.
- Run typecheck and lint, and make sure the build passes.
- For UI changes, run the app and check the flow in the browser, including loading, empty and error states.
- For Reddit, Instagram and Cloudinary integrations, test against mocks or sandbox/test accounts. Never post to the real Instagram account during automated tests.
- Report results faithfully: if something fails or was not tested, say so. Do not commit broken code.

## Product flow

1. Scraper pulls N image posts (configurable, default 10–15) from chosen subreddits.
2. Posts appear on the dashboard; the admin approves or rejects each.
3. At least 3 posts per day go out at different times (slots are configurable).
4. Approving posts schedules them automatically, for a single day or a range (e.g. 7 or 30 days).
5. A scheduler publishes due posts to Instagram.

Out of scope for now: AI captions and hashtags (planned later), video/Reels.

## Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Postgres with Drizzle ORM: Neon in production, local Docker container in dev (driver is picked from the `DATABASE_URL` host in `src/db/index.ts`)
- Cloudinary for image storage (Instagram needs a public JPEG URL). On-screen images are resized by Cloudinary itself via a global `next/image` loader (`src/lib/image-loader.ts`, `cloudinary-delivery.ts`), not by the Next/Vercel optimizer; `next.config.ts` allows only widths 96/480/960/1280 because each distinct width is one billed Cloudinary transformation (free plan: 1 credit = 1,000 transformations, 1 GB storage or 1 GB bandwidth). Do not add widths or per-image `loader` props casually.
- Inngest for scheduling and background jobs (Vercel free-tier cron is daily only)
- Hosting: Vercel

## Auth

- Dashboard login: single admin password. `npm run admin:setup` prompts for it (hidden) and writes `ADMIN_PASSWORD_HASH` (scrypt) and `SESSION_SECRET` to `.env.local`. Sessions are HMAC-signed 7-day cookies (`src/lib/auth`). Kept separate from Instagram.
- **Every server action, route handler and data-reading page component must call `await requireAdmin()` first (and never inside a try/catch, since redirect() throws).** `src/proxy.ts` is only an optimistic first gate. Only `/login` and `/api/inngest` (Inngest signing key) are public. If the secret/hash are missing, everything stays locked (fail closed).
- Instagram connection: Instagram API with Instagram Login (no Facebook Page needed). Requires a Business or Creator account. The Meta app stays in development mode while it is single-user.
- Store IG tokens encrypted. Long-lived tokens last about 60 days, so a refresh job is required.

## Data model (planned)

- `ig_accounts`: encrypted token, expiry, IG user id
- `scraped_posts`: reddit id, subreddit, title, author, permalink, cloudinary url, status (`new`, `approved`, `rejected`, `posted`)
- `scheduled_posts`: scraped_post_id, `scheduled_at`, status (`pending`, `publishing`, `posted`, `failed`), ig_media_id, error
- `settings`: subreddits, scrape count, daily post slots

## Instagram publishing flow

Create a media container (image URL + caption) → poll its status until ready → call `media_publish`. Images must be JPEG with aspect ratio between 4:5 and 1.91:1; use Cloudinary transforms to convert to JPEG, cap the width at 1080 and pad **only images outside that range** (`INSTAGRAM_TRANSFORMATION` in `src/lib/cloudinary.ts`). Each `if_ar_…` condition must be its own URL segment, or Cloudinary answers 400 "Cannot find matching if" (tested in `cloudinary.test.ts`).

## Instagram notes

- Needs a Meta developer app with the Instagram product; set `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `APP_URL` and add `APP_URL/api/instagram/callback` as an OAuth redirect URI. Meta may require HTTPS there; if localhost is rejected, use a tunnel and set `APP_URL` to it.
- Meta rejects `http://localhost` redirect URIs: test through an HTTPS tunnel (see `docs/PROGRESS.md`) with `APP_URL` set to it.
- Never publish to the real account from tests or scripts; tests mock `fetch`. Only the user's click on "Publish now" posts for real.
- Long-lived tokens last ~60 days; a daily Inngest job refreshes them when under 15 days remain. An expired token can't be refreshed, so the user must reconnect.

## Known risks and rules

- Reddit API needs OAuth app registration; unauthenticated scraping gets blocked from cloud IPs. Only scrape image posts.
- Always credit the original creator in captions.
- Dedupe by Reddit post id and image hash so nothing is queued twice.
- Keep a human approval step and vary post times slightly to avoid Instagram spam flags.

## Build order

1. Scaffold app, auth, DB schema, Cloudinary upload
2. Reddit scraper + "Scrape now" + dashboard grid
3. Approve/reject, slot assignment, schedule view
4. Connect Instagram and publish one post manually (riskiest part, do early)
5. Scheduler job, retries, failure states, token refresh
6. Later: AI captions/hashtags, Reels

## Conventions

- Never commit secrets. Keep `.env.local` out of git and maintain a `.env.example`.
- Keep changes small and focused, one logical change per commit.

## Commands

- `npm run dev` — dev server (set `INNGEST_DEV=1`; run `npx inngest-cli@latest dev` for the Inngest UI)
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
- `docker compose up -d db` — project-only Postgres on `127.0.0.1:5433` (container `reddit_instagram_postgres`, own volume). Do not touch other projects' containers (`atlas_*`, `sendify_*`) or port 5432. Dev URL is in `.env.local`.
- `npm run db:generate` / `db:push` — Drizzle migrations (needs `DATABASE_URL` in `.env.local`)
- Package manager is npm (the local pnpm/corepack is broken).
- Next.js here is a newer version than usual; read `node_modules/next/dist/docs/` before using unfamiliar APIs (see AGENTS.md).

## Logging and errors

- Use `getLogger("name")` from `src/lib/log.ts` (Pino). **Never use `console.*`.** Log errors as `log.error({ err }, "what failed")`. Secrets are redacted automatically (`token`, `access_token`, `password`, `secret`, `authorization`, `cookie`...), but don't log them on purpose.
- For events a human cares about (posted, failed, scraped, login, token refreshed), call `recordActivity({ level, kind, message, meta })` from `src/lib/activity.ts`. It logs AND stores the event in `activity_log`, shown on `/activity` and kept 90 days. It never throws.
- Dev logs are pretty and colored; production logs are JSON lines. `LOG_LEVEL` overrides the level.
- We decided against Sentry: Vercel logs are short-lived, so the activity log (permanent, searchable) plus Inngest's run history and the dashboard alerts banner cover it.

## Layout

- `src/db` — Drizzle schema and lazy Neon client; migrations in `drizzle/`
- `src/lib` — env validation, Cloudinary helpers, `log.ts` (Pino) and `activity.ts`
- `src/lib/memes/manual.ts` — admin-uploaded memes (`subreddit = "manual"`, caption = title only)
- `src/lib/reddit` — Reddit OAuth client, image filtering, scrape service (`scrape.ts` is pure, dependency-injected and unit-tested; `run.ts` wires real services)
- `src/app/actions` — server actions (scrape, approve/reject, schedule, settings, publish, login/logout), all behind `requireAdmin()`
- `src/lib/schedule` — `service.ts` (schedule approved posts, auto-schedule), `local-time.ts`, `assignSlots` (pure, timezone/DST-aware slot assignment), formatting helpers
- `src/db/queries.ts` — all DB access; `queries.test.ts` runs them against in-memory PGlite using the real migration
- Pages (in the `(app)` route group, which adds the sidebar shell `components/app-shell.tsx`): `/` Memes (tabs, search; Approved tab has the schedule form), `/schedule`, `/activity`, `/settings`
- `src/lib/instagram` — Instagram Login API client (`api.ts`), publish service (`publish.ts`, claims a row atomically so a post is never published twice), config. `caption.ts` is pure and shared by publishing and the preview (`buildCaption`, `pickCaption`, `analyzeCaption` with Instagram's limits: 2,200 characters, 30 hashtags, 20 mentions); never duplicate caption logic elsewhere. `preview-url.ts` returns the same `instagramReadyUrl()` that publishing sends, so the preview (`components/instagram-preview.tsx`, shown in the schedule edit panel and on Approved cards) cannot drift from what is posted. OAuth routes in `src/app/api/instagram/{connect,callback}`. Tokens are AES-GCM encrypted (`src/lib/crypto.ts`, needs `TOKEN_ENCRYPTION_KEY`).
- `src/inngest` — client, functions, and job logic (`jobs.ts`, dependency-injected and tested). Served at `/api/inngest`.
  - `publish-due-posts` runs every 5 min: publishes at most ONE due post per run (spaces out catch-up posts), and marks posts more than 6h late as `failed` ("Missed its time slot") instead of posting them late. Failed posts are never auto-retried (avoids double posts); the user clicks Retry.
  - `refresh-instagram-token` runs daily at 03:00 UTC. `scrape-memes-daily` runs at 06:00 UTC (setting `autoScrape`). `cleanup-rejected-images` runs daily and drops Cloudinary images of memes rejected >14 days ago.
  - `publish-due-posts` also marks posts stuck in `publishing` >15 min as failed (can't know if Instagram accepted them, so a human checks before Retry).
  - To test locally: `INNGEST_DEV=1 npm run dev`, then `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`, and `curl -X PUT localhost:3000/api/inngest` to sync.
- `src/components/ui` — design-system primitives (shadcn base + `sheet`, `confirm-dialog`, `tooltip`/`IconButton`, `menu`, `field`, `switch`, `skeleton`, `empty-state`, `page-header`, `kbd`)

## UI conventions

Patterns per page (from the `page-patterns` skill): Memes and Schedule are List/Index, Activity is a feed, Settings is Settings (sticky section nav, instant-save switches, one Save per form group), Login is Form (auth).

- Design tokens live in `src/app/globals.css` (one indigo accent, L0 `--background` / L1 `--card`, 1px borders + `shadow-soft`). Light and dark via `next-themes`. Type is 16/14/12px with weights 400/500/600 only.
- Results of server actions show as toasts (`useActionToast` in `src/lib/use-action-toast.ts`); reversible actions (approve/reject) offer Undo. Publishing and disconnecting Instagram go through `ConfirmDialog`, which names the exact meme or account and focuses Cancel.
- Short edits open in a `Sheet` slide-over, not inline `<details>` or a new page. Icon-only buttons use `IconButton` (real tooltip + `aria-label`).
- Every data page has a layout-matched skeleton (`components/skeletons.tsx`, shown only after 100ms), an empty state with a next step, and an error state with a reload link. Copy is verb-first, sentence case and never blames the user.
- Crashes: `src/app/(app)/error.tsx` (inside the sidebar shell), `src/app/global-error.tsx` (root layout failed; own `<html>`, system font) and `src/app/not-found.tsx`. They share `components/error-view.tsx`: friendly copy, Try again, Copy error details (reference + route + time, never the stack; falls back to a selectable box if the clipboard is blocked). The reference is Next's `error.digest`, which also appears in the server log next to the real error. **In this Next version the boundary prop is `retry`, not `reset`, and `error` is `unknown`.**
- Keep touch targets at 44px on narrow screens (`max-md:h-11` on controls) and no horizontal page overflow at 375px.
