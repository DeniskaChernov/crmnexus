import crypto from "node:crypto";

/**
 * Fail fast on missing secrets before the app binds the port.
 * Production: NODE_ENV=production (Railway sets this by default).
 */
function applyRailwayDefaults(): void {
  if (process.env["RAILWAY_ENVIRONMENT"] && !process.env["NODE_ENV"]) {
    process.env["NODE_ENV"] = "production";
  }

  const domain = process.env["RAILWAY_PUBLIC_DOMAIN"]?.trim();
  if (!domain) return;
  const origin = `https://${domain}`;
  if (!process.env["CORS_ORIGINS"]?.trim()) {
    process.env["CORS_ORIGINS"] = origin;
  }
  if (!process.env["PUBLIC_BASE_URL"]?.trim()) {
    process.env["PUBLIC_BASE_URL"] = origin;
  }
}

const PLACEHOLDER_JWT_SECRETS = new Set([
  "change-me-long-random",
  "change-me-use-at-least-32-random-characters-here",
]);

/** Стабильный секрет из Railway-идентификаторов, если JWT_SECRET обрезан/не задан. */
function applyRailwayJwtFallback(): void {
  if (!process.env["RAILWAY_ENVIRONMENT"]?.trim()) return;

  const current = process.env["JWT_SECRET"]?.trim() ?? "";
  if (current.length >= 24 && !PLACEHOLDER_JWT_SECRETS.has(current)) return;

  const db = process.env["DATABASE_URL"]?.trim();
  const serviceId = process.env["RAILWAY_SERVICE_ID"]?.trim() || "crmnexus";
  if (!db) return;

  process.env["JWT_SECRET"] = crypto
    .createHash("sha256")
    .update(`${db}:${serviceId}:btt-nexus-jwt-v1`)
    .digest("hex");

  console.warn(
    `[env] JWT_SECRET was invalid (len=${current.length}); using Railway-derived secret.`,
  );
}

export function validateServerEnv(): void {
  if (process.env["SKIP_ENV_VALIDATION"] === "1") {
    return;
  }

  applyRailwayDefaults();
  applyRailwayJwtFallback();

  const missing: string[] = [];
  const requireNonEmpty = (key: string) => {
    const v = process.env[key];
    if (typeof v !== "string" || !v.trim()) missing.push(key);
  };

  requireNonEmpty("DATABASE_URL");
  requireNonEmpty("JWT_SECRET");

  const isProd =
    process.env["NODE_ENV"] === "production" ||
    process.env["REQUIRE_STRICT_ENV"] === "true" ||
    Boolean(process.env["RAILWAY_ENVIRONMENT"]?.trim());
  if (isProd) {
    requireNonEmpty("CRM_WEBHOOK_SECRET");
    requireNonEmpty("PUBLIC_BASE_URL");
    const cors = process.env["CORS_ORIGINS"];
    if (typeof cors !== "string" || !cors.split(",").some((s) => s.trim())) {
      missing.push("CORS_ORIGINS");
    }
  }

  if (missing.length) {
    console.error(
      `[env] Missing or empty: ${missing.join(", ")}. See .env.example. ` +
        (isProd
          ? "Strict env (NODE_ENV=production or REQUIRE_STRICT_ENV=true)."
          : "For production checks set NODE_ENV=production or REQUIRE_STRICT_ENV=true."),
    );
    process.exit(1);
  }

  const db = process.env["DATABASE_URL"]!;
  const lower = db.trim().toLowerCase();
  if (!lower.startsWith("postgres://") && !lower.startsWith("postgresql://")) {
    console.error("[env] DATABASE_URL must start with postgres:// or postgresql://");
    process.exit(1);
  }

  const jwt = process.env["JWT_SECRET"]!;
  if (isProd && (jwt.length < 24 || PLACEHOLDER_JWT_SECRETS.has(jwt.trim()))) {
    console.error(
      `[env] JWT_SECRET is too short for production (len=${jwt.length}, need >= 24). ` +
        "Set a long random value in Railway → Variables.",
    );
    process.exit(1);
  }
}
