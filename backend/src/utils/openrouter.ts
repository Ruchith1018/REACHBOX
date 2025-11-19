// backend/src/utils/openrouter.ts
import axios from "axios";
import dotenv from "dotenv";
import { warn, error, info } from "../logger";

dotenv.config();

const API_KEY = process.env.OPENROUTER_API_KEY;
const BASE = "https://openrouter.ai/api/v1";

const PRIMARY_MODEL = process.env.OPENROUTER_MODEL || "mistralai/mistral-small:free";
const EMBED_MODEL = process.env.OPENROUTER_EMBED_MODEL || "deepseek/deepseek-embed";

const MODEL_FALLBACKS = [
  PRIMARY_MODEL,
  "mistralai/mistral-small:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "openai/gpt-oss-20b:free"
];

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// ------------------- CHAT COMPLETION ------------------
export async function chatCompletion(messages: any[], temperature = 0.2) {
  let lastError = null;

  for (const model of MODEL_FALLBACKS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await axios.post(
          `${BASE}/chat/completions`,
          { model, messages, temperature },
          {
            headers: {
              Authorization: `Bearer ${API_KEY}`,
              "Content-Type": "application/json",
            },
            timeout: 60000,
          }
        );

        const txt =
          response.data?.choices?.[0]?.message?.content ||
          response.data?.choices?.[0]?.text ||
          "";

        if (txt) return txt;
      } catch (err: any) {
        lastError = err;
        const status = err?.response?.status;

        warn(`Model ${model} failed attempt ${attempt + 1}`, status);

        if (status === 429 || JSON.stringify(err).includes("capacity")) {
          await sleep(500 * (attempt + 1));
          continue;
        }

        break;
      }
    }
    info(`Falling back model from: ${model}`);
  }

  error("All OpenRouter models failed", lastError?.response?.data || lastError);
  throw new Error("OpenRouter failed for chatCompletion");
}

// ------------------- EMBEDDINGS ------------------
export async function embedText(input: string) {
  try {
    const resp = await axios.post(
      `${BASE}/embeddings`,
      { model: EMBED_MODEL, input },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );

    return resp.data?.data?.[0]?.embedding || null;
  } catch (err: any) {
    error("Embedding error:", err?.response?.data || err);
    throw err;
  }
}
