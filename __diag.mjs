import "dotenv/config";
import { chatService } from "./src/services/chat.service.js";

const run = async () => {
  console.log("CHAT_PROVIDER=", process.env.CHAT_PROVIDER);
  console.log("has OPENAI=", !!process.env.OPENAI_API_KEY, " has GEMINI=", !!process.env.GEMINI_API_KEY);
  try {
    const out = await chatService({
      messages: [{ role: "user", content: "What courses do you offer?" }],
      user: null,
    });
    console.log("REPLY:", out.reply);
  } catch (e) {
    console.error("THREW:", e?.status, e?.message);
  }
};
run();
