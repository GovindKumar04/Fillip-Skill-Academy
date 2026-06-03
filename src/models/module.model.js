import mongoose from "mongoose";

const moduleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    order:    { type: Number, default: 0 },
    topics:   [{ type: String }],
    skills:   [{ type: String }],
    project:  { type: String, default: "" },
    materials: [{ type: mongoose.Schema.Types.ObjectId, ref: "Material" }],
  },
  { timestamps: true }
);

export const Module = mongoose.model("Module", moduleSchema);