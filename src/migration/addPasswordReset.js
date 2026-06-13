// Migration: add password-reset columns to users.
//
// Run:  cd backend && npm run migrate:reset
//
// Idempotent — uses ADD COLUMN IF NOT EXISTS, safe to re-run.
//   reset_code          hashed 6-digit OTP (bcrypt), NULL when no reset pending
//   reset_code_expires  when the current reset code stops being valid
//
// Kept separate from verification_code so an email-verification code and a
// password-reset code can never be used interchangeably.

import "dotenv/config";

import pool from "../config/db.js";

async function migrate() {
  try {
    await pool.query(
      `ALTER TABLE users
         ADD COLUMN IF NOT EXISTS reset_code TEXT,
         ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMP`
    );
    console.log("✓ reset_code / reset_code_expires columns ensured");
    process.exit(0);
  } catch (error) {
    console.error("Password-reset migration failed:");
    console.error(error);
    process.exit(1);
  }
}

migrate();
