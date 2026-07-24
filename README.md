# ESL Master Vocab

A fast, focused ESL vocabulary learning webapp — **9,142 words** across
CEFR levels A1–C2, with Flashcards, Quiz, Matching, and Spelling study
modes, plus AI-assisted Writing & Speaking Practice.

Accounts and every learner's progress sync across devices via
Cloudflare Pages Functions + a Cloudflare D1 database — sign in from a
phone, a laptop, or anywhere else and your data is the same account,
not a separate local copy.

## What's inside

- **9,142-word ESL curriculum** (`public/data/vocabulary.json`) — CEFR
  levels A1–C2, definitions, example sentences, synonyms/antonyms,
  categories, and Lao/Thai translations. Shared, read-only content
  bundled straight into the app.
- **Flashcards, Quiz, Matching, and Spelling** study modes, with a
  level-lock system (unlock the next CEFR level by mastering the one
  before it, or by placement pre-test).
- **Writing & Speaking Practice** with optional AI scoring/feedback
  (Google Gemini) — configured once by an admin in Admin → AI Keys and
  then available to every learner.
- **Accounts** — register/sign in, with the same account and progress
  available on any device. The first account ever registered on a
  deployment becomes the admin automatically.
- **Admin Panel** — manage user accounts and the AI keys above.
- **Cloud sync, not local storage.** Each learner's own added words,
  study progress, streaks, and settings are stored in Cloudflare D1,
  under their own account — see `CLOUDFLARE_DEPLOY.md` for how the data
  model works.

## Getting started

```bash
npm install
npm run dev            # local frontend dev server (no backend — see below)
npm run build           # production build → dist/
npm run pages:dev        # full app locally: frontend + Functions + local D1
```

`npm run dev` alone only runs the Vite frontend — sign-in and data sync
need the Cloudflare Functions + D1, which only run through
`npm run pages:dev` (Wrangler) or once deployed. See
**[CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md)** for full setup,
including creating the D1 database and running the schema migration.

## Configuring AI (optional)

Log in as the admin account → **Admin Panel → AI Keys** → paste a
[Google Gemini](https://aistudio.google.com/app/apikey) key (free tier
available) to enable AI-generated lessons, practice questions, and
writing/speaking feedback for every learner. These keys are optional —
the app works without them, just with simpler local scoring instead of
AI feedback — and are shared across every learner's account (stored in
D1), not per-browser.

## Deploying

This app is built for **Cloudflare Pages** — see
**[CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md)** for the full guide
(create the D1 database, run the migration, connect the repo, add the
binding). A GitHub Actions workflow
(`.github/workflows/deploy-cloudflare.yml`) is included for
push-to-deploy, or connect the repo directly in the Cloudflare
dashboard instead.

## Tech stack

React + TypeScript + Vite, Tailwind CSS, React Router, Framer Motion —
frontend. Cloudflare Pages Functions + D1 — backend (accounts, session
auth, per-user data sync).
