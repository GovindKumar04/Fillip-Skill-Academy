// Seed a few starter testimonials for the homepage.
//
// Run:  cd backend && npm run seed:testimonials
//
// Idempotent — upserts by (name + role), so re-running updates rather than dupes.
// Avatars are left blank; the homepage/admin show initials until you upload photos.

import "dotenv/config";
import connectMongoDB from "../config/mongodb.js";
import { Testimonial } from "../models/testimonial.model.js";
import { bumpNs } from "../utils/cache.js";

const ITEMS = [
  {
    name: "Yogesh Lokhande",
    role: "Co-founder, PayGlobal",
    quote: "We have some of our best engineers on board from Fillip Skill Academy. Their ownership and problem-solving make them our top hiring choice.",
    rating: 5,
    order: 1,
  },
  {
    name: "Ritesh Sharma",
    role: "Engineering Manager, BlueTech",
    quote: "Fillip interns consistently show strong fundamentals and real hands-on development experience. They ramp up faster than most.",
    rating: 5,
    order: 2,
  },
  {
    name: "Priya Verma",
    role: "Full-Stack Developer (Fillip Graduate)",
    quote: "I joined with zero coding background. The live projects and mentorship got me job-ready, and I landed my first developer role within three months of finishing.",
    rating: 5,
    order: 3,
  },
  {
    name: "Aman Kumar",
    role: "UI/UX Designer (Fillip Graduate)",
    quote: "The design program was completely project-driven. I walked away with a real portfolio of case studies that got me interviews immediately.",
    rating: 5,
    order: 4,
  },
  {
    name: "Sneha Raj",
    role: "HR Lead, NovaSoft",
    quote: "Hiring from Fillip Skill Academy has been reliable. The candidates come prepared, communicate well, and need very little hand-holding.",
    rating: 4,
    order: 5,
  },
];

async function seed() {
  try {
    await connectMongoDB();
    let created = 0, updated = 0;
    for (const item of ITEMS) {
      const res = await Testimonial.updateOne(
        { name: item.name, role: item.role },
        { $set: { ...item, isPublished: true } },
        { upsert: true }
      );
      if (res.upsertedCount) created++; else updated++;
    }
    await bumpNs("testimonials"); // invalidate the public list cache
    console.log(`✅ Testimonials seeded — ${created} created, ${updated} updated (total ${ITEMS.length}).`);
    process.exit(0);
  } catch (error) {
    console.error("Testimonial seed failed:");
    console.error(error);
    process.exit(1);
  }
}

seed();
