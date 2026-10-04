@AGENTS.md

# Zola

Chat UI for the Hermes agent. Next.js 16 app router, React 19, AI SDK 7, Drizzle on Postgres, shadcn/ui on Tailwind v4. Served at chat.kryos.dev behind the access service (auth.kryos.dev), which sets `Remote-User`, `Remote-Email`, `Remote-Name` and `Remote-Groups`; the app has no login of its own.

## Backends

Hermes gateway (`HERMES_API_URL`, Bearer `HERMES_API_KEY`): chat over `/v1/responses` SSE (stateless: the whole chat goes in `input` as text, the new turn last; `X-Hermes-Session-Key` = chat id only scopes the agent's memory), native reasoning deltas, images as `input_image` data URLs, other attachments referenced by their `BLOB_HOST_DIR` path. Hermes dashboard (`HERMES_DASHBOARD_URL`, basic-provider cookie login): skills, connectors (MCP), scheduled jobs, memory, model options, env keys, provider OAuth, audio (`/api/audio/transcribe`, `/api/audio/speak`), gateway restart. Zola's own Postgres: chats, messages, projects (saved prompts), canvases, feedback, preferences. Nothing else; features whose backend does not exist are removed, not stubbed.

## Look and feel

- Theme: cool greys, hairline borders, indigo `#5e6ad2` accent, Inter, radius 0.5rem, defined once in the shadcn variable set in `app/globals.css` (`:root` / `.dark`). Tweak values there only. No serif fonts.
- shadcn/ui components from `components/ui`, used heavily; no hand-rolled buttons, rows or menus.
- Semantic tokens only (`text-sm`, `bg-accent`, `text-muted-foreground`, `border-border`, `size-8`); no raw colours (`bg-sky-500`, `#0ea5e9`) and no arbitrary sizes (`text-[13px]`, `h-[70vh]`).
- Layout ideas may come from claude.ai / ChatGPT (Customize page: Skills | Connectors, Scheduled, Projects); colours do not.

## Dev

`npm run dev` needs a local Postgres (`create database zola encoding 'UTF8' template template0`; a WIN1252 database loses every reply containing an emoji), `DATABASE_URL`, `CSRF_SECRET`, `AUTH_DEV_USER` and the Hermes variables from `.env.example`. `npm run type-check`, `npm run lint`, `npm test` must pass before a push. Pushing to `main` builds the arm64 image `ghcr.io/kryos-dev/zola/web` that the VM runs.
