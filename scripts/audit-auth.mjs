import pg from "pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const users = await pool.query("SELECT email, role, password_hash FROM crm_users ORDER BY email");
console.log("=== crm_users ===");
for (const u of users.rows) {
  const okCurrent = await bcrypt.compare("20260711", u.password_hash);
  const ok2026 = await bcrypt.compare("BttNexus2026", u.password_hash);
  console.log(`${u.email} | role=${u.role} | 20260711=${okCurrent} | BttNexus2026=${ok2026}`);
}

const counts = await pool.query(`
  SELECT
    (SELECT COUNT(*)::int FROM deals) AS deals,
    (SELECT COUNT(*)::int FROM companies) AS companies,
    (SELECT COUNT(*)::int FROM crm_kv) AS kv
`);
console.log("\n=== counts ===", counts.rows[0]);

await pool.end();
