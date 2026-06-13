import express from "express";
import {
  getTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
} from "../controllers/testimonial.controller.js";
import { optionalAuth } from "../middlewares/optionalAuth.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { audit } from "../middlewares/audit.middleware.js";

const testimonialRouter = express.Router();

// Public read (optionalAuth lets an admin also see unpublished via ?all=1).
testimonialRouter.get("/", optionalAuth, getTestimonials);

// Admin writes (avatar field name: "image").
testimonialRouter.post("/", verifyJWT, requireRole("admin"), upload.single("image"), audit("testimonial.create"), createTestimonial);
testimonialRouter.patch("/:id", verifyJWT, requireRole("admin"), upload.single("image"), audit("testimonial.update"), updateTestimonial);
testimonialRouter.delete("/:id", verifyJWT, requireRole("admin"), audit("testimonial.delete"), deleteTestimonial);

export { testimonialRouter };
