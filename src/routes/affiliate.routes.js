import express from "express";
import {
  joinAffiliate,
  getMyAffiliate,
  trackClick,
  getAllAffiliates,
  updateAffiliate,
  getCommissions,
  updateCommissionStatus,
} from "../controllers/affiliate.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const affiliateRouter = express.Router();

// Public — referral link click tracking (no auth)
affiliateRouter.get("/track/:code", trackClick);

// Everything below requires login
affiliateRouter.use(verifyJWT);

// Any logged-in user — opt in / view own dashboard
affiliateRouter.post("/join", joinAffiliate);
affiliateRouter.get("/me", getMyAffiliate);

// Admin — manage affiliates & commissions
// (specific /commissions routes declared before /:userId to avoid capture)
affiliateRouter.get("/", requireRole("admin"), getAllAffiliates);
affiliateRouter.get("/commissions", requireRole("admin"), getCommissions);
affiliateRouter.patch("/commissions/:id", requireRole("admin"), updateCommissionStatus);
affiliateRouter.patch("/:userId", requireRole("admin"), updateAffiliate);

export { affiliateRouter };
