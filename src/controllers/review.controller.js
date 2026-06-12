import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  addOrUpdateReviewService,
  deleteReviewService,
  getReviewsService,
  getTestimonialsService,
  toggleFeaturedService,
} from "../services/review.service.js";

// POST /courses/:courseId/reviews
const addOrUpdateReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const result = await addOrUpdateReviewService({
    courseId: req.params.courseId,
    userId: String(req.user.id),
    rating,
    comment,
  });
  return res.status(200).json(
    new ApiResponse(
      200,
      { averageRating: result.averageRating, totalReviews: result.totalReviews },
      result.updated ? "Review updated" : "Review added"
    )
  );
});

// DELETE /courses/:courseId/reviews — own review; admin can pass ?userId=
const deleteReview = asyncHandler(async (req, res) => {
  const targetUserId =
    req.user.role === "admin" && req.query.userId ? String(req.query.userId) : String(req.user.id);
  await deleteReviewService({ courseId: req.params.courseId, targetUserId });
  return res.json(new ApiResponse(200, null, "Review deleted"));
});

// GET /courses/:courseId/reviews
const getReviews = asyncHandler(async (req, res) => {
  const data = await getReviewsService({ courseId: req.params.courseId, ...req.query });
  return res.json(new ApiResponse(200, data));
});

// GET /courses/:courseId/reviews/testimonials
const getTestimonials = asyncHandler(async (req, res) => {
  const testimonials = await getTestimonialsService({ courseId: req.params.courseId });
  return res.json(new ApiResponse(200, testimonials));
});

// PATCH /courses/:courseId/reviews/featured — admin toggles testimonial status
const toggleFeatured = asyncHandler(async (req, res) => {
  const review = await toggleFeaturedService({
    courseId: req.params.courseId,
    targetUserId: req.body.userId,
    isFeatured: req.body.isFeatured,
  });
  return res.json(
    new ApiResponse(200, review, `Review ${review.isFeatured ? "marked as testimonial" : "removed from testimonials"}`)
  );
});

export { addOrUpdateReview, deleteReview, getReviews, getTestimonials, toggleFeatured };
