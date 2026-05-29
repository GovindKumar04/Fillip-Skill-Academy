import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authrouter } from "./routes/auth.routes.js";
import { courseRouter } from "./routes/course.routes.js";
import { contactRouter } from "./routes/contact.routes.js";
import { enquiryRouter } from "./routes/enquiry.routes.js";

const app = express();

app.use(express.json());
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? process.env.CLIENT_URL  // set CLIENT_URL in .env for production
    : ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
}));
app.use(cookieParser());

app.use("/auth", authrouter);
app.use("/courses", courseRouter);
app.use("/contact", contactRouter);
app.use("/enquiries", enquiryRouter);

// GLOBAL ERROR HANDLER — must be last
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors: err.errors || [],
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

export { app };