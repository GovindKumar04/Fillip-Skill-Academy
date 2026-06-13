import express from "express";
import {
  getBlogs,
  getBlog,
  createBlog,
  updateBlog,
  deleteBlog,
} from "../controllers/blog.controller.js";
import { optionalAuth } from "../middlewares/optionalAuth.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { audit } from "../middlewares/audit.middleware.js";

const blogRouter = express.Router();

// Public reads. optionalAuth lets an admin see drafts (?all=1 / by id) while
// anonymous visitors only get published posts.
blogRouter.get("/", optionalAuth, getBlogs);
blogRouter.get("/:idOrSlug", optionalAuth, getBlog);

// Admin writes (cover image field name: "image").
blogRouter.post("/", verifyJWT, requireRole("admin"), upload.single("image"), audit("blog.create"), createBlog);
blogRouter.patch("/:id", verifyJWT, requireRole("admin"), upload.single("image"), audit("blog.update"), updateBlog);
blogRouter.delete("/:id", verifyJWT, requireRole("admin"), audit("blog.delete"), deleteBlog);

export { blogRouter };
