import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildActivityQuery,
  buildDiscordContent,
  digestHasActivity,
  normalizeDigest,
} from "../src/digest.js";

const SINCE = "2026-01-10T00:00:00.000Z";
const GENERATED = "2026-01-11T00:00:00.000Z";

test("buildActivityQuery aliases repos and embeds the window", () => {
  const query = buildActivityQuery(["room-tba", "geary"], SINCE);
  assert.match(query, /repo0: repository\(owner: "bulsutools", name: "room-tba"\)/);
  assert.match(query, /repo1: repository\(owner: "bulsutools", name: "geary"\)/);
  assert.match(query, new RegExp(`history\\(since: "${SINCE}"`));
});

test("normalizeDigest keeps only in-window items and drops bot commits", () => {
  const data = {
    repo0: {
      name: "room-tba",
      url: "https://github.com/bulsutools/room-tba",
      releases: { nodes: [{ name: "v1", tagName: "v1.0.0", url: "u", createdAt: "2026-01-10T05:00:00Z" }] },
      pullRequests: {
        nodes: [
          { number: 1, title: "merged", url: "p1", state: "MERGED", createdAt: "2026-01-09T00:00:00Z", updatedAt: "2026-01-10T01:00:00Z", mergedAt: "2026-01-10T01:00:00Z", author: { login: "kaoru" } },
          { number: 2, title: "old", url: "p2", state: "OPEN", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z", mergedAt: null, author: { login: "kaoru" } },
        ],
      },
      issues: { nodes: [] },
      defaultBranchRef: {
        target: {
          history: {
            nodes: [
              { oid: "abc", committedDate: "2026-01-10T02:00:00Z", messageHeadline: "ship it", url: "c1", author: { name: "Kaoru", user: { login: "kaoru" } } },
              { oid: "def", committedDate: "2026-01-10T03:00:00Z", messageHeadline: "bump deps", url: "c2", author: { name: "dependabot[bot]", user: { login: "dependabot[bot]" } } },
            ],
          },
        },
      },
    },
    repo1: null,
  };
  const digest = normalizeDigest(data, ["room-tba", "geary"], SINCE, GENERATED);

  assert.equal(digest.repos.length, 2);
  const [roomTba, geary] = digest.repos;
  assert.equal(roomTba.commits.length, 1);
  assert.equal(roomTba.commits[0].url, "https://github.com/bulsutools/room-tba/commit/abc");
  assert.equal(roomTba.pullRequests.length, 1);
  assert.equal(roomTba.pullRequests[0].merged, true);
  assert.equal(roomTba.releases.length, 1);
  assert.deepEqual(geary.commits, []);
  assert.equal(geary.url, "https://github.com/bulsutools/geary");
  assert.equal(digestHasActivity(digest), true);
});

test("empty digest renders a no-activity discord line", () => {
  const digest = normalizeDigest({}, ["room-tba"], SINCE, GENERATED);
  assert.equal(digestHasActivity(digest), false);
  const content = buildDiscordContent(digest);
  assert.match(content, /0 commits, 0 PRs, 0 issues, 0 releases/);
  assert.match(content, /https:\/\/bulsu\.tools\/digest/);
});
