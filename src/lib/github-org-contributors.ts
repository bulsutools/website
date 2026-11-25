export type OrgContributor = {
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
};

const GITHUB_ORG = "bulsutools";
const EXCLUDED_REPOS = new Set([
  "demo-repository",
  "codespace",
  "devcontainer",
  "devcontainer-personal",
]);
const HIDDEN_LOGINS = new Set([
  "dependabot[bot]",
  "dependabot",
  "github-actions[bot]",
  "renovate[bot]",
  "semantic-release-bot",
  "cursoragent",
  "cursor-agent",
  "copilot-swe-agent[bot]",
  "github-copilot[bot]",
  "devin-ai-integration[bot]",
  "sweep-ai[bot]",
  "allcontributors[bot]",
  "astrobot-houston",
]);

const HIDDEN_LOGIN_PATTERNS = [
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

type GithubRepo = {
  name: string;
  archived: boolean;
  fork: boolean;
  forked_at?: string | null;
  default_branch?: string;
  parent?: {
    full_name?: string;
    default_branch?: string;
    owner?: { login?: string; type?: string } | null;
  } | null;
};

type GithubUserProfile = {
  name?: string | null;
};

export function isVisibleGithubContributor(login: string): boolean {
  const key = login.toLowerCase();
  if (HIDDEN_LOGINS.has(key)) return false;
  return !HIDDEN_LOGIN_PATTERNS.some((pattern) => pattern.test(login));
}

export function formatGithubContributions(count: number): string {
  return count === 1 ? "1 commit" : `${count.toLocaleString()} commits`;
}

export function githubHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "bulsu.tools",
  };
  const resolved =
    token ??
    (typeof process !== "undefined" ? process.env.GITHUB_TOKEN : undefined);
  if (resolved) {
    headers.Authorization = `Bearer ${resolved}`;
  }
  return headers;
}

