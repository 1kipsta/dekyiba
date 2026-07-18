# Deploying to Vercel (Postgres edition)

This version of the app runs entirely on Vercel: the web app, the file
uploads (Vercel Blob), and now the database too (Postgres via Neon, through
Vercel's own Storage Marketplace). You don't need Aiven, Docker, or any
external MySQL host anymore.

## What changed from the MySQL version

- The database engine changed from **MySQL to Postgres**. This was
  necessary — Vercel doesn't offer MySQL natively, only Postgres (Neon,
  Supabase), Redis, and NoSQL stores.
- `server/db.js` now talks to Postgres (via the `pg` package) instead of
  MySQL (`mysql2`). It includes a compatibility layer so the rest of the app
  didn't need a full rewrite — you won't notice a difference day to day.
- `database/schema.sql` is now written in Postgres syntax.
- **This is a fresh start for your data.** Your existing Aiven MySQL data
  (bookings, guests, staff accounts) does not carry over automatically —
  Postgres and MySQL are different enough that a straight copy isn't
  possible. You'll re-seed your manager account and rooms from scratch (see
  below), the same as your very first setup.
- File uploads (Vercel Blob) work exactly as before — no changes there.

## Step 1 — Create your Postgres database on Vercel

1. In your Vercel project → **Storage** tab → **Create Database**
2. Choose **Postgres** (via Neon)
3. Follow the prompts — Vercel automatically connects it to your project and
   sets a `DATABASE_URL` (or `POSTGRES_URL`) environment variable for you.
   You don't need to copy/paste any connection string yourself.

## Step 2 — Load the schema

You still need to run `database/schema.sql` once, the same way as before,
just against Postgres instead of MySQL this time.

**Easiest option — Neon's own web SQL editor:**
1. In your Vercel project → Storage → your new Postgres database → there's
   a link through to the Neon dashboard
2. Open its **SQL Editor**
3. Paste in the entire contents of `database/schema.sql` and run it

**Or from your computer**, if you have `psql` installed:
```
psql "your-connection-string-from-vercel" -f database/schema.sql
```

**Or with a free GUI tool** like pgAdmin or TablePlus — same idea as
HeidiSQL, just for Postgres: connect using the connection string from
Vercel, open `schema.sql`, run it.

Just like before: only run this ONCE, on a fresh/empty database. Running it
again later will wipe everything.

## Step 3 — Create your manager login

From your computer, in the `server` folder:
```
$env:DATABASE_URL="your-connection-string-from-vercel"
node seed.js
```
This creates the `kipsta` manager account, same as before.

## Step 4 — Set up Vercel Blob (file uploads)

Same as before: Storage → Create Database → Blob. No manual token copying
needed.

## Step 5 — Environment variables

Vercel already set `DATABASE_URL` automatically in Step 1. Just add:

| Variable | Value |
|---|---|
| `JWT_SECRET` | a long random string |
| `ADMIN_DEFAULT_PASSWORD` | only needed when you run `seed.js` |

## Step 6 — Deploy

Push your updated code to GitHub as usual — Vercel redeploys automatically.

## A note on Docker / local MySQL

The `Dockerfile` and `docker-compose.yml` in this project still describe
the *old* MySQL setup. They're left in place in case you ever want to run a
local copy for testing, but they're no longer part of the Vercel deployment
path and won't be kept in sync with the Postgres schema going forward. If
you want a Postgres-based local dev setup too, just ask.

## Known limitations (unchanged from before)

- Login rate limiting is best-effort across cold starts (in-memory, per
  serverless instance) — same as before.
- Cold starts: first request after inactivity is a bit slower.
