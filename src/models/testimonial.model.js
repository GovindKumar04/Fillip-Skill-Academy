import mongoose from "mongoose";

const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, default: "", trim: true },   // e.g. "Co-founder, PayGlobal"
    quote: { type: String, required: true, trim: true },

    avatar: { type: String, default: "" },
    avatarPublicId: { type: String, default: "" },

    rating: { type: Number, min: 1, max: 5, default: null }, // optional 1–5

    // Course this testimonial belongs to (Course _id as a string). null = a
    // global testimonial shown on the homepage.
    courseId: { type: String, default: null },

    order: { type: Number, default: 0 },        // manual sort (lower = first)
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Public listing: published, by manual order then newest, scoped by course.
testimonialSchema.index({ courseId: 1, isPublished: 1, order: 1, createdAt: -1 });

export const Testimonial = mongoose.model("Testimonial", testimonialSchema);
