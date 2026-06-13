// Seed a few per-course testimonials (attached to real courses by title).
//
// Run:  cd backend && npm run seed:course-testimonials
//
// Idempotent — upserts by (name + courseId). Skips courses that don't exist.

import "dotenv/config";
import connectMongoDB from "../config/mongodb.js";
import { Course } from "../models/course.model.js";
import { Testimonial } from "../models/testimonial.model.js";
import { bumpNs } from "../utils/cache.js";

// Keyed by course title (matched case-insensitively).
const BY_COURSE = {
  "Full Stack Web Development Professional": [
    { name: "Rahul Mehta", role: "Software Engineer", rating: 5, quote: "This was the most hands-on course I've taken. I built and deployed a full MERN project, and that portfolio piece got me my first developer job." },
    { name: "Sana Iqbal", role: "Frontend Developer", rating: 5, quote: "The mentors actually reviewed my code. I went from struggling with React to confidently building full-stack apps." },
  ],
  "UI/UX Design Mastery": [
    { name: "Aman Kumar", role: "UI/UX Designer", rating: 5, quote: "Completely project-driven. I finished with three real case studies in Figma and started getting interview calls within weeks." },
  ],
  "Digital Marketing Mastery": [
    { name: "Neha Gupta", role: "Marketing Associate", rating: 5, quote: "I learned SEO, Google Ads, and social media with live campaigns — not just theory. I now run paid campaigns at my company." },
  ],
  "Cybersecurity Professional": [
    { name: "Vikram Singh", role: "Security Analyst", rating: 5, quote: "Hands-on labs made all the difference. The course gave me the practical skills to clear my first cybersecurity interview." },
  ],
  "Data Science & Analytics Expert": [
    { name: "Priya Verma", role: "Data Analyst", rating: 4, quote: "Strong fundamentals in Python and analytics, with real datasets to practice on. The capstone project really tied it all together." },
  ],
};

async function seed() {
  try {
    await connectMongoDB();
    let created = 0, updated = 0, skipped = 0, order = 0;

    for (const [title, items] of Object.entries(BY_COURSE)) {
      const course = await Course.findOne({ title: new RegExp(`^${title}$`, "i") }).select("_id");
      if (!course) { console.log(`– skipped (no course): ${title}`); skipped += items.length; continue; }

      for (const item of items) {
        const res = await Testimonial.updateOne(
          { name: item.name, courseId: String(course._id) },
          { $set: { ...item, courseId: String(course._id), order: order++, isPublished: true } },
          { upsert: true }
        );
        if (res.upsertedCount) created++; else updated++;
      }
    }

    await bumpNs("testimonials"); // invalidate per-course + global list caches
    console.log(`✅ Course testimonials seeded — ${created} created, ${updated} updated, ${skipped} skipped.`);
    process.exit(0);
  } catch (error) {
    console.error("Course-testimonial seed failed:");
    console.error(error);
    process.exit(1);
  }
}

seed();
