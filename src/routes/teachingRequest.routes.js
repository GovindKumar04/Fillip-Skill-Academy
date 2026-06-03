import express from "express";
import {
  createTeachingRequest,
  getMyTeachingRequests,
  getAllTeachingRequests,
  updateTeachingRequestStatus,
  deleteTeachingRequest,
} from "../controllers/teachingRequest.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const teachingRequestRouter = express.Router();

teachingRequestRouter.use(verifyJWT);

// Instructor
teachingRequestRouter.post("/", requireRole("instructor"), createTeachingRequest);
teachingRequestRouter.get("/my", requireRole("instructor"), getMyTeachingRequests);

// Admin
teachingRequestRouter.get("/", requireRole("admin"), getAllTeachingRequests);
teachingRequestRouter.patch("/:id", requireRole("admin"), updateTeachingRequestStatus);

// Admin or the requesting instructor
teachingRequestRouter.delete("/:id", requireRole("admin", "instructor"), deleteTeachingRequest);

export { teachingRequestRouter };
