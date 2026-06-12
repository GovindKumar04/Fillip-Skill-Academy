import { Enrollment } from "../models/enrollment.model.js";
import { Progress } from "../models/progress.model.js";
import { Course } from "../models/course.model.js";
import { ApiError } from "../utils/ApiError.js";
import { sendBroadcastMail } from "../utils/mail.util.js";
import { getOfflineAttendance } from "../utils/attendance.util.js";
import pool from "../config/db.js";

export const checkMyEnrollmentService = async ({ userId, courseId }) => {
  const enrollment = await Enrollment.findOne({ userId, courseId, isActive: true }).select("enrollmentType");
  if (!enrollment) return { isEnrolled: false, enrollmentType: null };
  return { isEnrolled: true, enrollmentType: enrollment.enrollmentType };
};

// Admin enrolls a student. Returns { enrollment, reEnrolled } for the status code.
export const enrollStudentService = async ({ userId, courseId, enrollmentType = "online", enrolledBy }) => {
  if (!userId || !courseId) throw new ApiError(400, "userId and courseId are required");

  const userResult = await pool.query("SELECT id, full_name, email, role FROM users WHERE id = $1", [userId]);
  if (userResult.rows.length === 0) throw new ApiError(404, "User not found");
  if (userResult.rows[0].role !== "student") throw new ApiError(400, "Only students can be enrolled in courses");

  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, "Course not found");
  if (Array.isArray(course.modes) && course.modes.length && !course.modes.includes(enrollmentType)) {
    throw new ApiError(400, `This course is not available ${enrollmentType}.`);
  }

  const existing = await Enrollment.findOne({ userId, courseId });
  if (existing) {
    if (existing.isActive) throw new ApiError(409, "Student is already enrolled in this course");
    existing.isActive = true;
    existing.unenrolledAt = null;
    existing.enrolledBy = enrolledBy;
    existing.enrollmentType = enrollmentType;
    await existing.save();
    return { enrollment: existing, reEnrolled: true };
  }

  const enrollment = await Enrollment.create({ userId, courseId, enrolledBy, enrollmentType });
  await Progress.create({ userId, courseId });
  return { enrollment, reEnrolled: false };
};

export const unenrollStudentService = async (enrollmentId) => {
  const enrollment = await Enrollment.findById(enrollmentId);
  if (!enrollment) throw new ApiError(404, "Enrollment not found");
  if (!enrollment.isActive) throw new ApiError(400, "Student is already unenrolled");

  enrollment.isActive = false;
  enrollment.unenrolledAt = new Date();
  await enrollment.save();
  return enrollment;
};

export const getMyCoursesService = async (userId) => {
  const enrollments = (await Enrollment.find({ userId, isActive: true }).populate({
    path: "courseId",
    select: "title description thumbnail category level price slug duration",
  })).filter((e) => e.courseId);

  const progressDocs = await Progress.find({
    userId,
    courseId: { $in: enrollments.map((e) => e.courseId._id) },
  }).select("courseId completionPercent lastAccessedAt");

  const progressMap = {};
  progressDocs.forEach((p) => {
    progressMap[p.courseId.toString()] = { completionPercent: p.completionPercent, lastAccessedAt: p.lastAccessedAt };
  });

  return Promise.all(
    enrollments.map(async (e) => {
      const progress = progressMap[e.courseId._id.toString()] || { completionPercent: 0, lastAccessedAt: null };
      const base = {
        enrollmentId: e._id,
        enrolledAt: e.createdAt,
        enrollmentType: e.enrollmentType,
        course: e.courseId,
        progress,
      };

      if (e.enrollmentType === "offline") {
        const att = await getOfflineAttendance(e.userId, e.courseId._id);
        return {
          ...base,
          attendance: att
            ? { present: att.present, totalClasses: att.totalClasses, rate: att.rate, eligible: att.eligible, classesNeeded: att.classesNeeded }
            : null,
          completed: !!(att && att.eligible),
        };
      }
      return { ...base, completed: progress.completionPercent === 100 };
    })
  );
};

export const getCourseStudentsService = async ({ courseId, query, user }) => {
  const { page = 1, limit = 20 } = query;
  const pageNum = Number(page);
  const limitNum = Number(limit);

  const course = await Course.findById(courseId).select("title instructorId");
  if (!course) throw new ApiError(404, "Course not found");
  if (user.role === "instructor" && course.instructorId !== user.id) {
    throw new ApiError(403, "You can only view students in your own courses");
  }

  const [enrollments, total] = await Promise.all([
    Enrollment.find({ courseId, isActive: true }).skip((pageNum - 1) * limitNum).limit(limitNum).sort({ createdAt: -1 }),
    Enrollment.countDocuments({ courseId, isActive: true }),
  ]);

  if (enrollments.length === 0) return { students: [], total: 0, page: pageNum, limit: limitNum };

  const userIds = enrollments.map((e) => e.userId);
  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(", ");
  const usersResult = await pool.query(
    `SELECT id, full_name, email, roll_number, phone, avatar FROM users WHERE id IN (${placeholders})`,
    userIds
  );
  const usersMap = {};
  usersResult.rows.forEach((u) => (usersMap[u.id] = u));

  const progressDocs = await Progress.find({ userId: { $in: userIds }, courseId })
    .select("userId completionPercent lastAccessedAt completedAt");
  const progressMap = {};
  progressDocs.forEach((p) => (progressMap[p.userId] = p));

  const students = enrollments.map((e) => ({
    enrollmentId: e._id,
    enrolledAt: e.createdAt,
    enrollmentType: e.enrollmentType,
    user: usersMap[e.userId] || { id: e.userId },
    progress: progressMap[e.userId] || { completionPercent: 0, lastAccessedAt: null, completedAt: null },
  }));

  return { students, total, page: pageNum, limit: limitNum };
};

