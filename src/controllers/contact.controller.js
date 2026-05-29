import { Enrollment } from "../models/enrollment.model.js";
import { Enquiry } from "../models/enquiry.model.js";
import { sendConfirmationMail } from "../utils/mail.util.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
  return {
    number: process.env.WHATSAPP_GUEST,
    type: "General Support",
    message: "Hi! I need assistance.",
  };
};

// GET /contact/info
const getContactInfo = asyncHandler(async (req, res) => {
  if (req.user?.role === "admin") {
    throw new ApiError(403, "Admins use the enquiry portal instead");
  }

  const whatsapp = await getWhatsAppNumber(req.user || null);
  const whatsappNumber = whatsapp.number.replace(/\D/g, "");
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsapp.message)}`;

  return res.json(
    new ApiResponse(200, {
      phone: {
        number: process.env.ADMIN_PHONE,
        label: "Call Admin Directly",
        link: `tel:${process.env.ADMIN_PHONE}`,
      },
      email: {
        address: process.env.ADMIN_EMAIL,
        label: "Email Us",
        link: `mailto:${process.env.ADMIN_EMAIL}`,
      },
      whatsapp: {
        number: whatsapp.number,
        type: whatsapp.type,
        prefilledMessage: whatsapp.message,
        link: whatsappLink,
      },
    })
  );
});

// POST /contact/enquiry
const sendEnquiry = asyncHandler(async (req, res) => {
  if (req.user?.role === "admin") {
    throw new ApiError(403, "Admins cannot send enquiries");
  }

  const { subject, message, name, email, phone, category } = req.body;

  if (!subject || !message) {
    throw new ApiError(400, "Subject and message are required");
  }

  const senderName  = req.user?.full_name || name;
  const senderEmail = req.user?.email || email;
  const senderPhone = req.user?.phone || phone;
  const role        = req.user?.role || "guest";

  if (!senderName || !senderEmail) {
    throw new ApiError(400, "Name and email are required for guest enquiries");
  }

  // Save to MongoDB
  const enquiry = await Enquiry.create({
    name: senderName,
    email: senderEmail,
    phone: senderPhone,
    subject,
    message,
    role,
    category: category || "general",
    replies: [
      {
        message,
        sentBy: "user",
        sentAt: new Date(),
      },
    ],
  });

  // Send confirmation to user
  await sendConfirmationMail({
    name: senderName,
    email: senderEmail,
    subject,
    message,
    ticketId: enquiry.ticketId,
  });

  return res.json(
    new ApiResponse(200, { ticketId: enquiry.ticketId },
      `Enquiry submitted! Your ticket ID is ${enquiry.ticketId}. We will get back to you within 24 hours.`
    )
  );
});

export { getContactInfo, sendEnquiry };