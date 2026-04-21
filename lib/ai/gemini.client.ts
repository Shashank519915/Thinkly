import { GoogleGenerativeAI } from "@google/generative-ai";

export const GEMINI_MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemma-4-31b-it";

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY_MISSING");
  return new GoogleGenerativeAI(apiKey);
}

