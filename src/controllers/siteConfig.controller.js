import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getSiteConfigService, updateSiteConfigService } from "../services/siteConfig.service.js";

// GET /site-config  — public
const getSiteConfig = asyncHandler(async (req, res) => {
  const config = await getSiteConfigService();
  return res.json(new ApiResponse(200, config));
});

// PUT /site-config  — admin only
const updateSiteConfig = asyncHandler(async (req, res) => {
  const config = await updateSiteConfigService(req.body);
  return res.json(new ApiResponse(200, config, "Site config updated"));
});

export { getSiteConfig, updateSiteConfig };
