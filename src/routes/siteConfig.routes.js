import express from "express";
import { getSiteConfig, updateSiteConfig } from "../controllers/siteConfig.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const siteConfigRouter = express.Router();

siteConfigRouter.get("/", getSiteConfig);
siteConfigRouter.put("/", verifyJWT, requireRole("admin"), updateSiteConfig);

export { siteConfigRouter };
