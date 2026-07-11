import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query(
  "SELECT to_regclass('public.crm_users') AS crm_users, (SELECT COUNT(*)::int FROM deals) AS deals",
);
console.log(JSON.stringify(r.rows[0]));
await pool.end();
