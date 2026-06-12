import { TeachingRequest } from "../models/teachingRequest.model.js";
import { Course } from "../models/course.model.js";
import { ApiError } from "../utils/ApiError.js";
import pool from "../config/db.js";

// Instructor requests to teach a course (re-opens a previously rejected request).
// Returns { request, reSubmitted } so the controller can pick 200 vs 201.
export const createTeachingRequestService = async ({ instructorId, courseId, message = "" }) => {
  if (!courseId) throw new ApiError(400, "courseId is required");

  const course = await Course.findById(courseId).select("title");
  if (!course) throw new ApiError(404, "Course not found");

  const existing = await TeachingRequest.findOne({ instructorId, courseId });
  if (existing) {
    if (existing.status === "pending") throw new ApiError(409, "You already have a pending request for this course");
    if (existing.status === "approved") throw new ApiError(409, "You are already approved to teach this course");
    // Previously rejected → re-open
    existing.status = "pending";
    existing.message = message;
    existing.reviewedBy = null;
    existing.reviewedAt = null;
    await existing.save();
    return { request: existing, reSubmitted: true };
  }

  const request = await TeachingRequest.create({ instructorId, courseId, message });
  return { request, reSubmitted: false };
};

export const getMyTeachingRequestsService = async (instructorId) =>
  TeachingRequest.find({ instructorId })
    .populate("courseId", "title thumbnail category")
    .sort({ createdAt: -1 });

export const getAllTeachingRequestsService = async ({ page = 1, limit = 20, status }) => {
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

  if (requests.length === 0) return { requests: [], total: 0, page: pageNum, limit: limitNum };

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

  return { requests: data, total, page: pageNum, limit: limitNum };
};

export const updateTeachingRequestStatusService = async ({ id, status, reviewerId }) => {
  if (!["approved", "rejected"].includes(status)) {
    throw new ApiError(400, "status must be 'approved' or 'rejected'");
  }
  const request = await TeachingRequest.findById(id);
  if (!request) throw new ApiError(404, "Teaching request not found");

  request.status = status;
  request.reviewedBy = reviewerId;
  request.reviewedAt = new Date();
  await request.save();
  return request;
};

export const deleteTeachingRequestService = async ({ id, user }) => {
  const request = await TeachingRequest.findById(id);
  if (!request) throw new ApiError(404, "Teaching request not found");

  if (user.role !== "admin" && request.instructorId !== user.id) {
    throw new ApiError(403, "You can only cancel your own requests");
  }
  await request.deleteOne();
};
