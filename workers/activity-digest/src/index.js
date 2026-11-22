import {
  fetchDigest,
  listOrgRepos,
  buildDiscordContent,
} from "./digest.js";

const WINDOW_MS = 24 * 60 * 60 * 1000;

async function buildDigest(env) {
  if (!env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN secret is not set");
  }
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const repoNames = await listOrgRepos(env.GITHUB_TOKEN);
  return fetchDigest(
    env.GITHUB_TOKEN,
    repoNames,
    since,
    new Date().toISOString(),
  );
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname !== "/api/digest" && pathname !== "/api/digest/") {
      return new Response("Not found", { status: 404 });
    }
    try {
      const digest = await buildDigest(env);
      return Response.json(digest, {
        headers: { "cache-control": "public, max-age=300" },
      });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "digest failed" },
        { status: 502 },
      );
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runScheduled(env));
  },
};

async function runScheduled(env) {
  // Discord post is opt-in: no webhook secret, no post. The /digest page reads
  // /api/digest live at build time, so the cron only exists for the webhook.
  if (!env.DISCORD_WEBHOOK_URL) return;
  const digest = await buildDigest(env);
  await fetch(env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: buildDiscordContent(digest) }),
  });
}
