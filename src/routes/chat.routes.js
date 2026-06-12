import express from "express";
import { handleChat } from "../controllers/chat.controller.js";
import { optionalAuth } from "../middlewares/optionalAuth.middleware.js";
import { chatLimiter } from "../middlewares/chatLimiter.middleware.js";

const chatRouter = express.Router();

// Public + personalised: optionalAuth attaches req.user when a valid cookie/token
// is present, otherwise the user is treated as a guest.
chatRouter.post("/", optionalAuth, chatLimiter, handleChat);

export { chatRouter };
