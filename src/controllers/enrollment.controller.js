import { Enrollment } from "../models/enrollment.model.js";
import { Progress } from "../models/progress.model.js";
import { Course } from "../models/course.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import pool from "../config/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// POST /enrollments
// Admin enrolls a student into a course
// Body: { userId, courseId }
// ─────────────────────────────────────────────────────────────────────────────
const enrollStudent = asyncHandler(async (req, res) => {
  const { userId, courseId } = req.body;

  if (!userId || !courseId) {
    throw new ApiError(400, "userId and courseId are required");
  }

  // Verify the user exists in PostgreSQL and is a student
  const userResult = await pool.query(
    "SELECT id, full_name, email, role FROM users WHERE id = $1",
    [userId]
  );
  if (userResult.rows.length === 0) throw new ApiError(404, "User not found");
  const user = userResult.rows[0];
  if (user.role !== "student") {
    throw new ApiError(400, "Only students can be enrolled in courses");
  }

  // Verify the course exists
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, "Course not found");

  // Check for existing enrollment (active or inactive)
  const existing = await Enrollment.findOne({ userId, courseId });
  if (existing) {
    if (existing.isActive) {
      throw new ApiError(409, "Student is already enrolled in this course");
    }
    // Re-activate a previously unenrolled student
    existing.isActive = true;
    existing.unenrolledAt = null;
    existing.enrolledBy = req.user.id;
    await existing.save();
    return res.status(200).json(
      new ApiResponse(200, existing, "Student re-enrolled successfully")
    );
  }

  const enrollment = await Enrollment.create({
    userId,
    courseId,
    enrolledBy: req.user.id,
  });

  // Pre-create an empty progress document for this enrollment
  await Progress.create({ userId, courseId });

  return res
    .status(201)
    .json(new ApiResponse(201, enrollment, "Student enrolled successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /enrollments/:enrollmentId
// Admin unenrolls a student (soft delete — keeps progress history)
// ─────────────────────────────────────────────────────────────────────────────
const unenrollStudent = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findById(req.params.enrollmentId);
  if (!enrollment) throw new ApiError(404, "Enrollment not found");
  if (!enrollment.isActive) throw new ApiError(400, "Student is already unenrolled");

  enrollment.isActive = false;
  enrollment.unenrolledAt = new Date();
  await enrollment.save();

  return res.json(new ApiResponse(200, enrollment, "Student unenrolled successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /enrollments/my-courses
// Student sees their own enrolled courses with progress
// ─────────────────────────────────────────────────────────────────────────────
const getMyCourses = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({
    userId: req.user.id,
    isActive: true,
  }).populate({
    path: "courseId",
    select: "title description thumbnail category level price",
  });

  // Attach progress percentage to each enrollment
  const progressDocs = await Progress.find({
    userId: req.user.id,
    courseId: { $in: enrollments.map((e) => e.courseId._id) },
  }).select("courseId completionPercent lastAccessedAt");

  const progressMap = {};
  progressDocs.forEach((p) => {
    progressMap[p.courseId.toString()] = {
      completionPercent: p.completionPercent,
      lastAccessedAt: p.lastAccessedAt,
    };
  });

  const result = enrollments.map((e) => ({
    enrollmentId: e._id,
    enrolledAt: e.createdAt,
    course: e.courseId,
    progress: progressMap[e.courseId._id.toString()] || {
      completionPercent: 0,
      lastAccessedAt: null,
    },
  }));

  return res.json(new ApiResponse(200, result));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /enrollments/course/:courseId/students
// Admin or instructor sees all students enrolled in a course
// ─────────────────────────────────────────────────────────────────────────────
const getCourseStudents = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const pageNum = Number(page);
  const limitNum = Number(limit);

  const course = await Course.findById(courseId).select("title instructorId");
  if (!course) throw new ApiError(404, "Course not found");

  // Instructors can only view students for their own courses
  if (
    req.user.role === "instructor" &&
    course.instructorId !== req.user.id
  ) {
    throw new ApiError(403, "You can only view students in your own courses");
  }

  const [enrollments, total] = await Promise.all([
    Enrollment.find({ courseId, isActive: true })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort({ createdAt: -1 }),
    Enrollment.countDocuments({ courseId, isActive: true }),
  ]);

  if (enrollments.length === 0) {
    return res.json(
      new ApiResponse(200, { students: [], total: 0, page: pageNum, limit: limitNum })
    );
  }

  // Fetch user details from PostgreSQL
  const userIds = enrollments.map((e) => e.userId);
  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(", ");
  const usersResult = await pool.query(
    `SELECT id, full_name, email, phone, avatar FROM users WHERE id IN (${placeholders})`,
    userIds
  );
  const usersMap = {};
  usersResult.rows.forEach((u) => (usersMap[u.id] = u));

  // Fetch progress for all these students in this course
  const progressDocs = await Progress.find({
    userId: { $in: userIds },
    courseId,
  }).select("userId completionPercent lastAccessedAt completedAt");
  const progressMap = {};
  progressDocs.forEach((p) => (progressMap[p.userId] = p));

  const students = enrollments.map((e) => ({
    enrollmentId: e._id,
    enrolledAt: e.createdAt,
    user: usersMap[e.userId] || { id: e.userId },
    progress: progressMap[e.userId] || {
      completionPercent: 0,
      lastAccessedAt: null,
      completedAt: null,
    },
  }));

  return res.json(
    new ApiResponse(200, { students, total, page: pageNum, limit: limitNum })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /enrollments/student/:userId
// Admin sees all courses a specific student is enrolled in
// ─────────────────────────────────────────────────────────────────────────────
const getStudentEnrollments = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const enrollments = await Enrollment.find({
    userId: Number(userId),
    isActive: true,
  }).populate("courseId", "title thumbnail category level");

  const progressDocs = await Progress.find({
    userId: Number(userId),
  }).select("courseId completionPercent lastAccessedAt completedAt");
  const progressMap = {};
  progressDocs.forEach((p) => (progressMap[p.courseId.toString()] = p));

  const result = enrollments.map((e) => ({
    enrollmentId: e._id,
    enrolledAt: e.createdAt,
    course: e.courseId,
    progress: progressMap[e.courseId._id.toString()] || {
      completionPercent: 0,
      lastAccessedAt: null,
    },
  }));

  return res.json(new ApiResponse(200, result));
});

export {
  enrollStudent,
  unenrollStudent,
  getMyCourses,
  getCourseStudents,
  getStudentEnrollments,
};