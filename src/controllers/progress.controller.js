import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  markMaterialWatchedService,
  getMyProgressService,
  getCourseProgressService,
  getStudentProgressService,
  getPlatformProgressOverviewService,
} from "../services/progress.service.js";

// POST /progress/mark-watched
const markMaterialWatched = asyncHandler(async (req, res) => {
  const { courseId, materialId, watchPercent } = req.body;
  const data = await markMaterialWatchedService({ userId: req.user.id, courseId, materialId, watchPercent });
  return res.json(new ApiResponse(200, data, "Progress updated"));
});

// GET /progress/my-progress/:courseId
const getMyProgress = asyncHandler(async (req, res) => {
  const data = await getMyProgressService({ userId: req.user.id, courseId: req.params.courseId });
  return res.json(new ApiResponse(200, data));
});

// GET /progress/course/:courseId  (admin / assigned instructor)
const getCourseProgress = asyncHandler(async (req, res) => {
  const data = await getCourseProgressService({ courseId: req.params.courseId, query: req.query, user: req.user });
  return res.json(new ApiResponse(200, data));
});

// GET /progress/student/:userId  (admin)
const getStudentProgress = asyncHandler(async (req, res) => {
  const data = await getStudentProgressService(req.params.userId);
  return res.json(new ApiResponse(200, data));
});

// GET /progress/overview  (admin only)
const getPlatformProgressOverview = asyncHandler(async (req, res) => {
  const stats = await getPlatformProgressOverviewService();
  return res.json(new ApiResponse(200, stats));
});

export {
  markMaterialWatched,
  getMyProgress,
  getCourseProgress,
  getStudentProgress,
  getPlatformProgressOverview,
};
