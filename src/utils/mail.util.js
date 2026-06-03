import { transporter } from "../config/nodemailer.js";
import { ApiError } from "./ApiError.js";

// ─── Confirmation mail to user after submitting enquiry ───
export const sendConfirmationMail = async ({ name, email, subject, message, ticketId }) => {
  try {
    await transporter.sendMail({
      from: `"Fillip Skill Academy" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `[${ticketId}] We received your enquiry!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Hi ${name}, we got your message!</h2>
          <p>Your ticket ID is <strong>${ticketId}</strong>. 
             Use this to follow up with us anytime.</p>
          <p>Our team will get back to you within <strong>24 hours</strong>.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb;" />
          <p><strong>Your message:</strong></p>
          <blockquote style="border-left: 4px solid #2563eb; padding-left: 12px; color: #374151;">
            ${message}
          </blockquote>
          <hr style="border: none; border-top: 1px solid #e5e7eb;" />
          <p>You can also reach us directly:</p>
          <ul>
            <li>📞 Call: <a href="tel:${process.env.ADMIN_PHONE}">${process.env.ADMIN_PHONE}</a></li>
            <li>📧 Email: <a href="mailto:${process.env.ADMIN_EMAIL}">${process.env.ADMIN_EMAIL}</a></li>
          </ul>
          <p style="color: #6b7280; font-size: 12px;">Fillip Skill Academy Team</p>
        </div>
      `,
    });
  } catch (error) {
    throw new ApiError(500, `Failed to send confirmation email: ${error.message}`);
  }
};

// ─── Payment confirmation to student ──────────────────────
export const sendPaymentConfirmation = async ({ name, email, courseName, enrollmentType, amountINR, paymentId }) => {
  try {
    await transporter.sendMail({
      from: `"Fillip Skill Academy" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Payment Confirmed — ${courseName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 12px;">
          <div style="background: #1e3a8a; color: white; padding: 24px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
            <h1 style="margin: 0; font-size: 24px;">Payment Confirmed ✓</h1>
            <p style="margin: 8px 0 0; opacity: 0.8;">Fillip Skill Academy</p>
          </div>
          <div style="background: white; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 16px;">Hi <strong>${name}</strong>,</p>
            <p style="color: #374151;">Your payment was successful and you are now enrolled in:</p>
            <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; border-radius: 4px; margin: 16px 0;">
              <p style="margin: 0; font-size: 18px; font-weight: bold; color: #1e3a8a;">${courseName}</p>
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px; text-transform: capitalize;">${enrollmentType} Enrollment</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Amount Paid</td>
                <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #111827;">₹${amountINR.toLocaleString()}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Payment ID</td>
                <td style="padding: 10px 0; text-align: right; font-family: monospace; font-size: 13px; color: #374151;">${paymentId}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Enrollment Type</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #059669; text-transform: capitalize;">${enrollmentType}</td>
              </tr>
            </table>
            <div style="margin-top: 24px; text-align: center;">
              <a href="${process.env.CLIENT_URL || "http://localhost:5173"}/student/my-courses"
                 style="background: #1e3a8a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                Go to My Courses
              </a>
            </div>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
            Questions? Contact us at <a href="mailto:${process.env.ADMIN_EMAIL}" style="color: #2563eb;">${process.env.ADMIN_EMAIL}</a>
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Payment email failed:", error.message);
  }
};

// ─── Batch assignment notification (instructor + students) ─
export const sendBatchAssignmentMail = async ({ name, email, role, courseName, batchName, schedule, location }) => {
  try {
    const roleLine =
      role === "instructor"
        ? "You have been assigned to teach the following offline batch:"
        : "You have been assigned to the following offline batch:";

    await transporter.sendMail({
      from: `"Fillip Skill Academy" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Batch Assigned — ${batchName} (${courseName})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 12px;">
          <div style="background: #4f46e5; color: white; padding: 24px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
            <h1 style="margin: 0; font-size: 22px;">Batch Assigned 🎓</h1>
            <p style="margin: 8px 0 0; opacity: 0.85;">Fillip Skill Academy</p>
          </div>
          <div style="background: white; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 16px;">Hi <strong>${name}</strong>,</p>
            <p style="color: #374151;">${roleLine}</p>
            <div style="background: #eef2ff; border-left: 4px solid #4f46e5; padding: 16px; border-radius: 4px; margin: 16px 0;">
              <p style="margin: 0; font-size: 18px; font-weight: bold; color: #3730a3;">${batchName}</p>
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">${courseName}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">🕒 Timing</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #111827;">${schedule || "To be announced"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">📍 Location</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #111827;">${location || "To be announced"}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">🏫 Mode</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #ea580c;">Offline</td>
              </tr>
            </table>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
            Questions? Contact us at <a href="mailto:${process.env.ADMIN_EMAIL}" style="color: #4f46e5;">${process.env.ADMIN_EMAIL}</a>
          </p>
        </div>
      `,
    });
  } catch (error) {
    // Non-critical — don't block batch creation if mail fails
    console.error(`Batch assignment email failed for ${email}:`, error.message);
  }
};

// ─── Reply mail from admin to user ────────────────────────
export const sendReplyMail = async ({ name, email, ticketId, subject, replyMessage }) => {
  try {
    await transporter.sendMail({
      from: `"Fillip Skill Academy Support" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Re: [${ticketId}] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Hi ${name}!</h2>
          <p>Our team has responded to your enquiry <strong>${ticketId}</strong>.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb;" />
          <p><strong>Response from our team:</strong></p>
          <blockquote style="border-left: 4px solid #2563eb; padding-left: 12px; color: #374151;">
            ${replyMessage}
          </blockquote>
          <hr style="border: none; border-top: 1px solid #e5e7eb;" />
          <p style="color: #6b7280; font-size: 12px;">
            If you have further questions, reply to this email or 
            contact us at ${process.env.ADMIN_EMAIL}
          </p>
          <p style="color: #6b7280; font-size: 12px;">Fillip Skill Academy Team</p>
        </div>
      `,
    });
  } catch (error) {
    throw new ApiError(500, `Failed to send reply email: ${error.message}`);
  }
};