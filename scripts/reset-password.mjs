import pg from "pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const email = (process.env.RESET_EMAIL || "denisblackman2@gmail.com").trim().toLowerCase();
const password = process.env.RESET_PASSWORD || "DenisChernov123";

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const hash = await bcrypt.hash(password, 10);
const r = await pool.query(
  `UPDATE crm_users SET password_hash = $1 WHERE email = $2 RETURNING email, name, role`,
  [hash, email],
);
console.log("Updated:", r.rows[0] || "NOT FOUND");
await pool.end();
