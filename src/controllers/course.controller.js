import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  createCourseService,
  getAllCoursesService,
  getCourseCategoriesService,
  getCourseByIdService,
  getCourseBySlugService,
  updateCourseService,
  deleteCourseService,
} from "../services/course.service.js";

const createCourse = asyncHandler(async (req, res) => {
  const course = await createCourseService({ body: req.body, file: req.file, userId: req.user.id });
  return res.status(201).json(new ApiResponse(201, course, "Course created successfully"));
});

const getAllCourses = asyncHandler(async (req, res) => {
  const data = await getAllCoursesService({ query: req.query, user: req.user });
  return res.json(new ApiResponse(200, data));
});

// GET /courses/categories — distinct categories (published only for non-admins)
const getCourseCategories = asyncHandler(async (req, res) => {
  const categories = await getCourseCategoriesService(req.user);
  return res.json(new ApiResponse(200, categories));
});

const getCourseById = asyncHandler(async (req, res) => {
  const course = await getCourseByIdService({ courseId: req.params.courseId, user: req.user });
  return res.json(new ApiResponse(200, course));
});

const getCourseBySlug = asyncHandler(async (req, res) => {
  const course = await getCourseBySlugService({ slug: req.params.slug, user: req.user });
  return res.json(new ApiResponse(200, course));
});

const updateCourse = asyncHandler(async (req, res) => {
  const course = await updateCourseService({ courseId: req.params.courseId, body: req.body, file: req.file });
  return res.json(new ApiResponse(200, course, "Course updated successfully"));
});

const deleteCourse = asyncHandler(async (req, res) => {
  await deleteCourseService(req.params.courseId);
  return res.json(new ApiResponse(200, null, "Course deleted successfully"));
});

export { createCourse, getAllCourses, getCourseCategories, getCourseById, getCourseBySlug, updateCourse, deleteCourse };
