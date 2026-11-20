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

## Stack

- **Framework:** Astro (static org landing)
- **Node:** ≥ 22.12
- **Package manager:** npm (`package-lock.json`)
- **Deploy:** Cloudflare Pages (`bulsu-tools` project)

## Branches and deploy

- **Default branch:** `main` → Pages production via `.github/workflows/deploy-cloudflare.yml`
- Feature work: branch → PR to `main` (Pages preview on branch `pr-<n>`)
- Pages account: `karunungan` (`ee40d544c91d2b9f1bd9e0f7b2b304b8`); zone `bulsu.tools` lives there too

## Verify before done

| Step | When |
| --- | --- |
| `npm run build` | Before commit/PR on substantive changes |
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
 pages/ # index, about, people, privacy, terms
 data/ # tools.ts
 lib/ # site-meta, github-org-contributors
 styles/ # global.css
public/ # logo, screenshots, OG image
```

## Commits

- Conventional Commits: `feat(hero): …`, `fix: …`, `docs: …`
- Update README when changing scripts or deploy steps
