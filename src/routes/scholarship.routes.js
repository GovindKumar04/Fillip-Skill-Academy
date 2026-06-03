import express from "express";
import {
  applyForScholarship,
  getMyApplications,
  getAllApplications,
  getScholarshipStats,
  reviewApplication,
} from "../controllers/scholarship.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const scholarshipRouter = express.Router();

scholarshipRouter.use(verifyJWT);

// Student applies for a scholarship
scholarshipRouter.post("/", requireRole("student"), applyForScholarship);

// Student sees their own applications
scholarshipRouter.get("/my", requireRole("student"), getMyApplications);

// Admin: all applications with filters
scholarshipRouter.get("/", requireRole("admin"), getAllApplications);

// Admin: summary stats
scholarshipRouter.get("/stats", requireRole("admin"), getScholarshipStats);

// Admin: approve / reject an application
scholarshipRouter.patch("/:id/review", requireRole("admin"), reviewApplication);

export { scholarshipRouter };
