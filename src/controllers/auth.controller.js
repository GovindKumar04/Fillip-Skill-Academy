import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { registerUserService, loginUserService } from "../services/auth.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { cookieOptions } from "../middlewares/cookie.options.js";
import { generateAccessToken } from "../utils/jwt.utils.js";
import pool from "../config/db.js";

export const registerUser = asyncHandler(async (req, res) => {
  const { full_name, email, password, role, phone, location, referralCode } = req.body;

  if (role === "admin") throw new ApiError(401, "Admin user can't be registered");

  if (!full_name || !email || !password || !role || !phone || !location) {
    throw new ApiError(400, "All fields are required");
  }

  // Resolve affiliate referral code → referrer's user id (ignored if invalid)
  let referredBy = null;
  if (referralCode) {
    const aff = await pool.query(
      "SELECT user_id FROM affiliates WHERE code = $1 AND status = 'active'",
      [referralCode]
    );
    if (aff.rows.length > 0) referredBy = aff.rows[0].user_id;
  }

  const user = await registerUserService({
    full_name, email, password, role, phone, location, referredBy,
  });

  return res.status(201).json(new ApiResponse(201, user, "User registered successfully"));
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await loginUserService({ email, password });

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, { user, accessToken }, "Login successful"));
});

export const logoutUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Logout successful"));
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const result = await pool.query(
    `SELECT id, full_name, email, role, phone, avatar, is_verified, is_active, created_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) throw new ApiError(404, "User not found");

  return res.status(200).json(new ApiResponse(200, result.rows[0], "Current user fetched successfully"));
});


// GET /auth/users?role=instructor&page=1&limit=20  (admin only)
export const getUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 50, search } = req.query;

  const conditions = [];
  const params = [];

  if (role) {
    params.push(role);
    conditions.push(`role = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(full_name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query(`SELECT COUNT(*) FROM users ${where}`, params);
  const total = Number(countResult.rows[0].count);

  params.push(Number(limit), (Number(page) - 1) * Number(limit));
  const result = await pool.query(
    `SELECT id, full_name, email, role, phone, location, is_active, created_at
     FROM users ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return res.status(200).json(new ApiResponse(200, {
    users: result.rows,
    total,
    page: Number(page),
    limit: Number(limit),
  }));
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new ApiError(401, "No refresh token");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const result = await pool.query(
    `SELECT id, email, role, refresh_token FROM users WHERE id = $1`,
    [decoded.id]
  );

  if (result.rows.length === 0) throw new ApiError(404, "User not found");

  const user = result.rows[0];
  if (user.refresh_token !== token) throw new ApiError(401, "Refresh token mismatch");

  const newAccessToken = generateAccessToken(user);

  return res
    .status(200)
    .cookie("accessToken", newAccessToken, cookieOptions)
    .json(new ApiResponse(200, { accessToken: newAccessToken }, "Token refreshed"));
});