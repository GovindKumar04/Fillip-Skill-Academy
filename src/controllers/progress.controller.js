import { Progress } from "../models/progress.model.js";
import { Enrollment } from "../models/enrollment.model.js";
import { Course } from "../models/course.model.js";
import { Module } from "../models/module.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import pool from "../config/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: recalculate completionPercent for a progress document
// totalMaterials is passed in to avoid an extra DB call at call sites
// ─────────────────────────────────────────────────────────────────────────────
const recalcProgress = async (progressDoc, totalMaterials) => {
  if (totalMaterials === 0) {
    progressDoc.completionPercent = 0;
    return;
  }
  // Count unique materials watched (completedMaterials uses $addToSet logic
  // via schema — but we store objects, so deduplicate by materialId)
  const uniqueIds = new Set(
    progressDoc.completedMaterials.map((m) => m.materialId.toString())
  );
  const percent = Math.round((uniqueIds.size / totalMaterials) * 100);
  progressDoc.completionPercent = Math.min(percent, 100);

  if (progressDoc.completionPercent === 100 && !progressDoc.completedAt) {
    progressDoc.completedAt = new Date();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get total material count for a course
// ─────────────────────────────────────────────────────────────────────────────
const getTotalMaterials = async (courseId) => {
  const modules = await Module.find({ course: courseId }).select("materials");
  return modules.reduce((sum, m) => sum + m.materials.length, 0);
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /progress/mark-watched
// Student marks a material as watched/completed
// Body: { courseId, materialId, watchPercent? }
// Called when: video ends, PDF opened, image viewed
// ─────────────────────────────────────────────────────────────────────────────
const markMaterialWatched = asyncHandler(async (req, res) => {
  const { courseId, materialId, watchPercent = 100 } = req.body;

  if (!courseId || !materialId) {
    throw new ApiError(400, "courseId and materialId are required");
  }

  // Guard: student must be enrolled and active
  const enrollment = await Enrollment.findOne({
    userId: req.user.id,
    courseId,
    isActive: true,
  });
  if (!enrollment) {
    throw new ApiError(403, "You are not enrolled in this course");
  }

  let progress = await Progress.findOne({ userId: req.user.id, courseId });

  // Defensive: create if somehow missing
  if (!progress) {
    progress = await Progress.create({ userId: req.user.id, courseId });
  }

  // Check if this material was already fully watched — avoid duplicate entries
  const alreadyWatched = progress.completedMaterials.find(
    (m) => m.materialId.toString() === materialId && m.watchPercent === 100
  );

  if (!alreadyWatched) {
    progress.completedMaterials.push({
      materialId,
      watchedAt: new Date(),
      watchPercent: Number(watchPercent),
    });
  } else if (Number(watchPercent) > alreadyWatched.watchPercent) {
    // Update watchPercent if they watched more this time
    alreadyWatched.watchPercent = Number(watchPercent);
    alreadyWatched.watchedAt = new Date();
  }

  progress.lastAccessedAt = new Date();

  const totalMaterials = await getTotalMaterials(courseId);
  await recalcProgress(progress, totalMaterials);
  await progress.save();

  return res.json(
    new ApiResponse(200, {
      completionPercent: progress.completionPercent,
      completedAt: progress.completedAt,
      totalMaterials,
      completedMaterials: new Set(
        progress.completedMaterials.map((m) => m.materialId.toString())
      ).size,
    }, "Progress updated")
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /progress/my-progress/:courseId
// Student sees their own detailed progress in a course
// ─────────────────────────────────────────────────────────────────────────────
const getMyProgress = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  const enrollment = await Enrollment.findOne({
    userId: req.user.id,
    courseId,
    isActive: true,
  });
  if (!enrollment) {
    throw new ApiError(403, "You are not enrolled in this course");
  }

  const [progress, course] = await Promise.all([
    Progress.findOne({ userId: req.user.id, courseId }),
    Course.findById(courseId).populate({
      path: "modules",
      populate: { path: "materials", select: "title type duration" },
    }),
  ]);

  if (!course) throw new ApiError(404, "Course not found");

  // Build a per-module breakdown
  const watchedSet = new Set(
    (progress?.completedMaterials || []).map((m) => m.materialId.toString())
  );

  const moduleBreakdown = course.modules.map((mod) => {
    const completedInModule = mod.materials.filter((mat) =>
      watchedSet.has(mat._id.toString())
    ).length;
    return {
      moduleId: mod._id,
      moduleTitle: mod.title,
      totalMaterials: mod.materials.length,
      completedMaterials: completedInModule,
      modulePercent:
        mod.materials.length > 0
          ? Math.round((completedInModule / mod.materials.length) * 100)
          : 0,
      materials: mod.materials.map((mat) => ({
        materialId: mat._id,
        title: mat.title,
        type: mat.type,
        duration: mat.duration,
        isCompleted: watchedSet.has(mat._id.toString()),
      })),
    };
  });

  return res.json(
    new ApiResponse(200, {
      courseId,
      courseTitle: course.title,
      completionPercent: progress?.completionPercent || 0,
      lastAccessedAt: progress?.lastAccessedAt || null,
      completedAt: progress?.completedAt || null,
      enrolledAt: enrollment.createdAt,
      moduleBreakdown,
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /progress/course/:courseId
// Admin or assigned instructor sees all students' progress in a course
// ─────────────────────────────────────────────────────────────────────────────
const getCourseProgress = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const pageNum = Number(page);
  const limitNum = Number(limit);

  const course = await Course.findById(courseId).select("title instructorId");
  if (!course) throw new ApiError(404, "Course not found");

  // Instructors can only see progress for their own courses
  if (
    req.user.role === "instructor" &&
    course.instructorId !== req.user.id
  ) {
    throw new ApiError(403, "Access denied");
  }

  const [progressDocs, total] = await Promise.all([
    Progress.find({ courseId })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort({ completionPercent: -1 }),
    Progress.countDocuments({ courseId }),
  ]);

  if (progressDocs.length === 0) {
    return res.json(
      new ApiResponse(200, { students: [], total: 0, courseTitle: course.title })
    );
  }

  // Fetch user details from PostgreSQL
  const userIds = progressDocs.map((p) => p.userId);
  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(", ");
  const usersResult = await pool.query(
    `SELECT id, full_name, email, avatar FROM users WHERE id IN (${placeholders})`,
    userIds
  );
  const usersMap = {};
  usersResult.rows.forEach((u) => (usersMap[u.id] = u));

  const totalMaterials = await getTotalMaterials(courseId);

  const students = progressDocs.map((p) => ({
    userId: p.userId,
    user: usersMap[p.userId] || { id: p.userId },
    completionPercent: p.completionPercent,
    completedMaterials: new Set(
      p.completedMaterials.map((m) => m.materialId.toString())
    ).size,
    totalMaterials,
    lastAccessedAt: p.lastAccessedAt,
    completedAt: p.completedAt,
  }));

  // Summary stats for the top of the admin view
  const avgCompletion =
    progressDocs.length > 0
      ? Math.round(
          progressDocs.reduce((s, p) => s + p.completionPercent, 0) /
            progressDocs.length
        )
      : 0;
  const fullyCompleted = progressDocs.filter(
    (p) => p.completionPercent === 100
  ).length;

  return res.json(
    new ApiResponse(200, {
      courseTitle: course.title,
      totalMaterials,
      summary: {
        totalEnrolled: total,
        avgCompletionPercent: avgCompletion,
        fullyCompleted,
        inProgress: total - fullyCompleted,
      },
      students,
      page: pageNum,
      limit: limitNum,
      total,
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /progress/student/:userId
// Admin sees all course progress for a specific student
// ─────────────────────────────────────────────────────────────────────────────
const getStudentProgress = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const progressDocs = await Progress.find({ userId }).populate(
    "courseId",
    "title thumbnail category"
  );

  const result = progressDocs.map((p) => ({
    courseId: p.courseId._id,
    courseTitle: p.courseId.title,
    courseThumbnail: p.courseId.thumbnail,
    category: p.courseId.category,
    completionPercent: p.completionPercent,
    lastAccessedAt: p.lastAccessedAt,
    completedAt: p.completedAt,
    enrolledAt: p.createdAt,
  }));

  return res.json(new ApiResponse(200, result));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /progress/overview (admin only)
// Platform-wide attendance overview: all courses, avg progress, completion rate
// ─────────────────────────────────────────────────────────────────────────────
const getPlatformProgressOverview = asyncHandler(async (req, res) => {
  const stats = await Progress.aggregate([
    {
      $group: {
        _id: "$courseId",
        totalStudents: { $sum: 1 },
        avgCompletion: { $avg: "$completionPercent" },
        completed: {
          $sum: { $cond: [{ $eq: ["$completionPercent", 100] }, 1, 0] },
        },
        neverStarted: {
          $sum: { $cond: [{ $eq: ["$completionPercent", 0] }, 1, 0] },
        },
      },
    },
    {
      $lookup: {
        from: "courses",
        localField: "_id",
        foreignField: "_id",
        as: "course",
      },
    },
    { $unwind: "$course" },
    {
      $project: {
        courseId: "$_id",
        courseTitle: "$course.title",
        totalStudents: 1,
        avgCompletion: { $round: ["$avgCompletion", 1] },
        completed: 1,
        neverStarted: 1,
        completionRate: {
          $round: [
            { $multiply: [{ $divide: ["$completed", "$totalStudents"] }, 100] },
            1,
          ],
        },
      },
    },
    { $sort: { totalStudents: -1 } },
  ]);

  return res.json(new ApiResponse(200, stats));
});

export {
  markMaterialWatched,
  getMyProgress,
  getCourseProgress,
  getStudentProgress,
  getPlatformProgressOverview,
};