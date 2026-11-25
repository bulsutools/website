// Pure helpers for the activity-digest worker. No workerd APIs here so the
// logic runs under plain `node --test`.

export const ORG = "bulsutools";
export const SITE_URL = "https://bulsu.tools";

// Same exclusions as src/lib/github-org-contributors.ts: pre-fork snapshots
// and org template repos are not products.
const EXCLUDED_REPOS = new Set([
  "demo-repository",
  "codespace",
  "devcontainer",
  "devcontainer-personal",
]);

const HIDDEN_AUTHOR_PATTERNS = [
  /\[bot\]$/i,
  /(?:^|[-_])bot$/i,
  /cursor/i,
  /copilot/i,
  /devin/i,
  /sweep/i,
  /renovate/i,
  /dependabot/i,
  /semantic-release/i,
  /allcontributors/i,
  /greenkeeper/i,
  /codecov/i,
];

export function isBotAuthor(login) {
  return HIDDEN_AUTHOR_PATTERNS.some((pattern) => pattern.test(login));
}

export function githubHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "bulsu.tools-activity-digest",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Public, non-archived org repos, minus pre-fork snapshots and templates. */
export async function listOrgRepos(token) {
  const repos = [];
  for (let page = 1; page <= 5; page += 1) {
    const res = await fetch(
      `https://api.github.com/orgs/${ORG}/repos?per_page=100&page=${page}&type=public`,
      { headers: githubHeaders(token) },
    );
    if (!res.ok) throw new Error(`org repos request failed: ${res.status}`);
    const batch = await res.json();
    if (!batch.length) break;
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos
    .filter(
      (repo) =>
        !repo.archived &&
        !repo.name.endsWith("-pre-fork") &&
        !EXCLUDED_REPOS.has(repo.name),
    )
    .map((repo) => repo.name);
}

const PER_CATEGORY_LIMIT = 10;

/**
 * One GraphQL query for the whole org. Repo names are aliased `repo0`,
 * `repo1`, ... because GraphQL aliases cannot contain hyphens.
 */
export function buildActivityQuery(repoNames, sinceISO) {
  const selections = repoNames
    .map(
      (name, i) => `
    repo${i}: repository(owner: "${ORG}", name: "${name}") {
      name
      url
      releases(first: 10, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes { name tagName url createdAt }
      }
      pullRequests(first: 15, states: [OPEN, MERGED], orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes {
          number title url state createdAt updatedAt mergedAt
          author { login }
        }
      }
      issues(first: 15, states: [OPEN], orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes { number title url createdAt updatedAt author { login } }
      }
      defaultBranchRef {
        target {
          ... on Commit {
            history(since: "${sinceISO}", first: 30) {
              nodes {
                oid committedDate messageHeadline
                author { name user { login } }
              }
            }
          }
        }
      }
    }`,
    )
    .join("\n");
  return `query {${selections}\n}`;
}

function withinWindow(iso, since) {
  return typeof iso === "string" && iso >= since;
}

function authorLogin(author) {
  if (!author) return null;
  const login = author.user?.login ?? author.login ?? null;
  return login && !isBotAuthor(login) ? login : null;
}

/**
 * Turn the aliased GraphQL response into a digest. Repos with no in-window
 * activity are kept with empty arrays so the page can show "no activity".
 */
export function normalizeDigest(data, repoNames, sinceISO, generatedAt) {
  const since = sinceISO;
  const repos = repoNames.map((name, i) => {
    const repo = data?.[`repo${i}`];
    const empty = { name, url: repo?.url ?? `https://github.com/${ORG}/${name}`, commits: [], pullRequests: [], issues: [], releases: [] };
    if (!repo) return empty;

    const commits = (repo.defaultBranchRef?.target?.history?.nodes ?? [])
      .filter((c) => {
        if (!withinWindow(c.committedDate, since)) return false;
        const login = c.author?.user?.login;
        // Bot commits (dependabot merges etc.) are noise in a human digest.
        return !(login && isBotAuthor(login));
      })
      .map((c) => ({
        message: c.messageHeadline,
        author: authorLogin(c.author) ?? c.author?.name ?? "unknown",
        date: c.committedDate,
        url: `${repo.url}/commit/${c.oid}`,
      }))
      .slice(0, PER_CATEGORY_LIMIT);

    const pullRequests = (repo.pullRequests?.nodes ?? [])
      .filter(
        (pr) =>
          withinWindow(pr.updatedAt, since) ||
          withinWindow(pr.mergedAt, since) ||
          withinWindow(pr.createdAt, since),
      )
      .map((pr) => ({
        number: pr.number,
        title: pr.title,
        url: pr.url,
        author: authorLogin(pr.author),
        state: pr.state,
        merged: Boolean(pr.mergedAt),
        createdAt: pr.createdAt,
      }))
      .slice(0, PER_CATEGORY_LIMIT);

    const issues = (repo.issues?.nodes ?? [])
      .filter(
        (issue) =>
          withinWindow(issue.updatedAt, since) ||
          withinWindow(issue.createdAt, since),
      )
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        url: issue.url,
        author: authorLogin(issue.author),
        createdAt: issue.createdAt,
      }))
      .slice(0, PER_CATEGORY_LIMIT);

    const releases = (repo.releases?.nodes ?? [])
      .filter((release) => withinWindow(release.createdAt, since))
      .map((release) => ({
        name: release.name,
        tagName: release.tagName,
        url: release.url,
        createdAt: release.createdAt,
      }))
      .slice(0, PER_CATEGORY_LIMIT);

    return { name, url: repo.url, commits, pullRequests, issues, releases };
  });

  return { generatedAt, since: sinceISO, windowHours: 24, repos };
}

