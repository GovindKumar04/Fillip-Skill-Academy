import { Course } from "../models/course.model.js";
import { Enrollment } from "../models/enrollment.model.js";
import { ApiError } from "../utils/ApiError.js";
import pool from "../config/db.js";

const recalcRating = (course) => {
  if (course.reviews.length === 0) {
    course.averageRating = 0;
    course.totalReviews = 0;
    return;
  }
  const sum = course.reviews.reduce((acc, r) => acc + r.rating, 0);
  course.averageRating = Math.round((sum / course.reviews.length) * 10) / 10;
  course.totalReviews = course.reviews.length;
};

const fetchUserMap = async (userIds) => {
  if (!userIds.length) return {};
  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(", ");
  const result = await pool.query(
    `SELECT id::text AS id, full_name, avatar FROM users WHERE id::text IN (${placeholders})`,
    userIds
  );
  const map = {};
  result.rows.forEach((u) => (map[u.id] = u));
  return map;
};

// Enrolled student adds or updates their review (one per user per course)
export const addOrUpdateReviewService = async ({ courseId, userId, rating, comment }) => {
  if (!rating || rating < 1 || rating > 5) throw new ApiError(400, "Rating must be between 1 and 5");

  const enrollment = await Enrollment.findOne({ userId, courseId, isActive: true });
  if (!enrollment) throw new ApiError(403, "You must be enrolled in this course to leave a review");

  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, "Course not found");

  const existingIndex = course.reviews.findIndex((r) => r.userId === userId);
  if (existingIndex !== -1) {
    course.reviews[existingIndex].rating = rating;
    course.reviews[existingIndex].comment = comment || "";
    course.reviews[existingIndex].createdAt = new Date();
  } else {
    course.reviews.push({ userId, rating, comment: comment || "" });
  }

  recalcRating(course);
  await course.save();

  return {
    updated: existingIndex !== -1,
    averageRating: course.averageRating,
    totalReviews: course.totalReviews,
  };
};

export const deleteReviewService = async ({ courseId, targetUserId }) => {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, "Course not found");

  const index = course.reviews.findIndex((r) => r.userId === targetUserId);
  if (index === -1) throw new ApiError(404, "Review not found");

  course.reviews.splice(index, 1);
  recalcRating(course);
  await course.save();
};

export const getReviewsService = async ({ courseId, page = 1, limit = 10 }) => {
  const pageNum = Number(page);
  const limitNum = Number(limit);

  const course = await Course.findById(courseId).select("reviews averageRating totalReviews title");
  if (!course) throw new ApiError(404, "Course not found");

  const start = (pageNum - 1) * limitNum;
  const paginated = course.reviews.slice(start, start + limitNum);
  const usersMap = await fetchUserMap(paginated.map((r) => r.userId));

  const reviews = paginated.map((r) => ({ ...r.toObject(), user: usersMap[r.userId] || { id: r.userId } }));

  return {
    reviews,
    total: course.reviews.length,
    averageRating: course.averageRating,
    page: pageNum,
    limit: limitNum,
  };
};

export const getTestimonialsService = async ({ courseId }) => {
  const course = await Course.findById(courseId).select("reviews averageRating totalReviews title");
  if (!course) throw new ApiError(404, "Course not found");

  const featured = course.reviews.filter((r) => r.isFeatured);
  const usersMap = await fetchUserMap(featured.map((r) => r.userId));

  return featured.map((r) => ({ ...r.toObject(), user: usersMap[r.userId] || { id: r.userId } }));
};

export const toggleFeaturedService = async ({ courseId, targetUserId, isFeatured }) => {
  if (!targetUserId) throw new ApiError(400, "userId is required");

  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, "Course not found");

  const review = course.reviews.find((r) => r.userId === String(targetUserId));
  if (!review) throw new ApiError(404, "Review not found");

  review.isFeatured = isFeatured !== undefined ? isFeatured : !review.isFeatured;
  await course.save();
  return review;
};
