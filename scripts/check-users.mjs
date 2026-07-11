import pg from "pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const users = await pool.query("SELECT email, name, role FROM crm_users");
console.log("crm_users:", users.rows);

const deals = await pool.query("SELECT COUNT(*)::int AS c FROM deals");
console.log("deals:", deals.rows[0].c);

await pool.end();
