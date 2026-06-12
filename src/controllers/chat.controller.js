import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { chatService } from "../services/chat.service.js";

// POST /chat — stateless onboarding assistant. Body: { messages: [{role, content}] }.
// optionalAuth populates req.user (or null for guests); tools are scoped to it.
export const handleChat = asyncHandler(async (req, res) => {
  const { reply } = await chatService({ messages: req.body.messages, user: req.user });
  return res.json(new ApiResponse(200, { reply }));
});
