import pg from "pg";

const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const r = await pool.query(
  `SELECT key, value FROM crm_kv WHERE key LIKE 'shipment:%' ORDER BY key DESC LIMIT 3`,
);
for (const row of r.rows) {
  const v = row.value;
  console.log("KEY:", row.key);
  console.log("  has id in value:", Boolean(v?.id));
  console.log("  status:", v?.status);
  console.log("  items count:", Array.isArray(v?.items) ? v.items.length : "missing");
  console.log("  date:", v?.date);
}
await pool.end();
