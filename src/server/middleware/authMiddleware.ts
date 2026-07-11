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
  "/static-uploads/",
];

export function registerAuthMiddleware(app: Hono) {
  app.use("/api/*", async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    const p = c.req.path;
    if (PUBLIC_PATH_PARTS.some((part) => p.includes(part))) {
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
