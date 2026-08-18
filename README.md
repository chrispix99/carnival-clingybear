# Carnival Casino Cruise Finder — carnival.clingybear.com

Private Carnival FSA rate finder for casino comps. Fetches from Carnival API, caches in DB, shows balcony upgrades + GEG flight options.

**Live:** https://carnival.clingybear.com (password: `clingy2026`) — Vercel alias https://carnival-clingybear.vercel.app

## Password
All routes gated by simple password `clingy2026`.

- Client: login gate stores `carnival_auth=clingy2026` in localStorage + cookie, sends `x-carnival-password` header on every `/api/actions` call.
- Server: `requireAuth(ctx)` checks header/cookie in Hatch actions; Vercel `api/actions.ts` checks same.
- To access via curl: `curl -H "x-carnival-password: clingy2026" https://carnival.clingybear.com/api/actions -d '{"action":"listCruises"}'`

## DB Persistence
- Hatch: `app.db` SQLite via `bun:sqlite` + drizzle-orm (file persists across restarts, mounted in space).
- Vercel: `server/src/db.ts` supports:
  - `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` → libSQL/Turso (true persistence, survives deploys)
  - fallback `SQLITE_PATH=./app.db` → ephemeral file (re-seeded via Carnival API on each cold start via `refreshCruises`)
  - Recommend setting Turso for prod: `vercel env add TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`
- Schema: `cruises` + `search_metadata` (see drizzle/0001_initial.sql). Auto-creates tables if missing.
- Data flow: `fetchCarnivalPage` → `storeCruises` upserts by `sailing_id`, keeps `last_updated`.

## Deploy

### Hatch (local)
```bash
bun install
bun run build
# space runs via Hatch runtime
```

### Vercel
```bash
vercel --prod
vercel domains add carnival.clingybear.com
vercel env add CARNIVAL_PASSWORD  # value: clingy2026
vercel env add TURSO_DATABASE_URL # optional for persistence
vercel env add TURSO_AUTH_TOKEN   # optional
```
Build: `bun run build`, output `client/dist`, functions `api/*.ts`.

## GitHub
- Repo: https://github.com/chrispix99/carnival-clingybear
- Author: Chris Pick <cpick@vmenu.com>
- Private? No (public for Vercel). Swap to private if needed and add Vercel Git integration.

## Cron
`carnival-casino-cruise-finder-refresh` (6h + daily 09:00) calls `refreshCruises` to keep prices fresh.

---
Generated from Hatch space `carnival-casino-cruise-finder` • 2026-05-27
