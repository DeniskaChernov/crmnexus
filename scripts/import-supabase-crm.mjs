/**
 * Полный импорт CRM из Supabase (make-server-f9553289) → Railway Postgres.
 *
 *   DATABASE_PUBLIC_URL=postgresql://... node scripts/import-supabase-crm.mjs
 */

import pg from "pg";

const SUPABASE_PROJECT = "mvrljchbupekmuhryvlw";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12cmxqY2hidXBla211aHJ5dmx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NDU0MzUsImV4cCI6MjA2ODMyMTQzNX0.gMYOG0s-H_1gu0KwFhemlTI8aN8wn3E1pxd3RF8rIR8";
const REST = `https://${SUPABASE_PROJECT}.supabase.co/rest/v1`;
const EDGE = `https://${SUPABASE_PROJECT}.supabase.co/functions/v1/make-server-f9553289`;

const DB_URL =
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:BLmjKglIGGvCewKEjOgvnnmmEfVYkVJp@monorail.proxy.rlwy.net:20534/railway";

const authHeaders = {
  apikey: SUPABASE_ANON,
  Authorization: `Bearer ${SUPABASE_ANON}`,
};

function normalizeWarehouse(wh) {
  if (!wh || wh === "AIKO" || wh === "Bizly") return "BTT";
  return wh;
}

function deepNormalizeWarehouse(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(deepNormalizeWarehouse);
  const out = { ...obj };
  if (typeof out.warehouse === "string") out.warehouse = normalizeWarehouse(out.warehouse);
  if (typeof out.fromWarehouse === "string") out.fromWarehouse = normalizeWarehouse(out.fromWarehouse);
  if (typeof out.toWarehouse === "string") out.toWarehouse = normalizeWarehouse(out.toWarehouse);
  for (const k of Object.keys(out)) {
    if (typeof out[k] === "object") out[k] = deepNormalizeWarehouse(out[k]);
  }
  return out;
}

async function restFetchAll(table) {
  const res = await fetch(`${REST}/${table}?select=*`, { headers: authHeaders });
  if (!res.ok) throw new Error(`REST ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function edgeFetch(path) {
  const res = await fetch(`${EDGE}${path}`, {
    headers: { Authorization: `Bearer ${SUPABASE_ANON}` },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`EDGE ${path}: invalid JSON`);
  }
  if (!res.ok) throw new Error(`EDGE ${path}: ${res.status} ${text.slice(0, 200)}`);
  return data;
}

async function edgeFetchDealItems(dealId) {
  try {
    return await edgeFetch(`/deal-items/${dealId}`);
  } catch {
    return [];
  }
}

function kvFromArray(items) {
  const out = [];
  for (const item of items || []) {
    if (!item || typeof item !== "object") continue;
    const key = item.id || item.key;
    if (!key || typeof key !== "string") continue;
    const { id: _id, key: _k, ...rest } = item;
    const value = Object.keys(rest).length ? rest : item;
    out.push({ key, value: deepNormalizeWarehouse(value) });
  }
  return out;
}

function kvFromSingleton(key, value) {
  if (value == null) return [];
  return [{ key, value: deepNormalizeWarehouse(value) }];
}

async function batchUpsertKv(client, entries, chunk = 80) {
  let n = 0;
  for (let i = 0; i < entries.length; i += chunk) {
    const slice = entries.slice(i, i + chunk);
    const keys = slice.map((e) => e.key);
    const values = slice.map((e) => JSON.stringify(e.value));
    const params = [];
    const tuples = slice
      .map((_, idx) => {
        const a = idx * 2 + 1;
        params.push(keys[idx], values[idx]);
        return `($${a}, $${a + 1}::jsonb, now())`;
      })
      .join(", ");
    await client.query(
      `INSERT INTO crm_kv (key, value, updated_at) VALUES ${tuples}
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      params,
    );
    n += slice.length;
  }
  return n;
}