export const getStudentEnrollmentsService = async (userId) => {
  const enrollments = (await Enrollment.find({ userId, isActive: true })
    .populate("courseId", "title thumbnail category level")).filter((e) => e.courseId);

  const progressDocs = await Progress.find({ userId }).select("courseId completionPercent lastAccessedAt completedAt");
  const progressMap = {};
  progressDocs.forEach((p) => (progressMap[p.courseId.toString()] = p));

  return enrollments.map((e) => ({
    enrollmentId: e._id,
    enrolledAt: e.createdAt,
    course: e.courseId,
    progress: progressMap[e.courseId._id.toString()] || { completionPercent: 0, lastAccessedAt: null },
  }));
};

export const getAllEnrollmentsService = async (query) => {
  const { page = 1, limit = 10, search = "" } = query;
  const pageNum = Number(page);
  const limitNum = Number(limit);

  const filter = { isActive: true };
  const [enrollments, total] = await Promise.all([
    Enrollment.find(filter)
      .populate("courseId", "title category level thumbnail")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .sort({ createdAt: -1 }),
    Enrollment.countDocuments(filter),
  ]);

  if (enrollments.length === 0) {
    return { enrollments: [], total: 0, page: pageNum, limit: limitNum, totalPages: 0 };
  }

  const userIds = enrollments.map((e) => e.userId);
  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(", ");
  const usersResult = await pool.query(
    `SELECT id, full_name, email, roll_number, phone, avatar FROM users WHERE id IN (${placeholders})`,
    userIds
  );
  const usersMap = {};
  usersResult.rows.forEach((u) => (usersMap[u.id] = u));

  let data = enrollments.map((e) => ({
    id: e._id,
    enrolledAt: e.createdAt,
    enrollmentType: e.enrollmentType,
    user: usersMap[e.userId] || { id: e.userId },
    course: e.courseId,
  }));

  if (search) {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    data = data.filter((d) => {
      const haystack = [d.user?.full_name, d.user?.email, d.user?.roll_number, d.course?.title, d.course?.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }

  return { enrollments: data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
};

export const getUnenrolledStudentsService = async ({ search = "" }) => {
  const enrolledIds = await Enrollment.find({ isActive: true }).distinct("userId");
  const enrolledSet = new Set(enrolledIds.map(String));

  const conditions = ["role = 'student'"];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(full_name ILIKE $${params.length} OR email ILIKE $${params.length} OR roll_number ILIKE $${params.length})`);
  }

  const result = await pool.query(
    `SELECT id, full_name, email, roll_number, phone, location, avatar, created_at
       FROM users WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
    params
  );

  const students = result.rows.filter((u) => !enrolledSet.has(String(u.id)));
  return { students, total: students.length };
};

// Bulk-email students. userIds given → those; absent → all unenrolled students.
export const broadcastEmailService = async ({ subject, message, userIds }) => {
  if (!subject?.trim() || !message?.trim()) throw new ApiError(400, "subject and message are required");

  let targetIds;
  if (Array.isArray(userIds) && userIds.length > 0) {
    targetIds = userIds;
  } else {
    const enrolledIds = await Enrollment.find({ isActive: true }).distinct("userId");
    const enrolledSet = new Set(enrolledIds.map(String));
    const all = await pool.query("SELECT id FROM users WHERE role = 'student'");
    targetIds = all.rows.map((r) => r.id).filter((id) => !enrolledSet.has(String(id)));
  }

  if (targetIds.length === 0) throw new ApiError(400, "No recipients to email");

  const placeholders = targetIds.map((_, i) => `$${i + 1}`).join(", ");
  const usersResult = await pool.query(
    `SELECT id, full_name, email FROM users WHERE role = 'student' AND id IN (${placeholders})`,
    targetIds
  );
  if (usersResult.rows.length === 0) throw new ApiError(404, "No matching students found");

  const subjectClean = subject.trim();
  const messageClean = message.trim();

  // Throttled batches so a large blast doesn't trip SMTP rate limits.
  const BATCH_SIZE = 20;
  const BATCH_DELAY_MS = 1000;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const recipients = usersResult.rows;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((u) => sendBroadcastMail({ name: u.full_name, email: u.email, subject: subjectClean, message: messageClean }))
    );
    sent += results.filter((r) => r.status === "fulfilled").length;
    failed += results.filter((r) => r.status === "rejected").length;
    if (i + BATCH_SIZE < recipients.length) await sleep(BATCH_DELAY_MS);
  }

  return { sent, failed, total: recipients.length };
};
