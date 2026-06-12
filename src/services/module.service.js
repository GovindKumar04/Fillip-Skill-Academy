import { Course } from "../models/course.model.js";
import { Module } from "../models/module.model.js";
import { Material } from "../models/material.model.js";
import { deleteFromCloudinary } from "../utils/cloudinary.util.js";
import { ApiError } from "../utils/ApiError.js";
import { hasOnlineCourseAccess, stripMaterialUrls } from "../utils/courseAccess.js";

export const createModuleService = async ({ courseId, title, description, order, topics, skills, project }) => {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, "Course not found");
  if (!title) throw new ApiError(400, "Module title is required");

  const mod = await Module.create({
    title,
    description,
    course: course._id,
    order: order ?? course.modules.length,
    topics: Array.isArray(topics) ? topics : [],
    skills: Array.isArray(skills) ? skills : [],
    project: project || "",
  });

  course.modules.push(mod._id);
  await course.save();
  return mod;
};

// Material file URLs are returned only to admins / online-enrolled students;
// everyone else gets the curriculum outline with locked materials.
export const getModulesService = async ({ courseId, user }) => {
  const modules = await Module.find({ course: courseId }).populate("materials").sort("order");
  const plain = modules.map((m) => m.toObject());
  const allowed = await hasOnlineCourseAccess(user, courseId);
  if (!allowed) stripMaterialUrls(plain);
  return plain;
};

export const updateModuleService = async ({ courseId, moduleId, updates }) => {
  const mod = await Module.findOneAndUpdate(
    { _id: moduleId, course: courseId },
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!mod) throw new ApiError(404, "Module not found");
  return mod;
};

export const deleteModuleService = async ({ courseId, moduleId }) => {
  const mod = await Module.findById(moduleId).populate("materials");
  if (!mod) throw new ApiError(404, "Module not found");

  for (const mat of mod.materials) {
    const resType = mat.type === "video" ? "video" : mat.type === "pdf" ? "raw" : "image";
    await deleteFromCloudinary(mat.publicId, resType);
    await Material.findByIdAndDelete(mat._id);
  }

  await Course.findByIdAndUpdate(courseId, { $pull: { modules: mod._id } });
  await Module.findByIdAndDelete(mod._id);
};
