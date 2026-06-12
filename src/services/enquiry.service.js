import { Enquiry } from "../models/enquiry.model.js";
import { sendReplyMail } from "../utils/mail.util.js";
import { ApiError } from "../utils/ApiError.js";

export const getAllEnquiriesService = async (query) => {
  const { page = 1, limit = 10, status, role, priority, category, search } = query;

  const filter = {};
  if (status) filter.status = status;
  if (role) filter.role = role;
  if (priority) filter.priority = priority;
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { subject: { $regex: search, $options: "i" } },
      { ticketId: { $regex: search, $options: "i" } },
    ];
  }

  const enquiries = await Enquiry.find(filter)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .select("-replies")
    .sort({ createdAt: -1 });

  const total = await Enquiry.countDocuments(filter);
  return { enquiries, total, page: Number(page), limit: Number(limit) };
};

export const getEnquiryStatsService = async () => {
  const [statusStats, roleStats, categoryStats] = await Promise.all([
    Enquiry.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Enquiry.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    Enquiry.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
  ]);

  const total = await Enquiry.countDocuments();

  const resolved = await Enquiry.find({ status: "resolved", respondedAt: { $exists: true } })
    .select("createdAt respondedAt");

  let avgResponseTime = null;
  if (resolved.length > 0) {
    const totalMs = resolved.reduce((sum, e) => sum + (e.respondedAt - e.createdAt), 0);
    const avgMs = totalMs / resolved.length;
    avgResponseTime = `${(avgMs / (1000 * 60 * 60)).toFixed(1)} hours`;
  }

  return {
    total,
    byStatus: statusStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    byRole: roleStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    byCategory: categoryStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    avgResponseTime,
  };
};

export const getEnquiryByIdService = async (id) => {
  const enquiry = await Enquiry.findById(id);
  if (!enquiry) throw new ApiError(404, "Enquiry not found");

  const callLink = enquiry.phone ? `tel:${enquiry.phone}` : null;
  const whatsappLink = enquiry.phone
    ? `https://wa.me/${enquiry.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${enquiry.name}, this is Fillip Skill Academy regarding your enquiry ${enquiry.ticketId}`)}`
    : null;
  const mailLink = `mailto:${enquiry.email}?subject=Re: [${enquiry.ticketId}] ${enquiry.subject}`;

  return { enquiry, contactLinks: { callLink, whatsappLink, mailLink } };
};

export const replyToEnquiryService = async ({ id, message }) => {
  if (!message) throw new ApiError(400, "Reply message is required");

  const enquiry = await Enquiry.findById(id);
  if (!enquiry) throw new ApiError(404, "Enquiry not found");
  if (enquiry.status === "resolved") throw new ApiError(400, "Cannot reply to a resolved enquiry");

  enquiry.replies.push({ message, sentBy: "admin", sentAt: new Date() });
  enquiry.status = "contacted";
  enquiry.respondedAt = enquiry.respondedAt || new Date();
  await enquiry.save();

  await sendReplyMail({
    name: enquiry.name,
    email: enquiry.email,
    ticketId: enquiry.ticketId,
    subject: enquiry.subject,
    replyMessage: message,
  });

  return enquiry;
};

export const updateEnquiryStatusService = async ({ id, status, adminNote, priority }) => {
  const enquiry = await Enquiry.findById(id);
  if (!enquiry) throw new ApiError(404, "Enquiry not found");

  if (status) enquiry.status = status;
  if (adminNote) enquiry.adminNote = adminNote;
  if (priority) enquiry.priority = priority;
  if (status === "resolved") enquiry.respondedAt = enquiry.respondedAt || new Date();

  await enquiry.save();
  return enquiry;
};
