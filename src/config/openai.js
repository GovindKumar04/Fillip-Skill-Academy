import OpenAI from "openai";

// Lazy singleton so the server still boots when OPENAI_API_KEY is unset;
// the chat endpoint surfaces a clean error only when it's actually used.
let client = null;

export const getOpenAI = () => {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured on the server");
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
};

// gpt-4o-mini is cheap + fast for a public widget; override with CHAT_MODEL.
export const CHAT_MODEL = process.env.CHAT_MODEL || "gpt-4o-mini";
