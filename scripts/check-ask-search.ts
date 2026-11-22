/**
 * Runnable check for the /ask retrieval logic (src/lib/ask-search.ts).
 *
 *   node --experimental-strip-types scripts/check-ask-search.ts
 *
 * Synthetic chunks keep this deterministic; it does not need the built
 * corpus or network. Exits non-zero on failure.
 */
import assert from "node:assert/strict";
import {
  MIN_SCORE,
  searchChunks,
  tokenize,
  type AskChunk,
} from "../src/lib/ask-search.ts";

const chunks: AskChunk[] = [
  {
    id: "tools-overview",
    title: "bulsu.tools tools",
    url: "https://bulsu.tools/#tools",
    text: "bulsu.tools builds free open-source tools: Geary handbook, GWA Calculator, Room TBA map.",
  },
  {
    id: "tool-geary",
    title: "Geary",
    url: "https://geary.bulsu.tools",
    text: "The student-managed handbook for BulSU. Guides on enrollment, academics, documents and scholarships.",
  },
  {
    id: "tool-gwa",
    title: "GWA Calculator",
    url: "https://gwa-calculator.bulsu.tools",
    text: "Compute your General Weighted Average and estimate eligibility for the Gold Gear Awards.",
  },
  {
    id: "repo-geary",
    title: "geary README",
    url: "https://github.com/bulsutools/geary",
    text: "Geary is a static site with guides. Contribute by opening a pull request. See CONTRIBUTING.md.",
  },
];

// Tokenization
assert.deepEqual(tokenize("What tools does bulsutools have?"), [
  "tool",
  "bulsu",
]);
assert.deepEqual(tokenize("enrollment"), ["enroll"]);

// Known-answer retrieval
const tools = searchChunks(chunks, "What tools does bulsutools have?");
assert.equal(tools[0]?.chunk.id, "tools-overview");

const gwa = searchChunks(chunks, "how do I compute my GWA");
assert.equal(gwa[0]?.chunk.id, "tool-gwa");

// Prefix/stem matching: "contributing" must find "contributors"-style text
const contrib = searchChunks(chunks, "who do I talk to about contributing");
assert.equal(contrib[0]?.chunk.id, "repo-geary");

// Out-of-scope queries return nothing instead of a weak match
assert.equal(searchChunks(chunks, "what is the capital of france").length, 0);
assert.equal(searchChunks(chunks, "asdkfj qwzxcv").length, 0);
assert.equal(searchChunks(chunks, "").length, 0);

// Sanity: threshold is above zero so empty queries cannot pass
assert.ok(MIN_SCORE > 0);

console.log("check-ask-search: ok");
