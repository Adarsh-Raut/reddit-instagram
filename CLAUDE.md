# Reddit → Instagram Meme Automation

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
- Neon Postgres, with Drizzle ORM
- Cloudinary for image storage (Instagram needs a public JPEG URL)
- Inngest for scheduling and background jobs (Vercel free-tier cron is daily only)
- Hosting: Vercel

## Auth

- Dashboard login: Auth.js or Better Auth, kept separate from Instagram.
- Instagram connection: Instagram API with Instagram Login (no Facebook Page needed). Requires a Business or Creator account. The Meta app stays in development mode while it is single-user.
- Store IG tokens encrypted. Long-lived tokens last about 60 days, so a refresh job is required.

## Data model (planned)

- `ig_accounts`: encrypted token, expiry, IG user id
- `scraped_posts`: reddit id, subreddit, title, author, permalink, cloudinary url, status (`new`, `approved`, `rejected`, `posted`)
- `scheduled_posts`: scraped_post_id, `scheduled_at`, status (`pending`, `publishing`, `posted`, `failed`), ig_media_id, error
- `settings`: subreddits, scrape count, daily post slots

## Instagram publishing flow

Create a media container (image URL + caption) → poll its status until ready → call `media_publish`. Images must be JPEG with aspect ratio between 4:5 and 1.91:1; use Cloudinary transforms to convert and pad.

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
- `npm run db:generate` / `db:push` — Drizzle migrations (needs `DATABASE_URL` in `.env.local`)
- Package manager is npm (the local pnpm/corepack is broken).
- Next.js here is a newer version than usual; read `node_modules/next/dist/docs/` before using unfamiliar APIs (see AGENTS.md).

## Layout

- `src/db` — Drizzle schema and lazy Neon client; migrations in `drizzle/`
- `src/lib` — env validation, Cloudinary helpers
- `src/inngest` — client and background functions, served at `/api/inngest`
- `src/components/ui` — shadcn components
