import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  applyForScholarshipService,
  getMyApplicationsService,
  getAllApplicationsService,
  getScholarshipStatsService,
  reviewApplicationService,
} from "../services/scholarship.service.js";

// POST /scholarships  (student)
const applyForScholarship = asyncHandler(async (req, res) => {
  const application = await applyForScholarshipService({ userId: req.user.id, ...req.body });
  return res.status(201).json(new ApiResponse(201, application, "Scholarship application submitted"));
});

// GET /scholarships/my  (student)
const getMyApplications = asyncHandler(async (req, res) => {
  const applications = await getMyApplicationsService(req.user.id);
  return res.json(new ApiResponse(200, applications));
});

// GET /scholarships  (admin)
const getAllApplications = asyncHandler(async (req, res) => {
  const data = await getAllApplicationsService(req.query);
  return res.json(new ApiResponse(200, data));
});

// GET /scholarships/stats  (admin)
const getScholarshipStats = asyncHandler(async (req, res) => {
  const stats = await getScholarshipStatsService();
  return res.json(new ApiResponse(200, stats));
});

// PATCH /scholarships/:id/review  (admin)
const reviewApplication = asyncHandler(async (req, res) => {
  const application = await reviewApplicationService({
    id: req.params.id,
    ...req.body,
    reviewerId: req.user.id,
  });
  return res.json(new ApiResponse(200, application, `Application ${application.status}`));
});

export {
  applyForScholarship,
  getMyApplications,
  getAllApplications,
  getScholarshipStats,
  reviewApplication,
};
