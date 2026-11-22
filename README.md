# bulsu.tools

Org landing site for [bulsutools](https://github.com/bulsutools), which makes free utilities for the Bulacan State University community.

## Stack

- Astro 7 (static)
- Node ≥ 22.12
- npm (`package-lock.json`)
- Cloudflare Pages (`bulsu-tools` project, `karunungan` account)

## Develop

```sh
npm install
npm run dev
```

| Command | Action |
| --- | --- |
| `npm run dev` | Local server |
| `npm run build` | Production build to `./dist/` |
| `npm run preview` | Preview the build |
| `npm run generate:og` | Regenerate the Open Graph image |

## Deploy

- GitHub Actions (`.github/workflows/deploy-cloudflare.yml`) builds and runs `wrangler pages deploy` on every push to `main` (production) and PR (preview branch `pr-<n>`)
- Required repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (`ee40d544c91d2b9f1bd9e0f7b2b304b8`)
- Custom domains: `bulsu.tools`, `www.bulsu.tools`; fallback `bulsu-tools-7jl.pages.dev`
- Manual deploy: `CLOUDFLARE_ACCOUNT_ID=ee40d544c91d2b9f1bd9e0f7b2b304b8 wrangler pages deploy dist --project-name=bulsu-tools --branch=main`
- Feature work: branch → PR to `main`

## Workers

- `workers/org-mcp` — MCP (Streamable HTTP) endpoint for the org directory: `list_tools`, `get_tool`, `list_people`, `search_org`. Public, read-only. See [workers/org-mcp/README.md](workers/org-mcp/README.md) for deploy and secrets.
- `workers/messenger-redirect` — Messenger short-link redirects (see its README)

## Tools listed

- [Geary](https://geary.bulsu.tools) — student handbook
- [GWA Calculator](https://gwa-calculator.bulsu.tools) — GWA and honors estimator
- [Room TBA](https://room-tba.bulsu.tools) — Malolos campus map (fork of uplbtools/room-tba)

## License

See [LICENSE](LICENSE).
