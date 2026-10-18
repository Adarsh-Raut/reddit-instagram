# Deploying to Vercel (Neon + Inngest Cloud)

Goal: a permanent HTTPS URL so Meta accepts the Instagram redirect, and so the 5-minute publishing job runs for real.
Everything here is free-tier. Nothing in this checklist pushes code to GitHub: the Vercel CLI uploads your local folder directly.

Replace `<domain>` below with your final Vercel URL (you learn it in step 4).

## 0. Accounts you need (all free)
- [Vercel](https://vercel.com) (Hobby plan is for personal, non-commercial use; use Pro if this becomes a business)
- [Neon](https://neon.tech)
- [Inngest](https://www.inngest.com)
- [Cloudinary](https://cloudinary.com)
- (Reddit API access is optional; use "Add your own meme" instead)

## 1. Neon database
1. Create a project. Pick the region closest to your Vercel functions (Vercel's default is **US East (Washington D.C.)**, so choose **AWS US East 1 (N. Virginia)**).
2. Copy the **connection string** (it ends with `?sslmode=require`). Keep it private. This is `DATABASE_URL`.
3. Create the tables, from this project folder on your Mac:
   ```
   DATABASE_URL='<paste neon connection string>' npm run db:migrate
   ```
   Expect `migrations applied successfully`. (The inline value overrides `.env.local`, so your local Docker DB is untouched.)

## 2. Production secrets (generate fresh ones, don't reuse local)
```
openssl rand -base64 32      # -> TOKEN_ENCRYPTION_KEY
```
For the dashboard login, run `npm run admin:setup` (it writes `ADMIN_PASSWORD_HASH` and `SESSION_SECRET` into `.env.local`). Open `.env.local` and copy those two values. Use a long password (12+ characters): this app is public on the internet and the login-attempt limiter is per server instance.

## 3. Create the Vercel project and first deploy
```
npx vercel login
npx vercel link          # create a NEW project, e.g. "reddit-instagram"
npx vercel --prod        # first deploy (will show a login redirect until env vars are set; that's fine)
```
The CLI skips `.env.local` and `node_modules`.

## 4. Find your URL
After the deploy, Vercel prints the production URL, e.g. `https://reddit-instagram.vercel.app`. (If the name was taken it adds a suffix.) That is `<domain>`.
Check the **Domains** tab of the project shows the same name.

## 5. Add environment variables in Vercel
Project → **Settings → Environment Variables** (tick **Production**; you can paste a whole `NAME=value` block at once):

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `TOKEN_ENCRYPTION_KEY` | generated in step 2 |
| `ADMIN_PASSWORD_HASH` | from `.env.local` |
| `SESSION_SECRET` | from `.env.local` |
| `APP_URL` | `https://<domain>` (no trailing slash) |
| `INSTAGRAM_APP_ID` | Meta → Instagram → Business login settings |
| `INSTAGRAM_APP_SECRET` | same page |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary dashboard → API keys |
| `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY` | step 6 |
| `LOG_LEVEL` | optional, e.g. `debug` while testing |

Do **not** set `INNGEST_DEV` in Vercel. Reddit variables only if you get API access.

## 6. Inngest Cloud
Recommended: use the **Vercel integration**.
1. Inngest dashboard → **Integrations → Vercel** → connect your Vercel account and this project. It adds `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` for you and syncs the app on each deploy.
2. Manual alternative: Inngest → your environment → **Manage → Event keys / Signing key**, add both to Vercel (step 5), then **Apps → Sync new app** with URL `https://<domain>/api/inngest`.

Expect to see 4 functions: `publish-due-posts`, `refresh-instagram-token`, `scrape-memes-daily`, `cleanup-rejected-images`.
If the sync fails with 401/403: Vercel → Settings → **Deployment Protection** → make sure the production domain isn't behind Vercel Authentication.

## 7. Redeploy so the env vars apply
```
npx vercel --prod
```
Then open `https://<domain>/login` and sign in with your admin password.

## 8. Meta dashboard
1. Business login settings → **OAuth redirect URIs** → `https://<domain>/api/instagram/callback` → Save (HTTPS is accepted, unlike localhost).
2. Confirm: permission `instagram_business_content_publish` added; your test account is Business/Creator, public, and an accepted **Instagram Tester**.

## 9. Smoke test, in this order
1. Sign in → Settings → set your **timezone** and post times → Save
2. Settings → **Connect Instagram** → approve → card shows `@yourname`
3. Dashboard → **Add your own meme** (JPEG/PNG/WebP up to 4 MB) → appears in Approved
4. Approved → **Schedule**, then Schedule page → **Publish now** → confirm on Instagram
5. Schedule another, **Edit caption or time** to ~5 minutes ahead → wait for the 5-minute job → confirm it posts by itself
6. **Activity** page: every step should be listed. Inngest dashboard: see the cron runs

## Limits worth knowing
- Uploads are capped at **4 MB** (Vercel rejects request bodies over 4.5 MB). Scraped Reddit images aren't affected.
- Functions are given up to 60 seconds (publishing polls Instagram for up to ~30s).
- Vercel logs on the free plan are short-lived; the **Activity** page keeps the important events for 90 days.
- The Instagram token lasts ~60 days and is refreshed daily by the cron job when under 15 days remain.

## Updating later
```
npx vercel --prod        # deploy local changes
DATABASE_URL='<neon>' npm run db:generate && DATABASE_URL='<neon>' npm run db:migrate   # after schema changes
```
Never regenerate `drizzle/0000_*.sql` after this point: add new migrations only.

## Troubleshooting
- **Login page loops / "not set up":** `ADMIN_PASSWORD_HASH` or `SESSION_SECRET` missing in Vercel, or you didn't redeploy after adding them.
- **Instagram connect says `bad-state`:** open the app via the same `https://<domain>` you set as `APP_URL` for the whole flow.
- **Publish fails with an Instagram error:** open Activity → Details for the exact message; with `LOG_LEVEL=debug`, Vercel logs also show each API response status.
- **Nothing posts automatically:** Inngest dashboard → is the app synced and are the crons running? Is a post scheduled in the past by less than 6 hours and still `pending`?
