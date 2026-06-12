import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  getAllEnquiriesService,
  getEnquiryStatsService,
  getEnquiryByIdService,
  replyToEnquiryService,
  updateEnquiryStatusService,
} from "../services/enquiry.service.js";

// GET /enquiries  — list all with filters
const getAllEnquiries = asyncHandler(async (req, res) => {
  const data = await getAllEnquiriesService(req.query);
  return res.json(new ApiResponse(200, data));
});

// GET /enquiries/stats  — dashboard numbers
const getEnquiryStats = asyncHandler(async (req, res) => {
  const stats = await getEnquiryStatsService();
  return res.json(new ApiResponse(200, stats));
});

// GET /enquiries/:id  — single enquiry with full reply history
const getEnquiryById = asyncHandler(async (req, res) => {
  const data = await getEnquiryByIdService(req.params.id);
  return res.json(new ApiResponse(200, data));
});

// POST /enquiries/:id/reply  — admin replies, mail sent to user
const replyToEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await replyToEnquiryService({ id: req.params.id, message: req.body.message });
  return res.json(new ApiResponse(200, enquiry, "Reply sent successfully"));
});

// PATCH /enquiries/:id/status  — update status + optional admin note
const updateEnquiryStatus = asyncHandler(async (req, res) => {
  const enquiry = await updateEnquiryStatusService({ id: req.params.id, ...req.body });
  return res.json(new ApiResponse(200, enquiry, "Enquiry updated successfully"));
});

export {
  getAllEnquiries,
  getEnquiryStats,
  getEnquiryById,
  replyToEnquiry,
  updateEnquiryStatus,
};
