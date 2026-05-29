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