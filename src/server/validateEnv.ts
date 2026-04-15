/**
 * Fail fast on missing secrets before the app binds the port.
 * Production: NODE_ENV=production (Railway sets this by default).
 */
export function validateServerEnv(): void {
  if (process.env["SKIP_ENV_VALIDATION"] === "1") {
    return;
  }

  const missing: string[] = [];
  const requireNonEmpty = (key: string) => {
    const v = process.env[key];
    if (typeof v !== "string" || !v.trim()) missing.push(key);
  };

  requireNonEmpty("DATABASE_URL");
  requireNonEmpty("JWT_SECRET");

  const isProd =
    process.env["NODE_ENV"] === "production" || process.env["REQUIRE_STRICT_ENV"] === "true";
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
  if (isProd && jwt.length < 24) {
    console.error("[env] JWT_SECRET is too short for production (use at least 24 characters).");
    process.exit(1);
  }
}
