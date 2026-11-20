# bulsu.tools

Org landing site for [bulsutools](https://github.com/bulsutools), which makes free utilities for the Bulacan State University community.

## Stack

- Astro 7 (static)
- Node ≥ 22.12
- npm (`package-lock.json`)
- Vercel

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

- Default branch: `main` → Vercel production
- Feature work: branch → PR to `main`

## Tools listed

- [Geary](https://geary.bulsu.tools) — student handbook
- [GWA Calculator](https://gwa-calculator.bulsu.tools) — GWA and honors estimator
- [Room TBA](https://room-tba.bulsu.tools) — Malolos campus map (fork of uplbtools/room-tba)

## License

See [LICENSE](LICENSE).
