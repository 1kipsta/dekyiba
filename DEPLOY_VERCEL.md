# Deploying to Vercel

This app now runs on Vercel as a single serverless function (`api/index.js`)
that wraps the existing Express app. Every request — pages, static assets,
and `/api/*` — is routed there by `vercel.json`. Locally or in Docker,
nothing changes: `node server.js` still works exactly as before.

## What changed for Vercel

- `server/server.js` now exports the Express app instead of always calling
  `.listen()` (it still listens when you run it directly, e.g. locally).
- `server/db.js` accepts a `DATABASE_URL` connection string, supports SSL,
  and uses a much smaller connection pool by default when `VERCEL` is set —
  serverless functions can run many instances in parallel, and a large pool
  per instance (fine for one always-on Docker container) can exhaust a
  managed MySQL host's connection limit.
- The menu file upload route (`POST /api/management/restaurant/menu/upload`)
  now writes to **Vercel Blob** instead of the local disk when running on
  Vercel, because Vercel's filesystem is read-only/ephemeral in production.
  Locally/Docker it still writes to `public/uploads` as before.
- `vercel.json` bundles the `public/` folder into the function explicitly
  (`includeFiles`), since Vercel's dependency tracer only picks up files
  reached via `require`/`import`, not ones read at runtime by
  `express.static`.

## You still need a MySQL database

Vercel doesn't host databases. Pick one:
- **PlanetScale**, **Aiven**, **Railway MySQL**, or any managed MySQL 8 host
- A MySQL instance you run elsewhere (a small VPS, etc.) that accepts
  connections from the internet

Whichever you use, run the schema against it once, from your own machine,
before or after the first deploy:

```bash
mysql -h <host> -u <user> -p < database/schema.sql
cd server
DATABASE_URL="mysql://user:pass@host:3306/dekyiba_hotel?sslmode=require" node seed.js
```

(`seed.js` creates the default manager account — username `kipsta`, password
from `ADMIN_DEFAULT_PASSWORD` or the default in `.env.example`.)

## Set up Vercel Blob (for menu file uploads)

In your Vercel project: **Storage → Create Database → Blob**. This sets the
`BLOB_READ_WRITE_TOKEN` environment variable for you automatically — no
manual copying needed as long as it's connected to the same project.

## Environment variables (Vercel → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `DATABASE_URL` | e.g. `mysql://user:pass@host:3306/dekyiba_hotel?sslmode=require` |
| `JWT_SECRET` | a long random string |
| `ADMIN_DEFAULT_PASSWORD` | only needed when you run `seed.js` |
| `DB_CONNECTION_LIMIT` | optional, defaults to `1` on Vercel |

You do **not** need to set `BLOB_READ_WRITE_TOKEN` yourself if you provisioned
Blob storage through the Vercel dashboard for this project — it's injected
automatically.

## Deploy

```bash
npm i -g vercel     # if you don't have it
vercel               # first deploy, follow the prompts
vercel --prod        # promote to production
```

Or connect the GitHub repo in the Vercel dashboard for automatic deploys on
push.

## Known limitations on Vercel

- **Login rate limiting** (`express-rate-limit`) keeps its counts in memory.
  On Vercel that memory resets on cold starts and isn't shared across
  concurrent instances, so the limit is best-effort rather than a hard cap.
  If you need a real global limit, back it with Upstash Redis or similar —
  ask me if you want that wired in.
- **Cold starts**: the first request after inactivity will be slower while
  the function boots and opens a DB connection.
- Everything else (bookings, JWT auth, staff/admin dashboard, CSV export,
  etc.) works the same as the Docker version.
