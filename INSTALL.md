# Installing Zola

Zola is the web UI for the Hermes agent. It is a Next.js app with its own
Postgres; chat, skills, connectors, scheduled jobs, voice and providers all go
through the Hermes gateway and dashboard.

## Prerequisites

- Node.js 22 and npm
- Postgres (UTF8 encoding)
- A running Hermes gateway and dashboard

## Environment

Copy `.env.example` to `.env.local`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `ENCRYPTION_KEY` | 32 bytes, base64, for secrets stored at rest |
| `CSRF_SECRET` | CSRF token secret |
| `BLOB_DIR` | Directory for uploaded files (path inside the container) |
| `BLOB_HOST_DIR` | The same directory as the Hermes host sees it |
| `AUTH_URL` | Access service URL; it sets the `Remote-User` header |
| `AUTH_DEV_USER` | Dev only: user to act as when no header is present |
| `HERMES_API_URL` | Hermes gateway |
| `HERMES_API_KEY` | Bearer key for the gateway |
| `HERMES_DASHBOARD_URL` | Hermes dashboard |
| `HERMES_DASHBOARD_USER` | Dashboard login |
| `HERMES_DASHBOARD_PASSWORD` | Dashboard password |
| `NEXT_PUBLIC_APP_NAME` | Display name (default `Zola`) |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Run

```bash
npm install
npm run db:migrate
npm run dev
```

## Docker

`docker build -t zola .` builds the production image; migrations apply on boot.
CI publishes `ghcr.io/kryos-dev/zola/web` for linux/arm64 on every push to
`main`. Mount `BLOB_DIR` as a volume.
