/**
 * Client-side retrieval for /ask. BM25-lite over the build-time corpus in
 * dist/ask-corpus.json — zero cost, no Workers AI or Vectorize binding.
 *
 * ponytail: keyword scoring, not embeddings. Ceiling: paraphrases and
 * semantic matches ("school mascot" -> Geary) miss. Upgrade path: swap
 * searchChunks for a Workers AI embedding lookup against a Vectorize index
 * built by scripts/; the corpus JSON and /ask page stay the same.
 */

export type AskChunk = {
  id: string;
  title: string;
  url: string;
  text: string;
};

export type AskMatch = {
  chunk: AskChunk;
  score: number;
};

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "been", "do", "does", "did", "what",
  "which", "who", "whom", "whose", "how", "why", "when", "where", "can",
  "could", "should", "would", "will", "i", "you", "we", "they", "it", "its",
  "at", "by", "from", "as", "about", "that", "this", "there", "their",
  "our", "us", "me", "my", "your", "have", "has", "had", "not", "no",
  "s", "t",
]);

// Longest-first suffix stripping, applied to a fixed point, minimum stem
// length 4. Crude on purpose: both sides of a query/doc pair go through the
// same stemmer, so "contributing"/"contributors" -> "contribut",
// "enrollment"/"enroll" -> "enroll", "grades"/"grade" -> "grad".
const SUFFIXES = [
  "ization", "isation", "fulness", "ous", "ive", "ment", "tion", "sion",
  "ness", "ity", "ies", "ing", "ers", "ed", "es", "er", "or", "s", "e",
];

function stem(token: string): string {
  let out = token;
  for (;;) {
    const suffix = SUFFIXES.find(
      (s) => out.endsWith(s) && out.length - s.length >= 4,
    );
    if (!suffix) return out;
    out = out.slice(0, -suffix.length);
  }
}

export function tokenize(input: string): string[] {
  // "bulsutools" and "bulsu.tools" should hit the same tokens.
  const normalized = input.toLowerCase().replaceAll("bulsutools", "bulsu tools");
  const matches = normalized.match(/[a-z0-9]+/g) ?? [];
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const raw of matches) {
    if (raw.length <= 1 || STOP_WORDS.has(raw)) continue;
    const s = stem(raw);
    if (!seen.has(s)) {
      seen.add(s);
      tokens.push(s);
    }
  }
  return tokens;
}

/**
 * Prefix match on stems, minimum 4 chars: "enroll"~"enrollment",
 * "find"~"finding", "compute"~"computes". Shorter terms ("gwa", "tba",
 * "map") stay exact.
 */
function termMatch(query: string, doc: string): boolean {
  if (query === doc) return true;
  if (query.length >= 4 && doc.startsWith(query)) return true;
  if (doc.length >= 4 && query.startsWith(doc)) return true;
  return false;
}

const TITLE_WEIGHT = 3;
const K1 = 1.2;
const B = 0;
/** Below this a query is treated as not covered by the docs. */
export const MIN_SCORE = 1.5;

type IndexedChunk = {
  chunk: AskChunk;
  /** term -> weighted frequency (title hits count TITLE_WEIGHT times) */
  tf: Map<string, number>;
  length: number;
};

function indexChunk(chunk: AskChunk): IndexedChunk {
  const tf = new Map<string, number>();
  const add = (term: string, weight: number) => {
    tf.set(term, (tf.get(term) ?? 0) + weight);
  };
  for (const term of tokenize(chunk.title)) add(term, TITLE_WEIGHT);
  for (const term of tokenize(chunk.text)) add(term, 1);
  let length = 0;
  for (const w of tf.values()) length += w;
  return { chunk, tf, length };
}

export function searchChunks(
  chunks: AskChunk[],
  query: string,
  limit = 3,
): AskMatch[] {
  const terms = tokenize(query);
  if (!terms.length || !chunks.length) return [];

  const indexed = chunks.map(indexChunk);
  const avgLength =
    indexed.reduce((sum, c) => sum + c.length, 0) / indexed.length || 1;

  // document frequency across chunks
  const df = new Map<string, number>();
  for (const c of indexed) {
    for (const term of c.tf.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const n = indexed.length;
  // Floor of ~1 keeps ubiquitous terms ("tools", "bulsu") from scoring
  // zero; classic BM25 idf goes to 0 when a term is in every doc, which
  // would make "what tools does bulsutools have" unanswerable.
  const idf = (term: string) =>
    Math.log(n / ((df.get(term) ?? 0) + 0.5)) + 1;

  const matches: AskMatch[] = [];
  for (const c of indexed) {
    let score = 0;
    for (const term of terms) {
      let best = 0;
      for (const [docTerm, tf] of c.tf) {
        if (!termMatch(term, docTerm)) continue;
        const denom = tf + K1 * (1 - B + B * (c.length / avgLength));
        const value = idf(docTerm) * ((tf * (K1 + 1)) / denom);
        if (value > best) best = value;
      }
      score += best;
    }
    if (score > 0) matches.push({ chunk: c.chunk, score });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches
    .filter((m) => m.score >= MIN_SCORE)
    .slice(0, limit);
}
