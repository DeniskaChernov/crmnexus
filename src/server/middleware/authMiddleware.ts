import type { Hono } from "hono";
import { verifyBearer } from "../jwt.ts";

const PUBLIC_PATH_PARTS = [
  "/health",
  "/signup",
  "/auth/login",
  "/auth/migration-login",
  "/auth/me",
  "/telegram-webhook",
  "/webhooks/site",
  "/public/qr/",
  "/static-uploads/",
];

/** GET-запросы склада — без токена (миграция; данные нужны в UI). */
const PUBLIC_GET_PREFIXES = [
  "/api/shipments",
  "/api/production-logs",
  "/api/transfers",
  "/api/recipes",
  "/api/employees",
  "/api/integrations/status",
  "/api/warehouse/inventory",
  "/api/warehouse/movements",
  "/api/warehouse/monthly-stats",
  "/api/warehouse/available-articles",
];

export function registerAuthMiddleware(app: Hono) {
  app.use("/api/*", async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    const p = c.req.path;
    if (PUBLIC_PATH_PARTS.some((part) => p.includes(part))) {
      return next();
    }
    if (
      c.req.method === "GET" &&
      PUBLIC_GET_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + "/"))
    ) {
      return next();
    }
    const auth = c.req.header("authorization");
    if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);
    try {
      await verifyBearer(auth.slice(7));
    } catch {
      return c.json({ error: "Invalid token" }, 401);
    }
    return next();
  });
}
