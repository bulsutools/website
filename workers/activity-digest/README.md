# bulsu-activity-digest

Cloudflare Worker behind issue bulsutools/website#3. Serves the org activity
digest as JSON and posts a daily summary to Discord.

## Endpoints

- `GET /api/digest` — JSON digest of the last 24h across public
  `bulsutools` org repos (commits on default branches, open/merged PRs,
  open issues, releases). One GraphQL query per request.
- Cron `0 2 * * *` — computes the same digest and POSTs it to Discord.

## Setup

```sh
cd workers/activity-digest
npm install -g wrangler   # or use npx
wrangler secret put GITHUB_TOKEN   # fine-grained PAT, public repo read
wrangler secret put DISCORD_WEBHOOK_URL   # optional; cron posts only when set
wrangler deploy
```

`GITHUB_TOKEN` is required for both routes. `DISCORD_WEBHOOK_URL` is optional:
without it the cron is a no-op and `/api/digest` still works. The token and
webhook never live in the repo.

The `bulsu.tools/api/digest*` and `www.bulsu.tools/api/digest*` routes in
`wrangler.toml` put the JSON next to the Pages site. The `/digest` page on the
site fetches `${SITE_ORIGIN}/api/digest` at build time; set
`PUBLIC_DIGEST_API_URL` to override (e.g. the `workers.dev` URL before routes
are live).

## Test

```sh
node --test workers/activity-digest/test/digest.test.mjs
```
