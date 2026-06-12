import { TeachingRequest } from "../models/teachingRequest.model.js";
import { Course } from "../models/course.model.js";
import { ApiError } from "../utils/ApiError.js";
import pool from "../config/db.js";

// After withdrawing their own request, an instructor must wait this long before
// they can apply to teach the same course again.
export const WITHDRAW_HOLD_DAYS = 30;
const holdUntilFrom = (withdrawnAt) =>
  new Date(new Date(withdrawnAt).getTime() + WITHDRAW_HOLD_DAYS * 24 * 60 * 60 * 1000);

// Instructor requests to teach a course (re-opens a previously rejected/withdrawn request).
// Returns { request, reSubmitted } so the controller can pick 200 vs 201.
export const createTeachingRequestService = async ({ instructorId, courseId, message = "" }) => {
  if (!courseId) throw new ApiError(400, "courseId is required");

  const course = await Course.findById(courseId).select("title");
  if (!course) throw new ApiError(404, "Course not found");

  const existing = await TeachingRequest.findOne({ instructorId, courseId });
  if (existing) {
    if (existing.status === "pending") throw new ApiError(409, "You already have a pending request for this course");
    if (existing.status === "approved") throw new ApiError(409, "You are already approved to teach this course");
    if (existing.status === "withdrawn" && existing.withdrawnAt) {
      const holdUntil = holdUntilFrom(existing.withdrawnAt);
      if (Date.now() < holdUntil.getTime()) {
        const until = holdUntil.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        throw new ApiError(403, `You withdrew this request recently. You can apply to teach this course again on ${until}.`);
      }
    }
    // Previously rejected, or withdrawn with the hold elapsed → re-open
    existing.status = "pending";
    existing.message = message;
    existing.reviewedBy = null;
    existing.reviewedAt = null;
    existing.withdrawnAt = null;
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
    withdrawnAt: r.withdrawnAt,
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

// Instructors "withdraw" their own request (soft delete + start the re-apply hold);
// admins hard-delete the record entirely.
export const deleteTeachingRequestService = async ({ id, user }) => {
  const request = await TeachingRequest.findById(id);
  if (!request) throw new ApiError(404, "Teaching request not found");

  if (user.role !== "admin" && request.instructorId !== user.id) {
    throw new ApiError(403, "You can only withdraw your own requests");
  }

  if (user.role === "admin") {
    await request.deleteOne();
    return { deleted: true };
  }

  request.status = "withdrawn";
  request.withdrawnAt = new Date();
  request.reviewedBy = null;
  request.reviewedAt = null;
  await request.save();
  return { withdrawn: true, holdUntil: holdUntilFrom(request.withdrawnAt) };
};
