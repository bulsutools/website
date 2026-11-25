import type { APIRoute } from "astro";
import { buildAskCorpus } from "../lib/ask-corpus";

/**
 * Emits /ask-corpus.json at build time. The /ask page fetches this and runs
 * BM25 retrieval client-side (src/lib/ask-search.ts).
 */
export const GET: APIRoute = async () => {
  const chunks = await buildAskCorpus();
  return new Response(JSON.stringify({ chunks }), {
    headers: { "Content-Type": "application/json" },
  });
};
