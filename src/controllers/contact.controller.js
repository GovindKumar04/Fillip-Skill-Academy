import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getContactInfoService, sendEnquiryService } from "../services/contact.service.js";

// GET /contact/info
const getContactInfo = asyncHandler(async (req, res) => {
  const info = await getContactInfoService(req.user || null);
  return res.json(new ApiResponse(200, info));
});

// POST /contact/enquiry
const sendEnquiry = asyncHandler(async (req, res) => {
  const { subject, message, name, email, phone, category } = req.body;
  const { ticketId } = await sendEnquiryService({
    user: req.user || null,
    subject, message, name, email, phone, category,
    files: req.files,
  });
  return res.json(
    new ApiResponse(200, { ticketId },
      `Enquiry submitted! Your ticket ID is ${ticketId}. We will get back to you within 24 hours.`
    )
  );
});

export { getContactInfo, sendEnquiry };
