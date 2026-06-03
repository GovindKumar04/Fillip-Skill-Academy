import "dotenv/config";

import { app } from "./app.js";
import pool from "./config/db.js";
import connectMongoDB from "./config/mongodb.js";

const PORT = process.env.PORT || 3000;

async function startServer() {
  // ── PostgreSQL ──────────────────────────────────────────────────────────────
  console.log("⏳ Connecting to PostgreSQL...");
  try {
    await pool.query("SELECT 1");
    console.log("✅ PostgreSQL connected");
  } catch (err) {
    console.error("❌ PostgreSQL connection failed:", err.message);
    console.error("   Check DATABASE_URL in .env — make sure the Neon DB is active (not suspended).");
    process.exit(1);
  }

  // ── Ensure payments table exists (users table created by seed.js) ───────────
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        course_id VARCHAR(24) NOT NULL,
        course_title TEXT NOT NULL,
        enrollment_type VARCHAR(10) NOT NULL DEFAULT 'online',
        amount INTEGER NOT NULL,
        currency VARCHAR(5) NOT NULL DEFAULT 'INR',
        razorpay_order_id VARCHAR(100) UNIQUE NOT NULL,
        razorpay_payment_id VARCHAR(100),
        razorpay_signature TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Payments table ready");
  } catch (err) {
    console.error("❌ Payments table migration failed:", err.message);
    process.exit(1);
  }

  // ── Affiliate program tables ────────────────────────────────────────────────
  try {
    // Affiliate referral link captured at signup
    // NOTE: users.id is BIGINT in this database, so all user references use BIGINT.
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by BIGINT`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS affiliates (
        id SERIAL PRIMARY KEY,
        user_id BIGINT UNIQUE NOT NULL,
        code VARCHAR(20) UNIQUE NOT NULL,
        commission_type VARCHAR(10) NOT NULL DEFAULT 'percent',
        commission_value NUMERIC(10,2) NOT NULL DEFAULT 10,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        clicks INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS commissions (
        id SERIAL PRIMARY KEY,
        affiliate_user_id BIGINT NOT NULL,
        referred_user_id BIGINT NOT NULL,
        payment_id INTEGER NOT NULL,
        course_title TEXT NOT NULL,
        sale_amount INTEGER NOT NULL,
        commission_amount INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        paid_at TIMESTAMP
      )
    `);
    console.log("✅ Affiliate tables ready");
  } catch (err) {
    console.error("❌ Affiliate table migration failed:", err.message);
    process.exit(1);
  }

  // ── MongoDB ─────────────────────────────────────────────────────────────────
  console.log("⏳ Connecting to MongoDB...");
  try {
    await connectMongoDB();
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    console.error("   Make sure the MongoDB service is running.");
    process.exit(1);
  }

  // ── Start HTTP server ────────────────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer();
