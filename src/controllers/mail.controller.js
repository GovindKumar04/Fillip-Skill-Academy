import fs from "fs";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendDirectMailService } from "../services/mail.service.js";

// POST /mail/send  (admin only, multipart)
// Body: { to, subject, message } + attachments[] files
//   to → one or more emails (comma / semicolon / newline separated)
const sendMail = asyncHandler(async (req, res) => {
  const { to, subject, message } = req.body;
  const files = req.files || [];

  // Always remove the temp upload files, success or failure.
  const cleanup = () =>
    files.forEach((f) => {
      try { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch { /* ignore */ }
    });

  try {
    const { recipients, attachments } = await sendDirectMailService({ to, subject, message, files });
    return res.json(
      new ApiResponse(
        200,
        { recipients, attachments },
        `Email sent to ${recipients} recipient(s)${attachments ? ` with ${attachments} attachment(s)` : ""}`
      )
    );
  } finally {
    cleanup();
  }
});

export { sendMail };
