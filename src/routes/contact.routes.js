import express from "express";

import {
  getContactInfo,
  sendEnquiry,
} from "../controllers/contact.controller.js";

import { optionalAuth } from "../middlewares/optionalAuth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const contactRouter = express.Router();

contactRouter.get("/info", optionalAuth, getContactInfo);

// Accept up to 3 screenshot/attachment files
contactRouter.post(
  "/enquiry",
  optionalAuth,
  upload.array("screenshots", 3),
  sendEnquiry
);

export { contactRouter };