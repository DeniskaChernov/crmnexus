/**
 * Smoke: health, DB, login, CRM data.
 * Usage: SMOKE_BASE_URL=https://crmnexus-production.up.railway.app node scripts/smoke.mjs
 */
const base = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
const email = process.env.SMOKE_EMAIL || "denisblackman2@gmail.com";
const password = process.env.SMOKE_PASSWORD || "BttNexus2026";

async function getJson(path, init) {
  const res = await fetch(`${base}${path}`, init);
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

const health = await getJson("/api/health");
if (!health.res.ok || health.body?.status !== "ok") {
  console.error("smoke: health failed", health);
  process.exit(1);
}

const db = await getJson("/api/health/db");
if (!db.res.ok || !db.body?.ok) {
  console.error("smoke: db health failed", db);
  process.exit(1);
}

const login = await getJson("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!login.res.ok || !login.body?.token) {
  console.error("smoke: login failed", login);
  process.exit(1);
}

const deals = await getJson("/api/crm/run", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${login.body.token}`,
  },
  body: JSON.stringify({ table: "deals", verb: "select", select: "id", limit: 1 }),
});

if (deals.body?.error) {
  console.error("smoke: deals query failed", deals.body);
  process.exit(1);
}

console.log("smoke: ok", {
  health: health.body.status,
  users: db.body.users,
  deals: db.body.deals,
  login: login.body.user?.email,
  crm: Array.isArray(deals.body?.data) ? "ok" : deals.body,
});
