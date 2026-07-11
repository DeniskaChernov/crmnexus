/**
 * Импорт каталога Bententrade (из архива / live API) в CRM BTT Nexus.
 *
 * Использование:
 *   node scripts/import-bententrade.mjs
 *   CRM_URL=https://... CRM_EMAIL=... CRM_PASSWORD=... node scripts/import-bententrade.mjs
 */

const BENTENTRADE_API =
  "https://mvrljchbupekmuhryvlw.supabase.co/functions/v1/make-server-ee878259";
const BENTENTRADE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12cmxqY2hidXBla211aHJ5dmx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NDU0MzUsImV4cCI6MjA2ODMyMTQzNX0.gMYOG0s-H_1gu0KwFhemlTI8aN8wn3E1pxd3RF8rIR8";

const CRM_URL = (process.env.CRM_URL || "https://crmnexus-production.up.railway.app").replace(
  /\/$/,
  "",
);
const CRM_EMAIL = process.env.CRM_EMAIL || "denisblackman2@gmail.com";
const CRM_PASSWORD = process.env.CRM_PASSWORD || "DenisChernov123";

async function crmFetch(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${CRM_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function bententradeFetch(path) {
  const res = await fetch(`${BENTENTRADE_API}${path}`, {
    headers: { Authorization: `Bearer ${BENTENTRADE_ANON}` },
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(`Bententrade ${path} failed: ${JSON.stringify(data)}`);
  }
  return data;
}

function toCrmProduct(item, kind) {
  const name =
    typeof item.name === "object" ? item.name.ru || item.name.uz : String(item.name || "");
  const description =
    typeof item.description === "object"
      ? item.description.ru || item.description.uz
      : String(item.description || "");

  return {
    name,
    description,
    category: item.category || kind,
    bententradeId: item.id,
    source: "bententrade",
    price: item.price ?? null,
    currency: item.currency || "сум",
    size: item.size || item.profile || null,
    style: item.style || null,
    unit: item.unit || null,
    minQuantity: item.minQuantity ?? null,
    dimensions: item.dimensions || null,
    features:
      typeof item.features === "object" && !Array.isArray(item.features)
        ? item.features.ru || item.features.uz
        : item.features || [],
    colors: item.colors || [],
  };
}

async function main() {
  console.log("→ Загрузка каталога Bententrade...");
  const { data } = await bententradeFetch("/get-data");

  const items = [
    ...(data.kashpo || []).map((p) => toCrmProduct(p, "kashpo")),
    ...(data.rattan || []).map((p) => toCrmProduct(p, "materials")),
  ];

  console.log(`→ Найдено товаров: ${items.length}`);

  console.log("→ Вход в CRM...");
  const login = await crmFetch("/api/auth/login", {
    method: "POST",
    body: { email: CRM_EMAIL, password: CRM_PASSWORD },
  });
  const token = login.token;
  if (!token) throw new Error("CRM login: нет token");

  const existing = await crmFetch("/api/products", { token });
  const existingNames = new Set((existing || []).map((p) => p.name));

  let created = 0;
  let skipped = 0;

  for (const product of items) {
    if (existingNames.has(product.name)) {
      skipped++;
      continue;
    }
    await crmFetch("/api/products", { method: "POST", token, body: product });
    created++;
    console.log(`  + ${product.name}`);
  }

  if (data.contacts) {
    const c = data.contacts;
    await crmFetch("/api/company", {
      method: "POST",
      token,
      body: {
        name: c.company || "Bententrade",
        email: c.email || "",
        phone: c.phone || "",
        website: "https://bententrade.uz",
      },
    });
    console.log("→ Настройки компании Bententrade сохранены");
  }

  const after = await crmFetch("/api/products", { token });
  console.log(`\nГотово: создано ${created}, пропущено ${skipped}, всего в CRM: ${after.length}`);
}

main().catch((err) => {
  console.error("Ошибка импорта:", err.message || err);
  process.exit(1);
});
