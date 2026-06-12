import { asyncHandler } from "../utils/asyncHandler.js";
import { Course } from "../models/course.model.js";

const SITE_URL = "https://www.fillipskillacademy.com";

// Static, always-present public routes (mirrors the SPA's public router).
// changefreq/priority are hints only — search engines treat them loosely.
const STATIC_ROUTES = [
  { path: "/",                          changefreq: "weekly",  priority: "1.0" },
  { path: "/courses",                   changefreq: "weekly",  priority: "0.9" },
  { path: "/about",                     changefreq: "monthly", priority: "0.6" },
  { path: "/contact",                   changefreq: "monthly", priority: "0.6" },
  { path: "/blog",                      changefreq: "weekly",  priority: "0.7" },
  { path: "/scholarship",               changefreq: "monthly", priority: "0.5" },
  { path: "/affiliate",                 changefreq: "monthly", priority: "0.5" },
  { path: "/fillip-training",           changefreq: "monthly", priority: "0.7" },
  { path: "/it-training-in-patna",      changefreq: "monthly", priority: "0.7" },
  { path: "/internship-in-patna",       changefreq: "monthly", priority: "0.7" },
  { path: "/web-development-internship", changefreq: "monthly", priority: "0.7" },
];

// Blog posts are still static in the frontend (no backend blog endpoint yet).
// List the known post IDs here; replace with a DB query when blogs move to the API.
const STATIC_BLOG_IDS = ["1", "2", "3"];

const escapeXml = (str = "") =>
  String(str).replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]),
  );

const urlEntry = ({ path, changefreq, priority, lastmod }) =>
  `  <url><loc>${SITE_URL}${escapeXml(path)}</loc>` +
  (lastmod ? `<lastmod>${lastmod}</lastmod>` : "") +
  (changefreq ? `<changefreq>${changefreq}</changefreq>` : "") +
  (priority ? `<priority>${priority}</priority>` : "") +
  `</url>`;

// GET /sitemap.xml — built fresh from published courses + static routes.
const getSitemap = asyncHandler(async (req, res) => {
  const courses = await Course.find({ isPublished: true })
    .select("slug updatedAt")
    .sort({ updatedAt: -1 })
    .lean();

  const courseEntries = courses
    .filter((c) => c.slug)
    .map((c) =>
      urlEntry({
        path: `/course/${c.slug}`,
        changefreq: "weekly",
        priority: "0.8",
        lastmod: c.updatedAt ? new Date(c.updatedAt).toISOString().slice(0, 10) : undefined,
      }),
    );

  const blogEntries = STATIC_BLOG_IDS.map((id) =>
    urlEntry({ path: `/blog/${id}`, changefreq: "monthly", priority: "0.6" }),
  );

  const staticEntries = STATIC_ROUTES.map(urlEntry);

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [...staticEntries, ...courseEntries, ...blogEntries].join("\n") +
    `\n</urlset>\n`;

  res.set("Content-Type", "application/xml");
  res.set("Cache-Control", "public, max-age=3600"); // 1h CDN/browser cache
  return res.send(xml);
});

export { getSitemap };
