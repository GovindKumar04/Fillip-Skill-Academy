import express from "express";
import {
  getBatchOptions,
  createBatch,
  getAllBatches,
  getMyBatches,
  updateBatch,
  deleteBatch,
} from "../controllers/batch.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const batchRouter = express.Router();

batchRouter.use(verifyJWT);

// Instructor — their assigned batches
batchRouter.get("/my", requireRole("instructor"), getMyBatches);

// Admin — assignable instructors/students for a course's batch
batchRouter.get("/course/:courseId/options", requireRole("admin"), getBatchOptions);

// Admin — batch management
batchRouter.get("/", requireRole("admin"), getAllBatches);
batchRouter.post("/", requireRole("admin"), createBatch);
batchRouter.patch("/:id", requireRole("admin"), updateBatch);
batchRouter.delete("/:id", requireRole("admin"), deleteBatch);

export { batchRouter };
