import { Enquiry } from "../models/enquiry.model.js";
import { sendReplyMail } from "../utils/mail.util.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// GET /enquiries  — list all with filters
const getAllEnquiries = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 10,
    status, role, priority,
    category, search
  } = req.query;

  const filter = {};
  if (status)   filter.status = status;
  if (role)     filter.role = role;
  if (priority) filter.priority = priority;
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { name:     { $regex: search, $options: "i" } },
      { email:    { $regex: search, $options: "i" } },
      { subject:  { $regex: search, $options: "i" } },
      { ticketId: { $regex: search, $options: "i" } },
    ];
  }

  const enquiries = await Enquiry.find(filter)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .select("-replies")           // don't load replies in list view
    .sort({ createdAt: -1 });

  const total = await Enquiry.countDocuments(filter);

  return res.json(
    new ApiResponse(200, {
      enquiries,
      total,
      page: Number(page),
      limit: Number(limit),
    })
  );
});

// GET /enquiries/stats  — dashboard numbers
const getEnquiryStats = asyncHandler(async (req, res) => {
  const [statusStats, roleStats, categoryStats] = await Promise.all([
    // Count by status
    Enquiry.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    // Count by role
    Enquiry.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } }
    ]),
    // Count by category
    Enquiry.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]),
  ]);

  const total = await Enquiry.countDocuments();

  // Average response time (only resolved tickets)
  const resolved = await Enquiry.find({ status: "resolved", respondedAt: { $exists: true } })
    .select("createdAt respondedAt");

  let avgResponseTime = null;
  if (resolved.length > 0) {
    const totalMs = resolved.reduce((sum, e) => {
      return sum + (e.respondedAt - e.createdAt);
    }, 0);
    const avgMs = totalMs / resolved.length;
    avgResponseTime = `${(avgMs / (1000 * 60 * 60)).toFixed(1)} hours`;
  }

  return res.json(
    new ApiResponse(200, {
      total,
      byStatus:   statusStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      byRole:     roleStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      byCategory: categoryStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      avgResponseTime,
    })
  );
});

// GET /enquiries/:id  — single enquiry with full reply history
const getEnquiryById = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) throw new ApiError(404, "Enquiry not found");

  // Build direct contact links for admin
  const callLink      = enquiry.phone ? `tel:${enquiry.phone}` : null;
  const whatsappLink  = enquiry.phone
    ? `https://wa.me/${enquiry.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${enquiry.name}, this is Fillip Skill Academy regarding your enquiry ${enquiry.ticketId}`)}`
    : null;
  const mailLink = `mailto:${enquiry.email}?subject=Re: [${enquiry.ticketId}] ${enquiry.subject}`;

  return res.json(
    new ApiResponse(200, {
      enquiry,
      contactLinks: { callLink, whatsappLink, mailLink },
    })
  );
});

// POST /enquiries/:id/reply  — admin replies, mail sent to user
const replyToEnquiry = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) throw new ApiError(400, "Reply message is required");

  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) throw new ApiError(404, "Enquiry not found");

  if (enquiry.status === "resolved") {
    throw new ApiError(400, "Cannot reply to a resolved enquiry");
  }

  // Save reply to DB
  enquiry.replies.push({ message, sentBy: "admin", sentAt: new Date() });
  enquiry.status = "contacted";
  enquiry.respondedAt = enquiry.respondedAt || new Date();
  await enquiry.save();

  // Send reply mail to user
  await sendReplyMail({
    name: enquiry.name,
    email: enquiry.email,
    ticketId: enquiry.ticketId,
    subject: enquiry.subject,
    replyMessage: message,
  });

  return res.json(new ApiResponse(200, enquiry, "Reply sent successfully"));
});

// PATCH /enquiries/:id/status  — update status + optional admin note
const updateEnquiryStatus = asyncHandler(async (req, res) => {
  const { status, adminNote, priority } = req.body;

  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) throw new ApiError(404, "Enquiry not found");

  if (status)    enquiry.status    = status;
  if (adminNote) enquiry.adminNote = adminNote;
  if (priority)  enquiry.priority  = priority;
  if (status === "resolved") enquiry.respondedAt = enquiry.respondedAt || new Date();

  await enquiry.save();

  return res.json(new ApiResponse(200, enquiry, "Enquiry updated successfully"));
});

export {
  getAllEnquiries,
  getEnquiryStats,
  getEnquiryById,
  replyToEnquiry,
  updateEnquiryStatus,
};