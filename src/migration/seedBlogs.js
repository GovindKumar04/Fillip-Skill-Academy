// Seed a few quality blog posts for Fillip Skill Academy.
//
// Run:  cd backend && npm run seed:blogs
//
// Idempotent — upserts by slug, so re-running updates rather than duplicates.

import "dotenv/config";
import connectMongoDB from "../config/mongodb.js";
import { Blog } from "../models/blog.model.js";
import { bumpNs } from "../utils/cache.js";

const POSTS = [
  {
    title: "Top IT Skills to Learn in 2026",
    slug: "top-it-skills-to-learn-in-2026",
    category: "Career",
    readTime: "6 min read",
    excerpt: "The tech job market is shifting fast. Here are the skills that will get you hired and keep you in demand through 2026 and beyond.",
    content: `
<p>The technology landscape changes every year, but a handful of skills consistently open doors to high-paying, future-proof careers. If you are planning your learning path for 2026, focus on these.</p>
<h2>1. Full-Stack Web Development</h2>
<p>Companies love developers who can build an entire product. Master <strong>React</strong> on the frontend and <strong>Node.js</strong> with databases on the backend, and you become valuable to startups and enterprises alike.</p>
<h2>2. Artificial Intelligence &amp; Machine Learning</h2>
<p>AI is no longer optional. Even basic fluency in Python, data handling, and using AI APIs makes you stand out in nearly every role.</p>
<h2>3. Cloud &amp; DevOps</h2>
<p>Knowing how to deploy and scale applications on <strong>AWS</strong>, Azure, or GCP is one of the highest-leverage skills you can have today.</p>
<h2>4. Cybersecurity</h2>
<p>As businesses move online, demand for security professionals keeps rising. It is one of the most stable and well-paid paths in tech.</p>
<h2>5. UI/UX &amp; Digital Marketing</h2>
<p>Great products need great design and reach. Skills in design tools and digital marketing remain in steady demand across industries.</p>
<blockquote>The best time to start was yesterday. The second best time is today — pick one skill and go deep.</blockquote>
<p>At <strong>Fillip Skill Academy</strong>, every program is built around real projects and placement support, so you graduate job-ready, not just certified.</p>
`.trim(),
  },
  {
    title: "Online vs Offline Learning: Which Is Right for You?",
    slug: "online-vs-offline-learning-which-is-right-for-you",
    category: "Learning",
    readTime: "5 min read",
    excerpt: "Both online and offline training have real strengths. Here's how to choose the format that fits your goals, schedule, and learning style.",
    content: `
<p>One of the first questions every learner asks is: should I learn online or in a classroom? There is no single right answer — it depends on you.</p>
<h2>When online learning works best</h2>
<ul>
<li>You have work or college commitments and need flexible timings.</li>
<li>You are self-motivated and comfortable learning from home.</li>
<li>You want to revisit recorded sessions at your own pace.</li>
</ul>
<h2>When offline learning works best</h2>
<ul>
<li>You learn better with face-to-face mentorship and peers around you.</li>
<li>You want a structured routine and fewer distractions.</li>
<li>You value in-person doubt-clearing and hands-on lab time.</li>
</ul>
<h2>The good news</h2>
<p>At <strong>Fillip Skill Academy</strong> you don't have to pick blindly — most of our courses are offered in <strong>both online and offline</strong> modes, so you can choose what suits you and still get the same curriculum, mentors, and placement support.</p>
`.trim(),
  },
  {
    title: "How to Land Your First Tech Job as a Fresher",
    slug: "how-to-land-your-first-tech-job-as-a-fresher",
    category: "Career",
    readTime: "7 min read",
    excerpt: "Breaking into tech as a fresher feels hard, but a clear, practical plan makes it very achievable. Here's the step-by-step path.",
    content: `
<p>Landing your first job in tech can feel overwhelming when you are competing against thousands of applicants. The truth is, a focused approach beats a fancy resume every time.</p>
<h2>1. Build real projects</h2>
<p>Recruiters trust what you have built more than what you have listed. Ship two or three solid projects and put them on GitHub.</p>
<h2>2. Create a simple portfolio</h2>
<p>A clean one-page site with your projects, skills, and contact details makes you look serious and easy to hire.</p>
<h2>3. Practice interviews</h2>
<p>Revise core concepts, practice problem-solving, and do mock interviews until you can explain your thinking out loud with confidence.</p>
<h2>4. Apply widely and follow up</h2>
<ul>
<li>Don't wait until you feel "100% ready" — apply early and often.</li>
<li>Network on LinkedIn and reach out to people in roles you want.</li>
<li>Tailor your resume to each job description.</li>
</ul>
<p>Our training programs at <strong>Fillip Skill Academy</strong> include resume building, mock interviews, and direct connections with hiring partners — so you are never job-hunting alone.</p>
`.trim(),
  },
  {
    title: "Why Full-Stack Development Is a Smart Career Choice",
    slug: "why-full-stack-development-is-a-smart-career-choice",
    category: "Development",
    readTime: "5 min read",
    excerpt: "Full-stack developers are versatile, in-demand, and well-paid. Here's why learning both frontend and backend pays off.",
    content: `
<p>A full-stack developer can work on both the client and server side of an application. That versatility makes them some of the most sought-after professionals in tech.</p>
<h2>Why employers love full-stack developers</h2>
<ul>
<li><strong>Versatility</strong> — they can jump across the whole product.</li>
<li><strong>Cost-effective</strong> — one person covers what used to need two.</li>
<li><strong>Better collaboration</strong> — they understand the full picture.</li>
</ul>
<h2>What you'll learn</h2>
<p>A complete full-stack path covers HTML, CSS, and JavaScript, then <strong>React</strong>, <strong>Node.js</strong>, databases like MongoDB, and finally deployment to the cloud.</p>
<p>Fillip Skill Academy's Full-Stack program takes you from fundamentals to a deployed, portfolio-ready project — with live mentorship the whole way.</p>
`.trim(),
  },
  {
    title: "A Beginner's Guide to UI/UX Design",
    slug: "a-beginners-guide-to-ui-ux-design",
    category: "Design",
    readTime: "6 min read",
    excerpt: "UI and UX are not the same thing. Here's a clear, beginner-friendly look at what they mean and how to start a career in design.",
    content: `
<p>Design is one of the most creative and rewarding careers in tech — and you don't need to be a great artist to start. You need empathy, curiosity, and the right process.</p>
<h2>UI vs UX — what's the difference?</h2>
<p><strong>UX (User Experience)</strong> is about how a product feels to use: is it easy, logical, and helpful? <strong>UI (User Interface)</strong> is about how it looks: colors, typography, spacing, and visual polish.</p>
<h2>Skills to build</h2>
<ul>
<li>Design thinking and user research.</li>
<li>Wireframing and prototyping with tools like Figma.</li>
<li>Visual design fundamentals — layout, color, and type.</li>
<li>Usability testing and iterating on feedback.</li>
</ul>
<h2>How to start</h2>
<p>Redesign an app you use daily, document your reasoning, and build a small portfolio of case studies. That portfolio is what gets you hired.</p>
<p>Fillip Skill Academy's UI/UX Design program is project-driven, so you finish with real case studies and the confidence to apply for design roles.</p>
`.trim(),
  },
];

async function seed() {
  try {
    await connectMongoDB();
    let created = 0, updated = 0;
    for (const post of POSTS) {
      const res = await Blog.updateOne(
        { slug: post.slug },
        { $set: { ...post, author: "Fillip Skill Academy", isPublished: true } },
        { upsert: true }
      );
      if (res.upsertedCount) created++; else updated++;
    }
    await bumpNs("blogs"); // invalidate the public list cache
    console.log(`✅ Blogs seeded — ${created} created, ${updated} updated (total ${POSTS.length}).`);
    process.exit(0);
  } catch (error) {
    console.error("Blog seed failed:");
    console.error(error);
    process.exit(1);
  }
}

seed();
