import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadMaterialsService, deleteMaterialService } from "../services/material.service.js";

// POST /api/courses/:courseId/modules/:moduleId/materials
const uploadMaterials = asyncHandler(async (req, res) => {
  const savedMaterials = await uploadMaterialsService({
    courseId: req.params.courseId,
    moduleId: req.params.moduleId,
    files: req.files,
    titlesRaw: req.body.titles,
  });
  return res
    .status(201)
    .json(new ApiResponse(201, savedMaterials, `${savedMaterials.length} material(s) uploaded successfully`));
});

// DELETE /api/courses/:courseId/modules/:moduleId/materials/:materialId
const deleteMaterial = asyncHandler(async (req, res) => {
  await deleteMaterialService({ moduleId: req.params.moduleId, materialId: req.params.materialId });
  return res.json(new ApiResponse(200, null, "Material deleted successfully"));
});

export { uploadMaterials, deleteMaterial };
