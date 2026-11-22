# bulsu-tools-mcp

Cloudflare Worker exposing an MCP (Streamable HTTP) endpoint for the bulsutools org directory. Public, read-only, no auth.

- Endpoint: `POST https://bulsu-tools-mcp.<account>.workers.dev/mcp` (JSON-RPC 2.0)
- `GET /` returns a small discovery JSON

## Tools

| Tool | Returns |
| ---- | ------- |
| `list_tools` | Every entry from `src/data/tools.ts`: id, name, URL, repo, description, status, tags |
| `get_tool(name)` | One project by id or name; `isError` result for unknown names |
| `list_people(limit?)` | Top contributors across org repos, via `src/lib/github-org-contributors.ts` |
| `search_org(query)` | Keyword match over tools plus public `github.com/bulsutools` repos |

The worker imports `src/data/tools.ts` and `src/lib/github-org-contributors.ts` directly, so site data stays the single source of truth. `search_org` uses plain keyword matching; Workers AI embeddings are a possible upgrade.

## Secrets

`GITHUB_TOKEN` is optional and only raises GitHub API rate limits. Without it the worker still works on unauthenticated limits (60 req/hr per isolate-ish; `list_people` makes many calls, so set the secret for reliable use).

```sh
wrangler secret put GITHUB_TOKEN
```

Never commit the token; it stays server-side in worker secrets.

## Deploy

```sh
cd workers/org-mcp
wrangler deploy
```

Requires Cloudflare account `karunungan` (`ee40d544c91d2b9f1bd9e0f7b2b304b8`, same as Pages). No custom domain or routes configured; the worker is reachable on its `*.workers.dev` hostname.

## Test locally

```sh
wrangler dev
# in another shell:
curl -s localhost:8787/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
curl -s localhost:8787/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_tools","arguments":{}}}'
```
