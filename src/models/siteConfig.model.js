import mongoose from "mongoose";

const milestoneSchema = new mongoose.Schema({
  value: { type: String, required: true },
  label: { type: String, required: true },
  icon:  { type: String, default: "🏆" },
  order: { type: Number, default: 0 },
}, { _id: false });

const whyChooseSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  icon:        { type: String, default: "✅" },
  order:       { type: Number, default: 0 },
});

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer:   { type: String, required: true },
  order:    { type: Number, default: 0 },
}, { _id: false });

const siteConfigSchema = new mongoose.Schema({
  milestones:  [milestoneSchema],
  whyChooseUs: [whyChooseSchema],
  faqs:        [faqSchema],
}, { timestamps: true });

export const SiteConfig = mongoose.model("SiteConfig", siteConfigSchema);