export async function fetchDigest(token, repoNames, sinceISO, generatedAt) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ query: buildActivityQuery(repoNames, sinceISO) }),
  });
  if (!res.ok) throw new Error(`graphql request failed: ${res.status}`);
  const payload = await res.json();
  if (payload.errors?.length) {
    throw new Error(`graphql errors: ${payload.errors[0].message}`);
  }
  return normalizeDigest(payload.data, repoNames, sinceISO, generatedAt);
}

export function digestHasActivity(digest) {
  return digest.repos.some(
    (repo) =>
      repo.commits.length ||
      repo.pullRequests.length ||
      repo.issues.length ||
      repo.releases.length,
  );
}

function totals(digest) {
  return digest.repos.reduce(
    (acc, repo) => ({
      commits: acc.commits + repo.commits.length,
      pullRequests: acc.pullRequests + repo.pullRequests.length,
      issues: acc.issues + repo.issues.length,
      releases: acc.releases + repo.releases.length,
    }),
    { commits: 0, pullRequests: 0, issues: 0, releases: 0 },
  );
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Discord message content. Empty days still post a one-liner. */
export function buildDiscordContent(digest, digestUrl = `${SITE_URL}/digest`) {
  const t = totals(digest);
  const parts = [
    plural(t.commits, "commit"),
    `${t.pullRequests} PR${t.pullRequests === 1 ? "" : "s"}`,
    `${t.issues} issue${t.issues === 1 ? "" : "s"}`,
    plural(t.releases, "release"),
  ];
  const activeRepos = digest.repos.filter(
    (repo) =>
      repo.commits.length ||
      repo.pullRequests.length ||
      repo.issues.length ||
      repo.releases.length,
  ).length;

  const highlights = [];
  for (const repo of digest.repos) {
    for (const pr of repo.pullRequests.filter((p) => p.merged).slice(0, 2)) {
      highlights.push(`${repo.name}#${pr.number} ${pr.title}`);
    }
    for (const release of repo.releases.slice(0, 1)) {
      highlights.push(`${repo.name} ${release.tagName || release.name}`);
    }
    if (highlights.length >= 5) break;
  }

  const lines = [
    `bulsutools activity, last 24h: ${parts.join(", ")} across ${activeRepos} repo${activeRepos === 1 ? "" : "s"}.`,
  ];
  if (highlights.length) lines.push(highlights.slice(0, 5).join("\n"));
  lines.push(digestUrl);
  // Discord caps message content at 2000 chars; titles are already short.
  return lines.join("\n").slice(0, 1900);
}
