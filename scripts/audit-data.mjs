import pg from "pg";

const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const counts = await pool.query(`
  SELECT 'crm_users' t, COUNT(*)::int c FROM crm_users
  UNION ALL SELECT 'companies', COUNT(*)::int FROM companies
  UNION ALL SELECT 'deals', COUNT(*)::int FROM deals
  UNION ALL SELECT 'contacts', COUNT(*)::int FROM contacts
  UNION ALL SELECT 'tasks', COUNT(*)::int FROM tasks
  UNION ALL SELECT 'leads', COUNT(*)::int FROM leads
  UNION ALL SELECT 'crm_kv', COUNT(*)::int FROM crm_kv
`);
console.log("TABLE COUNTS:");
for (const r of counts.rows) console.log(`  ${r.t}: ${r.c}`);

const prefixes = await pool.query(`
  SELECT split_part(key, ':', 1) || ':' || COALESCE(NULLIF(split_part(key, ':', 2), ''), '') AS prefix,
         COUNT(*)::int AS c
  FROM crm_kv
  GROUP BY 1
  ORDER BY c DESC
  LIMIT 30
`);
console.log("\nKV PREFIXES:");
for (const r of prefixes.rows) console.log(`  ${r.prefix}: ${r.c}`);

const wh = await pool.query(`
  SELECT COUNT(*)::int AS c FROM crm_kv WHERE key LIKE 'warehouse:%'
`);
console.log(`\nwarehouse:* keys: ${wh.rows[0].c}`);

const whKeys = ["production_log:", "shipment:", "transfer:", "product:", "employee:", "deal_items:", "recipe:", "client:"];
console.log("\nWAREHOUSE-RELATED KV:");
for (const prefix of whKeys) {
  const r = await pool.query(`SELECT COUNT(*)::int AS c FROM crm_kv WHERE key LIKE $1`, [`${prefix}%`]);
  console.log(`  ${prefix} ${r.rows[0].c}`);
}

await pool.end();
