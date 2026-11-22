import { tools, type ToolEntry } from "../../../src/data/tools";
import { fetchOrgTopContributors } from "../../../src/lib/github-org-contributors";

interface Env {
  /** Optional GitHub token for higher API rate limits. Set via `wrangler secret put GITHUB_TOKEN`. */
  GITHUB_TOKEN?: string;
}

const SERVER_INFO = { name: "bulsu-tools-mcp", version: "0.1.0" };
const PROTOCOL_VERSION = "2025-06-18";
const GITHUB_ORG = "bulsutools";

// --- MCP tool definitions -------------------------------------------------

const TOOL_DEFS = [
  {
    name: "list_tools",
    description:
      "List every bulsutools project on bulsu.tools with its URL, description, status, and GitHub repo.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_tool",
    description:
      "Get details for one bulsutools project by id or name (e.g. 'geary', 'GWA Calculator', 'room-tba').",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tool id or display name." },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "list_people",
    description:
      "List top contributors across bulsutools GitHub repositories, ranked by commits.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Max people to return (default 12, max 50)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_org",
    description:
      "Keyword search across bulsutools tools (name, description, tags) and public GitHub org repos (name, description).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search query." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

// --- Tool implementations -------------------------------------------------

function summarizeTool(tool: ToolEntry) {
  return {
    id: tool.id,
    name: tool.name,
    url: tool.href,
    repo: tool.githubHref ?? null,
    description: tool.description,
    status: tool.status,
    statusLabel: tool.statusLabel,
    tags: tool.tags,
    note: tool.note ?? null,
    stats: tool.stats ?? null,
  };
}

function findTool(name: string): ToolEntry | undefined {
  const needle = name.trim().toLowerCase();
  return tools.find(
    (tool) =>
      tool.id.toLowerCase() === needle ||
      tool.name.toLowerCase() === needle ||
      tool.name.toLowerCase().replace(/\s+/g, "-") === needle,
  );
}

type OrgRepo = {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  archived: boolean;
  fork: boolean;
};

let orgReposPromise: Promise<OrgRepo[]> | null = null;

function listOrgRepos(token?: string): Promise<OrgRepo[]> {
  // ponytail: cached per isolate; repo list changes rarely, staleness is fine.
  orgReposPromise ??= (async () => {
    const repos: OrgRepo[] = [];
    for (let page = 1; page <= 3; page++) {
      const res = await fetch(
        `https://api.github.com/orgs/${GITHUB_ORG}/repos?per_page=100&page=${page}&type=public`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "bulsu.tools-mcp",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (!res.ok) break;
      const batch = (await res.json()) as OrgRepo[];
      repos.push(...batch);
      if (batch.length < 100) break;
    }
    return repos;
  })();
  return orgReposPromise;
}

function score(haystack: string, terms: string[]): number {
  const hay = haystack.toLowerCase();
  return terms.filter((term) => hay.includes(term)).length;
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  env: Env,
): Promise<unknown> {
  switch (name) {
    case "list_tools":
      return tools.map(summarizeTool);

    case "get_tool": {
      const toolName = typeof args.name === "string" ? args.name : "";
      const tool = toolName ? findTool(toolName) : undefined;
      if (!tool) {
        throw new Error(
          `Unknown tool "${toolName}". Use list_tools to see valid names.`,
        );
      }
      return { ...summarizeTool(tool), actionLabel: tool.actionLabel };
    }

    case "list_people": {
      const raw = args.limit;
      const limit =
        typeof raw === "number" && Number.isFinite(raw)
          ? Math.min(Math.max(Math.trunc(raw), 1), 50)
          : 12;
      return fetchOrgTopContributors(limit, env.GITHUB_TOKEN);
    }

    case "search_org": {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      if (!query) throw new Error("search_org requires a non-empty query.");
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

      const toolHits = tools
        .map((tool) => ({
          tool: summarizeTool(tool),
          score: score(
            [
              tool.name,
              tool.id,
              tool.description,
              tool.tags.join(" "),
              tool.githubHref ?? "",
            ].join(" "),
            terms,
          ),
        }))
        .filter((hit) => hit.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((hit) => hit.tool);

      const repos = await listOrgRepos(env.GITHUB_TOKEN);
      const repoHits = repos
        .filter((repo) => !repo.archived)
        .map((repo) => ({
          repo: {
            name: repo.name,
            url: repo.html_url,
            description: repo.description,
            homepage: repo.homepage,
            fork: repo.fork,
          },
          score: score(
            [repo.name, repo.description ?? "", repo.homepage ?? ""].join(" "),
            terms,
          ),
        }))
        .filter((hit) => hit.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((hit) => hit.repo);

      return { query, tools: toolHits, repos: repoHits };
    }

    default:
      throw new Error(`Unknown tool "${name}".`);
  }
}

// --- JSON-RPC / MCP transport ----------------------------------------------

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function ok(id: string | number | null | undefined, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function fail(id: string | number | null | undefined, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function handleMessage(
  msg: JsonRpcRequest,
  env: Env,
): Promise<object | null> {
  const { id, method, params } = msg;

  // Notifications carry no id and get no response.
  if (id === undefined || id === null) {
    return null;
  }

  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion:
          typeof params?.protocolVersion === "string"
            ? params.protocolVersion
            : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Read-only directory of bulsutools projects and people. Data source: bulsu.tools / github.com/bulsutools.",
      });

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, { tools: TOOL_DEFS });

    case "tools/call": {
      const name = params?.name;
      const args =
        params?.arguments && typeof params.arguments === "object"
          ? (params.arguments as Record<string, unknown>)
          : {};
      if (typeof name !== "string") {
        return fail(id, -32602, "tools/call requires a string 'name'.");
      }
      try {
        const result = await callTool(name, args, env);
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      } catch (error) {
        return ok(id, {
          content: [
            { type: "text", text: error instanceof Error ? error.message : String(error) },
          ],
          isError: true,
        });
      }
    }

    default:
      return fail(id, -32601, `Method not found: ${String(method)}`);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- Worker entry -----------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return jsonResponse({
        name: SERVER_INFO.name,
        description:
          "MCP server for the bulsutools org directory. POST JSON-RPC to /mcp.",
        mcpEndpoint: `${url.origin}/mcp`,
      });
    }

    if (url.pathname !== "/mcp" && url.pathname !== "/mcp/") {
      return jsonResponse({ error: "Not found" }, 404);
    }

    if (request.method === "GET" || request.method === "DELETE") {
      // No server-initiated stream or session teardown; stateless server.
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(fail(null, -32700, "Parse error"), 400);
    }

    const messages = Array.isArray(body) ? body : [body];
    const responses = (
      await Promise.all(
        messages.map(async (msg) => {
          if (
            !msg ||
            typeof msg !== "object" ||
            typeof (msg as JsonRpcRequest).method !== "string"
          ) {
            const id = (msg as JsonRpcRequest | null)?.id;
            return fail(id ?? null, -32600, "Invalid Request");
          }
          return handleMessage(msg as JsonRpcRequest, env);
        }),
      )
    ).filter((res): res is object => res !== null);

    if (responses.length === 0) {
      return new Response(null, { status: 202 });
    }
    return jsonResponse(Array.isArray(body) ? responses : responses[0]);
  },
};
