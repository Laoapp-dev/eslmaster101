# Deploying to Cloudflare Pages (with cross-device accounts)

This app now has a real backend: Cloudflare Pages Functions (in
`/functions`) backed by a Cloudflare D1 database. Accounts, passwords,
and every learner's words/progress/lessons/settings sync through that
database, so the same login works identically on a phone, a laptop, or
any other device — nothing is stored only in one browser anymore.

You only need a Cloudflare account (the free plan is enough for this).

## 1. Install the Cloudflare CLI and log in

```bash
npm install        # installs wrangler + everything else, if you haven't
npx wrangler login # opens a browser to authorize the CLI
```

## 2. Create the D1 database

```bash
npx wrangler d1 create esl-master-vocab-db
```

This prints a `database_id`. Copy it into `wrangler.toml`, replacing
**both** `REPLACE_WITH_YOUR_D1_DATABASE_ID` placeholders
(`database_id` and `preview_database_id` — using the same real ID for
both is fine for a single-database project):

```toml
[[d1_databases]]
binding = "DB"
database_name = "esl-master-vocab-db"
database_id = "paste-the-real-id-here"
preview_database_id = "paste-the-real-id-here"
```

## 3. Run the schema migration

```bash
npx wrangler d1 execute esl-master-vocab-db --remote --file=./migrations/0001_init.sql
```

(There's also `npm run db:migrate:remote` / `npm run db:migrate:local`
as shortcuts for this, and `npm run pages:dev` to run the whole app —
frontend + Functions + a local D1 — on your machine before deploying.)

## 4. Create the Pages project and connect D1 to it

**Easiest path — connect the repo in the dashboard:**
1. Push this project to a GitHub repo.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect
   to Git** → pick the repo.
3. Framework preset: **Vite**. Build command: `npm run build`. Build
   output directory: `dist`. Leave everything else default.
4. After the first deploy, go to the new project →
   **Settings → Bindings → Add → D1 database bindings**.
   Variable name **must** be `DB` (that's what every file under
   `/functions/api` expects), and point it at `esl-master-vocab-db`.
   Do this for both the **Production** and **Preview** environments.
5. Trigger a redeploy (Deployments → ⋯ → Retry deployment) so the new
   binding takes effect.

> **If a binding you set in `wrangler.toml` doesn't seem to apply**
> when deploying via a connected Git repo: Pages only reads bindings
> from `wrangler.toml` on projects using the newer "v2" build system
> (Settings → Builds → build system version). If yours predates that,
> or the setting is unclear, just add the D1 binding directly via
> **Settings → Bindings** as in step 4 above — that always works
> regardless of build system version, and is the most reliable option
> when deploying through the dashboard rather than the CLI.

**Alternative — deploy from the CLI instead of the dashboard:**
```bash
npm run build
npx wrangler pages deploy dist --project-name=esl-master-vocab
```
`wrangler.toml`'s `[[d1_databases]]` block is picked up automatically
this way, so you can skip step 4 above.

**Using GitHub Actions instead:** `.github/workflows/deploy-cloudflare.yml`
is already set up — just add two repo secrets, `CLOUDFLARE_API_TOKEN`
and `CLOUDFLARE_ACCOUNT_ID` (Cloudflare dashboard → My Profile → API
Tokens → create a token with **Cloudflare Pages: Edit** permission).
The D1 binding still has to be added once via the dashboard (step 4)
regardless of which deploy method you use — bindings are a property of
the Pages *project*, not of any one deployment.

## 5. Try it

Open the `*.pages.dev` URL (or your custom domain). Register an
account — **the very first account created becomes the admin**
automatically (see `functions/api/auth/register.ts`). Everyone who
registers after that is a regular learner. Sign in with that same
account from a different device/browser and your words, progress, and
settings will be there.

## How the data model works

- `users` — one row per account (email/password hash, role, CEFR level,
  streaks, etc).
- `sessions` — one row per signed-in device; deleting it (logout) or
  letting it expire signs that device out without touching any other
  device's session.
- `user_data` — one row per account holding a single JSON blob with
  everything a learner accumulates (their own added words, per-word
  progress, study sessions, profile stats, settings, practice
  submissions, spelling streak, etc). The client's `cloudStorage`
  helper (`src/lib/cloudStorage.ts`) mirrors the old `localStorage`
  API so the rest of the app didn't need to change shape — it just
  reads/writes this blob instead of the browser.
- `app_config` — one shared row for the AI provider keys set in
  **Admin → AI Keys**, since those are the same for every learner
  (not per-account).

The 9,000+ word base curriculum (`public/data/vocabulary.json`) is
still a static file bundled with the app — it's shared, read-only
content, not something that needs a database row per user.

## Security notes

- Passwords are hashed with PBKDF2-SHA256 (100,000 iterations) using
  the Workers runtime's built-in Web Crypto — never stored in plain
  text.
- Sessions are an HttpOnly, Secure, SameSite=Lax cookie; nothing in the
  browser's JS (or localStorage) ever holds the session token or a
  password.
- The AI provider keys in Admin → AI Keys are still readable by any
  signed-in learner's browser (not just the admin's), because the app
  calls Gemini/ElevenLabs directly from the client — same tradeoff the
  app already had before this change. For production use with
  sensitive keys, consider adding a small Function that proxies those
  calls server-side instead of exposing the key to the browser at all.
