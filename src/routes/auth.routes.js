import express from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  refreshAccessToken,
  getUsers,
} from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { registerSchema, loginSchema } from "../validations/auth.validation.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const authrouter = express.Router();

authrouter.post("/register", validate(registerSchema), registerUser);
authrouter.post("/login", validate(loginSchema), loginUser);
authrouter.post("/logout", logoutUser);
authrouter.post("/refresh", refreshAccessToken);
authrouter.get("/me", verifyJWT, getCurrentUser);
authrouter.get("/users", verifyJWT, requireRole("admin"), getUsers);

export { authrouter };
