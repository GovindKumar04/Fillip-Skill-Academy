import { Scholarship } from "../models/scholarship.model.js";
import { Course } from "../models/course.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import pool from "../config/db.js";

const VALID_TRACKS = ["merit", "need", "women", "early"];

// ─────────────────────────────────────────────────────────────────────────────
// POST /scholarships  (student)
// Student applies for a scholarship on a specific course
// Body: { track, courseId, statement, income? }
// ─────────────────────────────────────────────────────────────────────────────
const applyForScholarship = asyncHandler(async (req, res) => {
  const { track, courseId, statement, income = "" } = req.body;

  if (!track || !VALID_TRACKS.includes(track)) {
    throw new ApiError(400, "A valid scholarship track is required");
  }
  if (!courseId) throw new ApiError(400, "Please select a course");
  if (!statement || !statement.trim()) {
    throw new ApiError(400, "A statement of purpose is required");
  }

  const course = await Course.findById(courseId).select("title isPublished");
  if (!course) throw new ApiError(404, "Course not found");

  // Block duplicate active applications for the same course
  const existing = await Scholarship.findOne({
    userId: req.user.id,
    courseId,
    status: { $in: ["pending", "under_review", "approved"] },
  });
  if (existing) {
    throw new ApiError(
      409,
      existing.status === "approved"
        ? "You already have an approved scholarship for this course"
        : "You already have a pending application for this course"
    );
  }

  const application = await Scholarship.create({
    userId: req.user.id,
    track,
    courseId,
    statement: statement.trim(),
    income,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, application, "Scholarship application submitted"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /scholarships/my  (student)
// Student sees their own applications with course info + status
// ─────────────────────────────────────────────────────────────────────────────
const getMyApplications = asyncHandler(async (req, res) => {
  const applications = await Scholarship.find({ userId: req.user.id })
    .populate("courseId", "title thumbnail category slug")
    .sort({ createdAt: -1 });

  return res.json(new ApiResponse(200, applications));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /scholarships  (admin)
// All applications with filters + pagination + applicant info from PostgreSQL
// ─────────────────────────────────────────────────────────────────────────────
const getAllApplications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, track, search } = req.query;
  const pageNum = Number(page);
  const limitNum = Number(limit);

  const filter = {};
  if (status) filter.status = status;
  if (track) filter.track = track;

  const [applications, total] = await Promise.all([
    Scholarship.find(filter)
      .populate("courseId", "title thumbnail category")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort({ createdAt: -1 }),
    Scholarship.countDocuments(filter),
  ]);

  // Attach applicant details from PostgreSQL
  let result = applications;
  if (applications.length) {
    const userIds = [...new Set(applications.map((a) => a.userId))];
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(", ");
    const usersResult = await pool.query(
      `SELECT id, full_name, email, phone FROM users WHERE id IN (${placeholders})`,
      userIds
    );
    const usersMap = {};
    usersResult.rows.forEach((u) => (usersMap[u.id] = u));

    result = applications.map((a) => ({
      ...a.toObject(),
      applicant: usersMap[a.userId] || { id: a.userId },
    }));

    // Optional search across applicant name/email
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.applicant.full_name?.toLowerCase().includes(q) ||
          a.applicant.email?.toLowerCase().includes(q)
      );
    }
  }

  return res.json(
    new ApiResponse(200, { applications: result, total, page: pageNum, limit: limitNum })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /scholarships/stats  (admin)
// ─────────────────────────────────────────────────────────────────────────────
const getScholarshipStats = asyncHandler(async (req, res) => {
  const byStatus = await Scholarship.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const stats = { pending: 0, under_review: 0, approved: 0, rejected: 0, total: 0 };
  byStatus.forEach((s) => {
    stats[s._id] = s.count;
    stats.total += s.count;
  });

  return res.json(new ApiResponse(200, stats));
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /scholarships/:id/review  (admin)
// Approve / reject an application, optionally setting a discount percent
// Body: { status, discountPercent?, adminNote? }
// ─────────────────────────────────────────────────────────────────────────────
const reviewApplication = asyncHandler(async (req, res) => {
  const { status, discountPercent, adminNote = "" } = req.body;

  if (!["under_review", "approved", "rejected"].includes(status)) {
    throw new ApiError(400, "status must be under_review, approved or rejected");
  }

  const application = await Scholarship.findById(req.params.id);
  if (!application) throw new ApiError(404, "Application not found");

  if (status === "approved") {
    const pct = Number(discountPercent);
    if (!pct || pct <= 0 || pct > 100) {
      throw new ApiError(400, "Approved scholarships need a discountPercent between 1 and 100");
    }
    application.discountPercent = pct;
  } else {
    application.discountPercent = 0;
  }

  application.status = status;
  application.adminNote = adminNote;
  application.reviewedBy = req.user.id;
  application.reviewedAt = new Date();
  await application.save();

  return res.json(new ApiResponse(200, application, `Application ${status}`));
});

export {
  applyForScholarship,
  getMyApplications,
  getAllApplications,
  getScholarshipStats,
  reviewApplication,
};
