# bulsu.tools Agent Guide

**Human developers:** start with [README.md](README.md).

This file covers the **org landing site** for [bulsutools](https://github.com/bulsutools).

## Doc map

| When | Read |
| --- | --- |
| Site structure | `src/pages/`, `src/components/` |
| Global styles | [src/styles/global.css](src/styles/global.css) |
| Tool listings | [src/data/tools.ts](src/data/tools.ts) |
| Site URLs / OG meta | [src/lib/site-meta.ts](src/lib/site-meta.ts) |
| Cloudflare Workers (MCP endpoint, redirects, digest) | `workers/*/README.md` |
| Activity digest worker | [workers/activity-digest/README.md](workers/activity-digest/README.md) |

## Stack

- **Framework:** Astro (static org landing)
- **Node:** ≥ 22.12
- **Package manager:** npm (`package-lock.json`)
- **Deploy:** Cloudflare Pages (`bulsu-tools` project); Workers in `workers/` deploy separately via `wrangler deploy` (see each worker's README)
- Workers share `src/data/tools.ts` and `src/lib/github-org-contributors.ts` by direct import; keep them dependency-free of Astro

## Branches and deploy

- **Default branch:** `main` → Pages production via `.github/workflows/deploy-cloudflare.yml`
- Feature work: branch → PR to `main` (Pages preview on branch `pr-<n>`)
- Pages account: `karunungan` (`ee40d544c91d2b9f1bd9e0f7b2b304b8`); zone `bulsu.tools` lives there too

## Verify before done

| Step | When |
| --- | --- |
| `npm run build` | Before commit/PR on substantive changes |
| `npm test` | Worker digest logic (`workers/activity-digest`) |
| `npm run dev` | UI/content changes: spot-check locally |
| 320px / 768px | Layout changes: no overflow; text wraps or truncates |

## UI guardrails

- Keep the warm maroon + light palette in `src/styles/global.css` (shared with Room TBA)
- **No decorative animations**: functional transitions only
- Buttons and chips must stay inside containers at narrow widths

## Architecture (short)

```
src/
 components/ # Hero, ToolsGrid, About, Community, Footer, …
 layouts/ # Layout.astro
 pages/ # index, about, people, digest, privacy, terms
 data/ # tools.ts
 lib/ # site-meta, github-org-contributors
 styles/ # global.css
public/ # logo, screenshots, OG image
workers/ # org-mcp (MCP endpoint), messenger-redirect, activity-digest; not part of the Pages build
```

## Workers

- `workers/activity-digest/` — `GET /api/digest` JSON + daily cron Discord post; `/digest` page fetches the API at build. Secrets (`GITHUB_TOKEN`, optional `DISCORD_WEBHOOK_URL`) via `wrangler secret put`; deploy with `wrangler deploy` from `workers/activity-digest/`. Setup detail in its README.

## Commits

- Conventional Commits: `feat(hero): …`, `fix: …`, `docs: …`
- Update README when changing scripts or deploy steps
