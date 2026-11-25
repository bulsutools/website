import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tools } from "../data/tools";
import { githubHeaders, listOrgRepos } from "./github-org-contributors";
import { SITE_ORIGIN } from "./site-meta";
import type { AskChunk } from "./ask-search";

/**
 * Build-time corpus for /ask. Emitted as dist/ask-corpus.json by
 * src/pages/ask-corpus.json.ts during `astro build`.
 *
 * Sources: src/data/tools.ts, public/llms.txt (the distilled copy of the
 * about/people/site pages), and README excerpts of public org repos fetched
 * through the GitHub API, same pattern as the contributors list.
 *
 * ponytail: READMEs are truncated, not chunked — one chunk per repo keeps
 * the index small and BM25 handles the rest. Upgrade path for scale:
 * chunk READMEs and move retrieval to Workers AI embeddings + Vectorize.
 */

const GITHUB_ORG = "bulsutools";
const README_MAX_CHARS = 6000;

function toolChunks(): AskChunk[] {
  const perTool = tools.map((tool) => ({
    id: `tool-${tool.id}`,
    title: tool.name,
    url: tool.href,
    text: [
      tool.description,
      tool.statusLabel,
      ...tool.tags,
      tool.note ?? "",
      tool.githubHref ? `Source code: ${tool.githubHref}` : "",
    ]
      .filter(Boolean)
      .join(". "),
  }));

  // One chunk listing every tool, so "what tools does bulsutools have"
  // has a single dense answer instead of three separate cards.
  const overview: AskChunk = {
    id: "tools-overview",
    title: "bulsu.tools tools",
    url: `${SITE_ORIGIN}/#tools`,
    text: [
      `bulsu.tools builds ${tools.length} free, open-source tools for Bulacan State University students.`,
      ...tools.map(
        (tool) =>
          `${tool.name}: ${tool.description} (${tool.href}, source ${tool.githubHref ?? "n/a"})`,
      ),
    ].join(" "),
  };
  return [overview, ...perTool];
}

/**
 * llms.txt already summarizes the site for crawlers; each "- [label](url)"
 * bullet becomes one chunk with its own source link, under its "## " heading.
 */
async function llmsTxtChunks(): Promise<AskChunk[]> {
  // import.meta.url points into dist/ after bundling; the build always runs
  // from the project root.
  const raw = await readFile(join(process.cwd(), "public/llms.txt"), "utf8");
  const chunks: AskChunk[] = [];
  let section = "";
  let intro: string[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      section = trimmed.slice(3).trim();
      continue;
    }
    const bullet = trimmed.match(/^- \[([^\]]+)\]\(([^)]+)\):?\s*(.*)$/);
    if (bullet) {
      const [, label, url, rest] = bullet;
      chunks.push({
        id: `llms-${chunks.length}`,
        title: label,
        url,
        text: [section, label, rest].filter(Boolean).join(". "),
      });
      continue;
    }
    if (trimmed.startsWith(">") || trimmed.startsWith("# ")) {
      intro.push(trimmed.replace(/^#+\s*/, "").replace(/^>\s*/, ""));
    }
  }

  const introText = intro.filter(Boolean).join(" ");
  if (introText) {
    chunks.unshift({
      id: "llms-intro",
      title: "bulsu.tools",
      url: SITE_ORIGIN,
      text: introText,
    });
  }
  return chunks;
}

async function fetchReadmeRaw(repo: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_ORG}/${repo}/readme`,
    {
      headers: {
        ...githubHeaders(),
        Accept: "application/vnd.github.raw",
      },
    },
  );
  if (!res.ok) return null;
  const text = await res.text();
  return text.slice(0, README_MAX_CHARS);
}

async function repoReadmeChunks(): Promise<AskChunk[]> {
  const repos = await listOrgRepos();
  const results = await Promise.all(
    repos.map(async (repo) => {
      const readme = await fetchReadmeRaw(repo);
      if (!readme?.trim()) return null;
      return {
        id: `repo-${repo}`,
        title: `${repo} README`,
        url: `https://github.com/${GITHUB_ORG}/${repo}`,
        text: readme,
      } satisfies AskChunk;
    }),
  );
  return results.filter((c): c is AskChunk => c !== null);
}

export async function buildAskCorpus(): Promise<AskChunk[]> {
  const [siteChunks, readmeChunks] = await Promise.all([
    llmsTxtChunks().catch(() => [] as AskChunk[]),
    // READMEs are nice-to-have; a GitHub outage must not fail the build.
    repoReadmeChunks().catch(() => [] as AskChunk[]),
  ]);
  return [...toolChunks(), ...siteChunks, ...readmeChunks];
}

