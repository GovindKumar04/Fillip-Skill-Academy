import { ApiError } from "../utils/ApiError.js";
import { sendDirectMail } from "../utils/mail.util.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validate + send a free-form admin email. `files` are multer file objects;
// the caller owns their temp-file cleanup.
export const sendDirectMailService = async ({ to, subject, message, files = [] }) => {
  if (!to?.trim() || !subject?.trim() || !message?.trim()) {
    throw new ApiError(400, "to, subject and message are required");
  }

  const recipients = to.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0) throw new ApiError(400, "Provide at least one recipient email");

  const invalid = recipients.filter((e) => !EMAIL_RE.test(e));
  if (invalid.length) throw new ApiError(400, `Invalid email address(es): ${invalid.join(", ")}`);

  const attachments = files.map((f) => ({ filename: f.originalname, path: f.path }));

  await sendDirectMail({
    to: recipients,
    subject: subject.trim(),
    message: message.trim(),
    attachments,
  });

  return { recipients: recipients.length, attachments: attachments.length };
};
