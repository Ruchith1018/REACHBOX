// src/utils/gemini.ts

import dotenv from "dotenv";
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";

// ---------------------------
// Load API key safely
// ---------------------------
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey || apiKey.trim() === "") {
  console.warn("[WARN] GEMINI_API_KEY is missing! Gemini calls will fail.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

// ---------------------------
// CHAT GENERATION (LLM)
// ---------------------------
export async function geminiChat(prompt: string): Promise<string | null> {
  try {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash-latest",
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err: any) {
    console.error("[ERROR] Gemini chat error:", err);
    return null;
  }
}

// ---------------------------
// EMBEDDINGS FOR QDRANT (RAG)
// ---------------------------
export async function geminiEmbed(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_EMBED_MODEL || "text-embedding-004",
    });

    const result = await model.embedContent(text);

    return result.embedding.values;
  } catch (err: any) {
    console.error("[ERROR] Gemini embed error:", err);
    return [];
  }
}
