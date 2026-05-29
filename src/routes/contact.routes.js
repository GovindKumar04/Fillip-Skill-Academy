import express from "express";
import { getContactInfo, sendEnquiry } from "../controllers/contact.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const contactRouter = express.Router();

// GET /api/contact/info
// Optional auth — logged-in users get role-based WhatsApp number
// Guests get the guest WhatsApp number
contactRouter.get("/info", (req, res, next) => {
  // Try to verify JWT but don't block if not logged in
  verifyJWT(req, res, (err) => {
    if (err) req.user = null; // guest
    next();
  });
}, getContactInfo);

// POST /api/contact/enquiry
// Optional auth — guests must provide name + email in body
contactRouter.post("/enquiry", (req, res, next) => {
  verifyJWT(req, res, (err) => {
    if (err) req.user = null; // guest
    next();
  });
}, sendEnquiry);

export { contactRouter };