import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
  {
    userId: {
      type: String, // PostgreSQL user UUID
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    enrolledBy: {
      type: String, // admin's PG UUID who enrolled the student
      required: true,
    },
    enrollmentType: {
      type: String,
      enum: ["online", "offline"],
      default: "online",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    unenrolledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Prevent duplicate enrollments for the same user+course
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const Enrollment = mongoose.model("Enrollment", enrollmentSchema);
