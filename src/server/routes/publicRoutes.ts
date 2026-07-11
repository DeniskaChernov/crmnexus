import type { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { handleSiteWebhook } from "../siteWebhook.ts";
import { getPool } from "../dbPool.ts";

export function registerPublicRoutes(app: Hono, env: (k: string) => string | undefined) {
  app.get("/api/static-uploads/:name", async (c) => {
    try {
      const name = c.req.param("name");
      const safe = path.basename(name);
      const fp = path.join(process.cwd(), "data", "uploads", safe);
      if (!fs.existsSync(fp)) return c.body(null, 404);
      const buf = await fs.promises.readFile(fp);
      const ext = safe.split(".").pop()?.toLowerCase();
      const ct =
        ext === "png"
          ? "image/png"
          : ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : "application/octet-stream";
      return new Response(buf, { headers: { "Content-Type": ct } });
    } catch {
      return c.body(null, 500);
    }
  });

  app.post("/api/webhooks/site", async (c) => {
    const secret = env("CRM_WEBHOOK_SECRET");
    if (!secret) {
      return c.json({ error: "CRM_WEBHOOK_SECRET not configured" }, 503);
    }
    const raw = await c.req.text();
    const event = c.req.header("X-BTT-Event") || c.req.header("x-btt-event");
    const signature = c.req.header("X-BTT-Signature") || c.req.header("x-btt-signature");
    const schemaVersion = c.req.header("X-BTT-Schema-Version") || c.req.header("x-btt-schema-version");
    const idempotencyKey =
      c.req.header("X-BTT-Idempotency-Key") || c.req.header("x-btt-idempotency-key");
    const r = await handleSiteWebhook({
      rawBody: raw,
      event,
      schemaVersion,
      idempotencyKey,
      signature,
      secret,
    });
    return c.json(r.body, r.status);
  });

  app.get("/api/health", (c) => {
    console.log("Health check requested");
    return c.json({ status: "ok", timestamp: new Date().toISOString(), version: "v8" });
  });

  app.get("/api/health/db", async (c) => {
    try {
      const pool = getPool();
      const { rows } = await pool.query<{
        crm_users: string | null;
        users: number;
        deals: number;
      }>(
        `SELECT
           to_regclass('public.crm_users')::text AS crm_users,
           (SELECT COUNT(*)::int FROM crm_users) AS users,
           (SELECT COUNT(*)::int FROM deals) AS deals`,
      );
      const row = rows[0];
      const ok = Boolean(row?.crm_users);
      return c.json(
        {
          ok,
          crm_users_table: row?.crm_users ?? null,
          users: row?.users ?? 0,
          deals: row?.deals ?? 0,
          timestamp: new Date().toISOString(),
        },
        ok ? 200 : 503,
      );
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 503);
    }
  });
}
