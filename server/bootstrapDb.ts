import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { ensureOwnerUser, ownerCredentials } from "./ensureOwner.ts";

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

    const creds = ownerCredentials();
    if (creds.email && creds.password) {
      const email = await ensureOwnerUser(pool);
      console.log(`[bootstrap] Owner synced: ${email}`);
    } else if ((rows[0]?.c ?? 0) === 0) {
      console.warn("[bootstrap] crm_users is empty; set CRM_BOOTSTRAP_EMAIL/PASSWORD");
    }
  } finally {
    await pool.end();
  }
}