async function githubGet<T>(url: string, token?: string): Promise<T | null> {
  const res = await fetch(url, { headers: githubHeaders(token) });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function listOrgRepos(token?: string): Promise<string[]> {
  const repos: GithubRepo[] = [];
  let page = 1;

  while (page <= 5) {
    const batch = await githubGet<GithubRepo[]>(
      `https://api.github.com/orgs/${GITHUB_ORG}/repos?per_page=100&page=${page}&type=public`,
      token,
    );
    if (!batch?.length) break;
    repos.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  // The bulsutools products are themselves forks (of uplbtools and other
  // upstreams), so `fork` can't be used as an exclusion here. Pre-fork
  // snapshots and devcontainer templates are excluded by name instead.
  return repos
    .filter(
      (repo) =>
        !repo.archived &&
        !repo.name.endsWith("-pre-fork") &&
        !EXCLUDED_REPOS.has(repo.name),
    )
    .map((repo) => repo.name);
}

/** The org repo list endpoint omits `parent`; single-repo GET has it. */
async function getRepoMeta(
  name: string,
  token?: string,
): Promise<GithubRepo | null> {
  return githubGet<GithubRepo>(
    `https://api.github.com/repos/${GITHUB_ORG}/${name}`,
    token,
  );
}

async function listRepoContributors(
  repoFullName: string,
  token?: string,
): Promise<GithubApiContributor[]> {
  const contributors: GithubApiContributor[] = [];
  let page = 1;

  while (page <= 5) {
    const batch = await githubGet<GithubApiContributor[]>(
      `https://api.github.com/repos/${repoFullName}/contributors?per_page=100&page=${page}&anon=false`,
      token,
    );
    if (!batch?.length) break;
    contributors.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  return contributors;
}

type GithubApiContributor = {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: string;
};

type GithubCompareCommit = {
  author: {
    login?: string;
    avatar_url?: string;
    html_url?: string;
  } | null;
};

type GithubCompare = {
  commits?: GithubCompareCommit[];
};

async function listForkAheadCommits(
  repo: {
    name: string;
    defaultBranch: string;
    parentFullName: string | null;
    parentBranch: string | null;
  },
  token?: string,
): Promise<GithubCompareCommit[]> {
  // These repos are forks, so the contributors endpoint counts the entire
  // upstream history. The compare endpoint lists only commits the fork has
  // that its upstream doesn't, which is the work bulsutools people did.
  if (!repo.parentFullName) return [];
  const base = repo.parentBranch ?? "main";
  const head = `${GITHUB_ORG}:${repo.defaultBranch}`;
  const compare = await githubGet<GithubCompare>(
    `https://api.github.com/repos/${repo.parentFullName}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
    token,
  );
  // ponytail: compare returns at most 250 commits; a fork that far ahead
  // would undercount. Repos here are nowhere near that.
  return compare?.commits ?? [];
}

async function loadDisplayName(
  login: string,
  token?: string,
): Promise<string | null> {
  const profile = await githubGet<GithubUserProfile>(
    `https://api.github.com/users/${login}`,
    token,
  );
  const name = profile?.name?.trim();
  return name || null;
}

export async function fetchOrgTopContributors(
  limit = 12,
  token?: string,
): Promise<OrgContributor[]> {
  const repos = await listOrgRepos(token);
  const totals = new Map<
    string,
    Pick<OrgContributor, "login" | "avatarUrl" | "profileUrl" | "contributions">
  >();

  const add = (
    login: string,
    contributions: number,
    avatarUrl: string,
    profileUrl: string,
  ) => {
    const existing = totals.get(login);
    if (existing) {
      existing.contributions += contributions;
      return;
    }
    totals.set(login, { login, avatarUrl, profileUrl, contributions });
  };

  for (const repoName of repos) {
    const meta = await getRepoMeta(repoName, token);
    if (!meta) continue;

    const commits = await listForkAheadCommits(
      {
        name: meta.name,
        defaultBranch: meta.default_branch ?? "main",
        parentFullName: meta.parent?.full_name ?? null,
        parentBranch: meta.parent?.default_branch ?? null,
      },
      token,
    );
    for (const commit of commits) {
      const login = commit.author?.login;
      if (!login || !isVisibleGithubContributor(login)) continue;
      add(
        login,
        1,
        commit.author?.avatar_url ?? `https://github.com/${login}.png`,
        commit.author?.html_url ?? `https://github.com/${login}`,
      );
    }

    // When the "upstream" is a person's own repo (geary <- shnflrsc/geary,
    // gwa-calculator <- ReyMiguel/gwa-calculator) it is part of the project,
    // not foreign history. Count its contributors too. Org-owned parents
    // (uplbtools/room-tba) stay excluded.
    const parent = meta.parent;
    if (parent?.full_name && parent.owner?.type === "User") {
      const rows = await listRepoContributors(parent.full_name, token);
      for (const row of rows) {
        if (row.type !== "User" || !isVisibleGithubContributor(row.login)) {
          continue;
        }
        add(row.login, row.contributions, row.avatar_url, row.html_url);
      }
    }
  }

  return rankAndName([...totals.values()], limit, token);
}

/** Contributors to one repo, ranked by commits. Same shape as the org list. */
export async function fetchRepoTopContributors(
  repo: string,
  limit = 24,
  token?: string,
): Promise<OrgContributor[]> {
  const meta = await getRepoMeta(repo, token);
  if (!meta) return [];
  const commits = await listForkAheadCommits(
    {
      name: meta.name,
      defaultBranch: meta.default_branch ?? "main",
      parentFullName: meta.parent?.full_name ?? null,
      parentBranch: meta.parent?.default_branch ?? null,
    },
    token,
  );
  const totals = new Map<
    string,
    Pick<OrgContributor, "login" | "avatarUrl" | "profileUrl" | "contributions">
  >();
  for (const commit of commits) {
    const login = commit.author?.login;
    if (!login || !isVisibleGithubContributor(login)) continue;
    const existing = totals.get(login);
    if (existing) {
      existing.contributions += 1;
      continue;
    }
    totals.set(login, {
      login,
      avatarUrl:
        commit.author?.avatar_url ?? `https://github.com/${login}.png`,
      profileUrl:
        commit.author?.html_url ?? `https://github.com/${login}`,
      contributions: 1,
    });
  }
  return rankAndName([...totals.values()], limit, token);
}

/**
 * Sort by commits, take the top slice, then fill in display names. Names come
 * from a per-user request, so this deliberately runs after the slice.
 */
async function rankAndName(
  people: Omit<OrgContributor, "name">[],
  limit: number,
  token?: string,
): Promise<OrgContributor[]> {
  const top = [...people]
    .sort((a, b) => b.contributions - a.contributions)
    .slice(0, limit);

  const names = await Promise.all(
    top.map(async (person) => ({
      login: person.login,
      name: await loadDisplayName(person.login, token),
    })),
  );
  const nameByLogin = new Map(names.map((entry) => [entry.login, entry.name]));

  return top.map((person) => ({
    ...person,
    name: nameByLogin.get(person.login) ?? null,
  }));
}
