import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  getEligibleStudentsService,
  issueCertificatesService,
  getIssuedCertificatesService,
} from "../services/certificate.service.js";

// GET /certificates/eligible  (admin only)
const getEligibleStudents = asyncHandler(async (req, res) => {
  const data = await getEligibleStudentsService();
  return res.json(new ApiResponse(200, data));
});

// POST /certificates/issue  (admin only) — Body: { items: [{ userId, courseId }] }
const issueCertificates = asyncHandler(async (req, res) => {
  const result = await issueCertificatesService({ items: req.body.items, issuedBy: req.user.id });
  return res.json(
    new ApiResponse(
      200,
      result,
      `Certificate issued to ${result.sent} student(s)${result.failed ? `, ${result.failed} failed` : ""}`
    )
  );
});

// GET /certificates  (admin only)
const getIssuedCertificates = asyncHandler(async (req, res) => {
  const data = await getIssuedCertificatesService();
  return res.json(new ApiResponse(200, data));
});

export { getEligibleStudents, issueCertificates, getIssuedCertificates };
