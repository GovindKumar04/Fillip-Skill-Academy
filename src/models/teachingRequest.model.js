import mongoose from "mongoose";

const teachingRequestSchema = new mongoose.Schema(
  {
    instructorId: {
      type: String, // PostgreSQL user UUID (role = instructor)
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    // Instructors are assigned to teach offline students only
    mode: {
      type: String,
      enum: ["offline"],
      default: "offline",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: {
      type: String, // admin's PG UUID who approved/rejected
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// One request per instructor+course (re-request handled by re-opening the row)
teachingRequestSchema.index({ instructorId: 1, courseId: 1 }, { unique: true });

export const TeachingRequest = mongoose.model("TeachingRequest", teachingRequestSchema);
