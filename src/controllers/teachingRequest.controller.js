import { TeachingRequest } from "../models/teachingRequest.model.js";
import { Course } from "../models/course.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import pool from "../config/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// POST /teaching-requests   (instructor)
// Instructor requests to teach a specific course.
// Body: { courseId, message? }
// ─────────────────────────────────────────────────────────────────────────────
const createTeachingRequest = asyncHandler(async (req, res) => {
  const { courseId, message = "" } = req.body;
  if (!courseId) throw new ApiError(400, "courseId is required");

  const course = await Course.findById(courseId).select("title");
  if (!course) throw new ApiError(404, "Course not found");

  const existing = await TeachingRequest.findOne({
    instructorId: req.user.id,
    courseId,
  });

  if (existing) {
    if (existing.status === "pending") {
      throw new ApiError(409, "You already have a pending request for this course");
    }
    if (existing.status === "approved") {
      throw new ApiError(409, "You are already approved to teach this course");
    }
    // Previously rejected → allow re-requesting by re-opening the row
    existing.status = "pending";
    existing.message = message;
    existing.reviewedBy = null;
    existing.reviewedAt = null;
    await existing.save();
    return res
      .status(200)
      .json(new ApiResponse(200, existing, "Teaching request re-submitted"));
  }

  const request = await TeachingRequest.create({
    instructorId: req.user.id,
    courseId,
    message,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, request, "Teaching request submitted"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /teaching-requests/my   (instructor)
// Returns the current instructor's own requests (to drive button state).
// ─────────────────────────────────────────────────────────────────────────────
const getMyTeachingRequests = asyncHandler(async (req, res) => {
  const requests = await TeachingRequest.find({ instructorId: req.user.id })
    .populate("courseId", "title thumbnail category")
    .sort({ createdAt: -1 });

  return res.json(new ApiResponse(200, requests));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /teaching-requests   (admin)
// Lists all requests with instructor (from PostgreSQL) + course details.
// ─────────────────────────────────────────────────────────────────────────────
const getAllTeachingRequests = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const pageNum = Number(page);
  const limitNum = Number(limit);

  const filter = {};
  if (status) filter.status = status;

  const [requests, total] = await Promise.all([
    TeachingRequest.find(filter)
      .populate("courseId", "title thumbnail category level")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort({ createdAt: -1 }),
    TeachingRequest.countDocuments(filter),
  ]);

  if (requests.length === 0) {
    return res.json(
      new ApiResponse(200, { requests: [], total: 0, page: pageNum, limit: limitNum })
    );
  }

  // Attach instructor details from PostgreSQL
  const instructorIds = [...new Set(requests.map((r) => r.instructorId))];
  const placeholders = instructorIds.map((_, i) => `$${i + 1}`).join(", ");
  const usersResult = await pool.query(
    `SELECT id, full_name, email, phone FROM users WHERE id IN (${placeholders})`,
    instructorIds
  );
  const usersMap = {};
  usersResult.rows.forEach((u) => (usersMap[u.id] = u));

  const data = requests.map((r) => ({
    id: r._id,
    status: r.status,
    message: r.message,
    mode: r.mode,
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt,
    instructor: usersMap[r.instructorId] || { id: r.instructorId },
    course: r.courseId,
  }));

  return res.json(
    new ApiResponse(200, { requests: data, total, page: pageNum, limit: limitNum })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /teaching-requests/:id   (admin)
// Approve or reject a request.  Body: { status: "approved" | "rejected" }
// ─────────────────────────────────────────────────────────────────────────────
const updateTeachingRequestStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    throw new ApiError(400, "status must be 'approved' or 'rejected'");
  }

  const request = await TeachingRequest.findById(req.params.id);
  if (!request) throw new ApiError(404, "Teaching request not found");

  request.status = status;
  request.reviewedBy = req.user.id;
  request.reviewedAt = new Date();
  await request.save();

  return res.json(new ApiResponse(200, request, `Request ${status}`));
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /teaching-requests/:id   (admin, or instructor cancelling their own)
// ─────────────────────────────────────────────────────────────────────────────
const deleteTeachingRequest = asyncHandler(async (req, res) => {
  const request = await TeachingRequest.findById(req.params.id);
  if (!request) throw new ApiError(404, "Teaching request not found");

  if (req.user.role !== "admin" && request.instructorId !== req.user.id) {
    throw new ApiError(403, "You can only cancel your own requests");
  }

  await request.deleteOne();
  return res.json(new ApiResponse(200, null, "Teaching request removed"));
});

export {
  createTeachingRequest,
  getMyTeachingRequests,
  getAllTeachingRequests,
  updateTeachingRequestStatus,
  deleteTeachingRequest,
};
