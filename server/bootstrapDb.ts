import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function bootstrapDatabase(): Promise<void> {
  const url = process.env["DATABASE_URL"]?.trim();
  if (!url) {
    console.warn("[bootstrap] DATABASE_URL not set, skip migration");
    return;
  }

  const sqlPath = path.join(__dirname, "migrate.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const pool = new pg.Pool({ connectionString: url, max: 2 });

  try {
    await pool.query(sql);
    console.log("[bootstrap] Migration OK");

    const { rows } = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM crm_users`,
    );

    const email = process.env["CRM_BOOTSTRAP_EMAIL"]?.trim().toLowerCase();
    const password = process.env["CRM_BOOTSTRAP_PASSWORD"]?.trim();
    const name = process.env["CRM_BOOTSTRAP_NAME"]?.trim() || "Owner";
    const role = process.env["CRM_BOOTSTRAP_ROLE"]?.trim() || "owner";

    if (email && password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        `INSERT INTO crm_users (email, password_hash, name, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           name = EXCLUDED.name,
           role = EXCLUDED.role`,
        [email, hash, name, role],
      );
      console.log(`[bootstrap] Owner synced: ${email}`);
    } else if ((rows[0]?.c ?? 0) === 0) {
      console.warn("[bootstrap] crm_users is empty; set CRM_BOOTSTRAP_EMAIL/PASSWORD");
    }
  } finally {
    await pool.end();
  }
}
