import crypto from "crypto";
import pool from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Generate a short, readable, unique referral code
const generateCode = () =>
  `FSA-${crypto.randomBytes(3).toString("hex").toUpperCase()}`; // e.g. FSA-9C3A1F

// ─────────────────────────────────────────────────────────────────────────────
// POST /affiliates/join  (any logged-in user)
// Opt in as an affiliate — creates an affiliates row with a unique code
// ─────────────────────────────────────────────────────────────────────────────
const joinAffiliate = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Already an affiliate? return existing
  const existing = await pool.query("SELECT * FROM affiliates WHERE user_id = $1", [userId]);
  if (existing.rows.length > 0) {
    const a = existing.rows[0];
    return res.json(
      new ApiResponse(200, {
        ...a,
        referralLink: `${CLIENT_URL}/?ref=${a.code}`,
      }, "You are already an affiliate")
    );
  }

  // Generate a unique code (retry on the rare collision)
  let code;
  for (let i = 0; i < 5; i++) {
    code = generateCode();
    const clash = await pool.query("SELECT 1 FROM affiliates WHERE code = $1", [code]);
    if (clash.rows.length === 0) break;
    code = null;
  }
  if (!code) throw new ApiError(500, "Could not generate a referral code, please retry");

  const result = await pool.query(
    `INSERT INTO affiliates (user_id, code) VALUES ($1, $2) RETURNING *`,
    [userId, code]
  );
  const affiliate = result.rows[0];

  return res.status(201).json(
    new ApiResponse(201, {
      ...affiliate,
      referralLink: `${CLIENT_URL}/?ref=${affiliate.code}`,
    }, "Affiliate account created")
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /affiliates/me  (user)
// Affiliate's own profile, stats, and commission history
// ─────────────────────────────────────────────────────────────────────────────
const getMyAffiliate = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const affRes = await pool.query("SELECT * FROM affiliates WHERE user_id = $1", [userId]);
  if (affRes.rows.length === 0) {
    return res.json(new ApiResponse(200, { isAffiliate: false }));
  }
  const affiliate = affRes.rows[0];

  // Referred users count
  const refCount = await pool.query(
    "SELECT COUNT(*) FROM users WHERE referred_by = $1",
    [userId]
  );

  // Commission totals by status
  const totals = await pool.query(
    `SELECT
       COALESCE(SUM(commission_amount), 0)                                       AS total,
       COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0)     AS pending,
       COALESCE(SUM(commission_amount) FILTER (WHERE status = 'approved'), 0)    AS approved,
       COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0)        AS paid,
       COUNT(*)                                                                  AS sales
     FROM commissions WHERE affiliate_user_id = $1`,
    [userId]
  );

  // Recent commissions
  const commissions = await pool.query(
    `SELECT id, course_title, sale_amount, commission_amount, status, created_at, paid_at
     FROM commissions WHERE affiliate_user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );

  const t = totals.rows[0];

  return res.json(new ApiResponse(200, {
    isAffiliate: true,
    code: affiliate.code,
    referralLink: `${CLIENT_URL}/?ref=${affiliate.code}`,
    commissionType: affiliate.commission_type,
    commissionValue: Number(affiliate.commission_value),
    status: affiliate.status,
    clicks: affiliate.clicks,
    stats: {
      referredUsers: Number(refCount.rows[0].count),
      totalSales: Number(t.sales),
      // amounts are stored in paise → convert to rupees for display
      totalEarned: Number(t.total) / 100,
      pending: Number(t.pending) / 100,
      approved: Number(t.approved) / 100,
      paid: Number(t.paid) / 100,
    },
    commissions: commissions.rows.map((c) => ({
      ...c,
      sale_amount: c.sale_amount / 100,
      commission_amount: c.commission_amount / 100,
    })),
  }));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /affiliates/track/:code  (public)
// Increment click counter when a referral link is visited
// ─────────────────────────────────────────────────────────────────────────────
const trackClick = asyncHandler(async (req, res) => {
  await pool.query(
    "UPDATE affiliates SET clicks = clicks + 1 WHERE code = $1 AND status = 'active'",
    [req.params.code]
  );
  return res.json(new ApiResponse(200, { tracked: true }));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /affiliates  (admin)
// All affiliates with applicant info + earning/referral totals
// ─────────────────────────────────────────────────────────────────────────────
const getAllAffiliates = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      a.id, a.user_id, a.code, a.commission_type, a.commission_value,
      a.status, a.clicks, a.created_at,
      u.full_name, u.email, u.phone,
      (SELECT COUNT(*) FROM users r WHERE r.referred_by = a.user_id)            AS referred_users,
      COALESCE((SELECT SUM(c.commission_amount) FROM commissions c WHERE c.affiliate_user_id = a.user_id), 0) AS total_earned,
      COALESCE((SELECT SUM(c.commission_amount) FROM commissions c WHERE c.affiliate_user_id = a.user_id AND c.status != 'paid'), 0) AS unpaid
    FROM affiliates a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC
  `);

  const affiliates = result.rows.map((a) => ({
    ...a,
    commission_value: Number(a.commission_value),
    referred_users: Number(a.referred_users),
    total_earned: Number(a.total_earned) / 100,
    unpaid: Number(a.unpaid) / 100,
  }));

  // Platform summary
  const sum = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM affiliates)                                           AS total_affiliates,
      COALESCE((SELECT SUM(commission_amount) FROM commissions), 0)               AS total_commission,
      COALESCE((SELECT SUM(commission_amount) FROM commissions WHERE status='paid'), 0)     AS paid,
      COALESCE((SELECT SUM(commission_amount) FROM commissions WHERE status!='paid'), 0)    AS unpaid
  `);
  const sr = sum.rows[0];

  return res.json(new ApiResponse(200, {
    affiliates,
    summary: {
      totalAffiliates: Number(sr.total_affiliates),
      totalCommission: Number(sr.total_commission) / 100,
      paid: Number(sr.paid) / 100,
      unpaid: Number(sr.unpaid) / 100,
    },
  }));
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /affiliates/:userId  (admin)
// Update an affiliate's commission rate / type / status
// ─────────────────────────────────────────────────────────────────────────────
const updateAffiliate = asyncHandler(async (req, res) => {
  const { commission_type, commission_value, status } = req.body;
  const { userId } = req.params;

  if (commission_type && !["percent", "flat"].includes(commission_type)) {
    throw new ApiError(400, "commission_type must be 'percent' or 'flat'");
  }
  if (status && !["active", "suspended"].includes(status)) {
    throw new ApiError(400, "status must be 'active' or 'suspended'");
  }

  const result = await pool.query(
    `UPDATE affiliates SET
       commission_type  = COALESCE($1, commission_type),
       commission_value = COALESCE($2, commission_value),
       status           = COALESCE($3, status),
       updated_at       = NOW()
     WHERE user_id = $4
     RETURNING *`,
    [
      commission_type ?? null,
      commission_value !== undefined ? Number(commission_value) : null,
      status ?? null,
      userId,
    ]
  );

  if (result.rows.length === 0) throw new ApiError(404, "Affiliate not found");
  return res.json(new ApiResponse(200, result.rows[0], "Affiliate updated"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /affiliates/commissions  (admin)
// All commissions with affiliate + referred-user info, filter by status
// ─────────────────────────────────────────────────────────────────────────────
const getCommissions = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 30 } = req.query;
  const pageNum = Number(page), limitNum = Number(limit);

  const where = status ? "WHERE c.status = $1" : "";
  const params = status ? [status] : [];

  const countRes = await pool.query(`SELECT COUNT(*) FROM commissions c ${where}`, params);
  const total = Number(countRes.rows[0].count);

  params.push(limitNum, (pageNum - 1) * limitNum);
  const result = await pool.query(
    `SELECT
       c.id, c.course_title, c.sale_amount, c.commission_amount, c.status, c.created_at, c.paid_at,
       af.full_name AS affiliate_name, af.email AS affiliate_email,
       ru.full_name AS referred_name
     FROM commissions c
     LEFT JOIN users af ON af.id = c.affiliate_user_id
     LEFT JOIN users ru ON ru.id = c.referred_user_id
     ${where}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const commissions = result.rows.map((c) => ({
    ...c,
    sale_amount: c.sale_amount / 100,
    commission_amount: c.commission_amount / 100,
  }));

  return res.json(new ApiResponse(200, { commissions, total, page: pageNum, limit: limitNum }));
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /affiliates/commissions/:id  (admin)
// Update a commission's status (approved / paid)
// ─────────────────────────────────────────────────────────────────────────────
const updateCommissionStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["pending", "approved", "paid"].includes(status)) {
    throw new ApiError(400, "status must be pending, approved or paid");
  }

  const paidAt = status === "paid" ? "NOW()" : "NULL";
  const result = await pool.query(
    `UPDATE commissions SET status = $1, paid_at = ${paidAt} WHERE id = $2 RETURNING *`,
    [status, req.params.id]
  );
  if (result.rows.length === 0) throw new ApiError(404, "Commission not found");

  return res.json(new ApiResponse(200, result.rows[0], `Commission marked ${status}`));
});

export {
  joinAffiliate,
  getMyAffiliate,
  trackClick,
  getAllAffiliates,
  updateAffiliate,
  getCommissions,
  updateCommissionStatus,
};