async function upsertRows(client, table, rows, columns) {
  if (!rows.length) return 0;
  let n = 0;
  const chunk = 50;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    for (const row of slice) {
      const vals = columns.map((c) => row[c] ?? null);
      const ph = columns.map((_, idx) => `$${idx + 1}`).join(", ");
      const sets = columns
        .filter((c) => c !== "id")
        .map((c) => `${c} = EXCLUDED.${c}`)
        .join(", ");
      await client.query(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${ph})
         ON CONFLICT (id) DO UPDATE SET ${sets}`,
        vals,
      );
      n++;
    }
  }
  return n;
}

function mapPipelines(rows) {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: "",
    is_default: !!r.is_default,
    created_at: r.created_at,
  }));
}

function mapStages(rows) {
  return rows.map((r) => ({
    id: r.id,
    pipeline_id: r.pipeline_id,
    name: r.name,
    order_index: r.order_index ?? r.position ?? 0,
    color: r.color || "#94a3b8",
    created_at: r.created_at,
  }));
}

function mapCompanies(rows) {
  return rows.map((r) => ({
    id: r.id,
    name: r.name || "Без названия",
    phone: r.phone,
    email: r.email,
    industry: r.industry || null,
    city: r.city,
    type: r.type,
    notes: r.notes,
    status: r.status || "active",
    created_at: r.created_at,
  }));
}

function mapContacts(rows) {
  return rows.map((r) => ({
    id: r.id,
    company_id: r.company_id,
    first_name: r.first_name,
    last_name: r.last_name,
    position: r.position,
    phone: r.phone,
    email: r.email,
    created_at: r.created_at,
  }));
}

function mapDeals(rows, stagePipeline) {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    company_id: r.company_id,
    contact_id: r.contact_id,
    stage_id: r.stage_id,
    pipeline_id: r.pipeline_id || (r.stage_id ? stagePipeline.get(r.stage_id) : null),
    amount: r.amount ?? 0,
    status: r.status || "open",
    lost_reason: r.lost_reason || null,
    created_at: r.created_at,
    updated_at: r.updated_at || r.created_at,
  }));
}

function mapTasks(rows) {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    deal_id: r.deal_id,
    contact_id: r.contact_id,
    due_date: r.due_date,
    status: r.status || "planned",
    priority: r.priority,
    assigned_to: r.assigned_to || null,
    created_at: r.created_at,
  }));
}

async function main() {
  console.log("→ Экспорт из Supabase...");

  const [pipelines, stages, companies, contacts, deals, tasks] = await Promise.all([
    restFetchAll("pipelines"),
    restFetchAll("stages"),
    restFetchAll("companies"),
    restFetchAll("contacts"),
    restFetchAll("deals"),
    restFetchAll("tasks"),
  ]);

  const stagePipeline = new Map(stages.map((s) => [s.id, s.pipeline_id]));

  const [
    productionLogs,
    shipments,
    recipes,
    employees,
    clients,
    payments,
    timesheets,
    notifications,
    marketingReports,
    users,
    company,
    salesPlan,
    rates,
    regional,
    integrations,
    marketingTarget,
    productionEvents,
    transfers,
  ] = await Promise.all([
    edgeFetch("/production-logs"),
    edgeFetch("/shipments"),
    edgeFetch("/recipes"),
    edgeFetch("/employees"),
    edgeFetch("/clients"),
    edgeFetch("/payments"),
    edgeFetch("/timesheets"),
    edgeFetch("/notifications"),
    edgeFetch("/marketing/reports"),
    edgeFetch("/users"),
    edgeFetch("/company"),
    edgeFetch("/sales-plan"),
    edgeFetch("/settings/rates"),
    edgeFetch("/regional-settings"),
    edgeFetch("/integrations/status"),
    edgeFetch("/marketing/target"),
    edgeFetch("/production-events"),
    edgeFetch("/transfers"),
  ]);

  console.log(`→ deal_items для ${deals.length} сделок...`);
  const dealItemEntries = [];
  const batch = 25;
  for (let i = 0; i < deals.length; i += batch) {
    const chunk = deals.slice(i, i + batch);
    const results = await Promise.all(chunk.map((d) => edgeFetchDealItems(d.id)));
    chunk.forEach((d, idx) => {
      const items = results[idx];
      if (Array.isArray(items) && items.length) {
        dealItemEntries.push({
          key: `deal_items:${d.id}`,
          value: deepNormalizeWarehouse(items),
        });
      }
    });
    process.stdout.write(`  ${Math.min(i + batch, deals.length)}/${deals.length}\r`);
  }
  console.log("");

  const kvEntries = [
    ...kvFromArray(productionLogs),
    ...kvFromArray(shipments),
    ...kvFromArray(recipes),
    ...kvFromArray(employees),
    ...kvFromArray(clients),
    ...kvFromArray(payments),
    ...kvFromArray(timesheets),
    ...kvFromArray(notifications),
    ...kvFromArray(marketingReports),
    ...kvFromArray(transfers),
    ...kvFromArray(productionEvents.map((e) => ({ ...e, id: `production_event:${e.id}` }))),
    ...users.map((u) => ({ key: `user:${u.id}`, value: u })),
    ...kvFromSingleton("company:settings", company),
    ...kvFromSingleton("sales_plan:current", salesPlan),
    ...kvFromSingleton("settings:rates", rates),
    ...kvFromSingleton("settings:regional", regional),
    ...kvFromSingleton("settings:integrations", integrations),
    ...kvFromSingleton("marketing:target", marketingTarget),
    ...dealItemEntries,
  ];

  // Дедуп ключей (последний побеждает)
  const kvMap = new Map();
  for (const e of kvEntries) kvMap.set(e.key, e.value);
  const uniqueKv = [...kvMap.entries()].map(([key, value]) => ({ key, value }));

  console.log("→ Импорт в Railway Postgres...");
  const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pN = await upsertRows(client, "pipelines", mapPipelines(pipelines), [
      "id",
      "name",
      "description",
      "is_default",
      "created_at",
    ]);
    const sN = await upsertRows(client, "stages", mapStages(stages), [
      "id",
      "pipeline_id",
      "name",
      "order_index",
      "color",
      "created_at",
    ]);
    const cN = await upsertRows(client, "companies", mapCompanies(companies), [
      "id",
      "name",
      "phone",
      "email",
      "industry",
      "city",
      "type",
      "notes",
      "status",
      "created_at",
    ]);
    const ctN = await upsertRows(client, "contacts", mapContacts(contacts), [
      "id",
      "company_id",
      "first_name",
      "last_name",
      "position",
      "phone",
      "email",
      "created_at",
    ]);
    const dN = await upsertRows(client, "deals", mapDeals(deals, stagePipeline), [
      "id",
      "title",
      "company_id",
      "contact_id",
      "stage_id",
      "pipeline_id",
      "amount",
      "status",
      "lost_reason",
      "created_at",
      "updated_at",
    ]);
    const tN = await upsertRows(client, "tasks", mapTasks(tasks), [
      "id",
      "title",
      "description",
      "deal_id",
      "contact_id",
      "due_date",
      "status",
      "priority",
      "assigned_to",
      "created_at",
    ]);
    const kvN = await batchUpsertKv(client, uniqueKv);

    await client.query("COMMIT");

    console.log("\n✅ Импорт завершён:");
    console.log(`   pipelines: ${pN}`);
    console.log(`   stages: ${sN}`);
    console.log(`   companies: ${cN}`);
    console.log(`   contacts: ${ctN}`);
    console.log(`   deals: ${dN}`);
    console.log(`   tasks: ${tN}`);
    console.log(`   crm_kv: ${kvN}`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌", err.message || err);
  process.exit(1);
});
