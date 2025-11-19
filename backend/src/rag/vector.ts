// backend/src/rag/vector.ts
import { embedText, chatCompletion } from '../utils/openrouter';
import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from 'dotenv';
import { info, warn } from '../logger';
dotenv.config();

// backend/src/rag/vector.ts

dotenv.config();

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const COLLECTION = "product_knowledge_v1";
const TOP_K = 4;

const qdrant = new QdrantClient({
  url: QDRANT_URL,
  checkCompatibility: false as any
});

// Master DEBUG printer
function DEBUG(...args: any[]) {
  console.log("[RAG-DEBUG]", ...args);
}

// Time helper
function now() {
  return Date.now();
}

async function ensureCollection(dim: number) {
  try {
    DEBUG("Ensuring Qdrant collection exists →", COLLECTION, "dim:", dim);
    await qdrant.collections.createIfNotExists({
      collection_name: COLLECTION,
      vectors: { size: dim, distance: "Cosine" }
    });
  } catch (e) {
    warn("ensureCollection error", e);
  }
}

export async function upsertKnowledge(id: string, text: string) {
  DEBUG("\n=== UPSERT KNOWLEDGE =====================================");
  DEBUG("ID:", id);
  DEBUG("Raw text preview:", text.slice(0, 200) + (text.length > 200 ? "..." : ""));
  DEBUG("==========================================================\n");

  const t0 = now();
  const emb = await embedText(text);
  const t1 = now();

  if (!emb) throw new Error("Embedding returned null");

  DEBUG("Embedding length:", emb.length);
  DEBUG("Embedding time:", (t1 - t0), "ms");

  await ensureCollection(emb.length);

  try {
    await qdrant.points.upsert({
      collection_name: COLLECTION,
      points: [
        {
          id: id,
          vector: emb,
          payload: { text }
        }
      ]
    });

    DEBUG("Qdrant upsert complete for ID:", id);
  } catch (e) {
    error("qdrant upsert failed", e);
    throw e;
  }
}

export async function searchKnowledge(queryText: string, k = TOP_K) {
  DEBUG("\n===== RAG SEARCH START ===================================");
  DEBUG("Query text preview:", queryText.slice(0, 200) + (queryText.length > 200 ? "...":""));
  DEBUG("==========================================================\n");

  const t0 = now();
  const emb = await embedText(queryText);
  const t1 = now();

  if (!emb) {
    warn("Embedding failed for search");
    return [];
  }

  DEBUG("Search embedding length:", emb.length);
  DEBUG("Search embedding time:", (t1 - t0), "ms");
  DEBUG("Running Qdrant search...");

  try {
    const results = await qdrant.points.search({
      collection_name: COLLECTION,
      vector: emb,
      limit: k,
      with_payload: true
    });

    const t2 = now();
    DEBUG("Qdrant search time:", (t2 - t1), "ms");
    DEBUG("Raw Qdrant hit count:", results.length);

    const contexts = results.map((r, idx) => {
      const text = (r.payload as any)?.text || "";
      DEBUG(`\n--- RESULT #${idx + 1} ---`);
      DEBUG("Score:", r.score);
      DEBUG("Context preview:", text.slice(0, 500) + (text.length > 500 ? "..." : ""));
      return text;
    });

    DEBUG("\n===== RAG SEARCH END =====================================\n");

    return contexts;
  } catch (e) {
    warn("Qdrant search failed", e);
    return [];
  }
}

export async function suggestReply(emailText: string) {
  DEBUG("\n\n################################################################");
  DEBUG("######################  RAG SUGGEST REPLY ######################");
  DEBUG("################################################################\n");

  DEBUG("Email text preview:", emailText.slice(0, 200) + (emailText.length > 200 ? "..." : ""));

  const contexts = await searchKnowledge(emailText, TOP_K);

  DEBUG("Total contexts retrieved:", contexts.length);

  contexts.forEach((ctx, i) => {
    DEBUG(`\n--- CONTEXT BLOCK #${i + 1} ---`);
    DEBUG(ctx.slice(0, 1000) + (ctx.length > 1000 ? "..." : ""));
  });

  const contextBlock = contexts.length
    ? contexts.join("\n\n---\n\n")
    : "No relevant context retrieved.";

  // Build final RAG prompt
  const prompt = `
You are a concise, professional assistant. Write a short reply (1 paragraph).
If context contains booking links, include them.

Context:
${contextBlock}

Incoming Email:
${emailText}

Reply in a friendly, professional tone:
  `.trim();

  DEBUG("\n========================= RAG FINAL PROMPT ========================");
  DEBUG(prompt);
  DEBUG("==================================================================\n");

  const t0 = now();
  try {
    const reply = await chatCompletion(
      [{ role: "user", content: prompt }],
      0.2
    );
    const t1 = now();

    DEBUG("\n======================= RAG FINAL LLM REPLY =======================");
    DEBUG(reply);
    DEBUG("===================================================================");
    DEBUG("LLM generation time:", (t1 - t0), "ms\n");

    return reply || "";
  } catch (e) {
    warn("suggestReply LLM failed", e);
    return "Thanks for reaching out — please book a time here: https://cal.com/example";
  }
}
