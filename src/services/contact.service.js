import { Enrollment } from "../models/enrollment.model.js";
import { Enquiry } from "../models/enquiry.model.js";
import { sendConfirmationMail } from "../utils/mail.util.js";
import { uploadToCloudinary } from "../utils/cloudinary.util.js";
import { ApiError } from "../utils/ApiError.js";

const getWhatsAppNumber = async (user) => {
  if (!user) {
    return {
      number: process.env.WHATSAPP_GUEST,
      type: "Guest Support",
      message: "Hi! I am interested in Fillip Skill Academy courses.",
    };
  }
  if (user.role === "instructor") {
    return {
      number: process.env.WHATSAPP_INSTRUCTOR,
      type: "Instructor Support",
      message: "Hi! I am an instructor and need assistance.",
    };
  }
  if (user.role === "student") {
    const enrollment = await Enrollment.findOne({ userId: user.id, isActive: true });
    if (enrollment) {
      return {
        number: process.env.WHATSAPP_ENROLLED,
        type: "Enrolled Student Support",
        message: "Hi! I am an enrolled student and need help with my course.",
      };
    }
    return {
      number: process.env.WHATSAPP_GUEST,
      type: "Guest Student Support",
      message: "Hi! I am interested in enrolling in Fillip Skill Academy.",
    };
  }
  return { number: process.env.WHATSAPP_GUEST, type: "General Support", message: "Hi! I need assistance." };
};

export const getContactInfoService = async (user) => {
  if (user?.role === "admin") throw new ApiError(403, "Admins use the enquiry portal instead");

  const whatsapp = await getWhatsAppNumber(user || null);
  const whatsappNumber = whatsapp.number.replace(/\D/g, "");
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsapp.message)}`;

  return {
    phone: { number: process.env.ADMIN_PHONE, label: "Call Admin Directly", link: `tel:${process.env.ADMIN_PHONE}` },
    email: { address: process.env.ADMIN_EMAIL, label: "Email Us", link: `mailto:${process.env.ADMIN_EMAIL}` },
    whatsapp: {
      number: whatsapp.number,
      type: whatsapp.type,
      prefilledMessage: whatsapp.message,
      link: whatsappLink,
    },
  };
};

export const sendEnquiryService = async ({ user, subject, message, name, email, phone, category, files }) => {
  if (user?.role === "admin") throw new ApiError(403, "Admins cannot send enquiries");
  if (!subject || !message) throw new ApiError(400, "Subject and message are required");

  const senderName = user?.full_name || name;
  const senderEmail = user?.email || email;
  const senderPhone = user?.phone || phone;
  const role = user?.role || "guest";

  if (!senderName || !senderEmail) throw new ApiError(400, "Name and email are required for guest enquiries");

  // Upload screenshots to Cloudinary (if any)
  const attachments = [];
  if (files?.length) {
    for (const file of files) {
      const type = file.mimetype === "application/pdf" ? "pdf" : "image";
      const uploaded = await uploadToCloudinary(file.path, file.mimetype, "enquiry-attachments");
      attachments.push({ url: uploaded.url, publicId: uploaded.publicId, type });
    }
  }

  const enquiry = await Enquiry.create({
    name: senderName,
    email: senderEmail,
    phone: senderPhone,
    subject,
    message,
    role,
    category: category || "general",
    attachments,
    replies: [{ message, sentBy: "user", sentAt: new Date() }],
  });

  await sendConfirmationMail({ name: senderName, email: senderEmail, subject, message, ticketId: enquiry.ticketId });

  return { ticketId: enquiry.ticketId };
};
