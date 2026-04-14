import type { Hono } from "hono";
import { createClient } from "../serviceDb.ts";
import { getPool } from "../dbPool.ts";
import { isSafeIdent } from "../sqlSafe.ts";

const CRM_TABLES = new Set([
  "deals",
  "companies",
  "contacts",
  "tasks",
  "pipelines",
  "stages",
  "leads",
  "calendar_events",
]);

export function registerCrmRunRoute(app: Hono) {
  app.post("/make-server-f9553289/crm/run", async (c) => {
    try {
      const body = await c.req.json();
      if (!body?.table || !CRM_TABLES.has(body.table)) {
        return c.json({ data: null, error: { message: "Invalid table" } }, 400);
      }
      const db = createClient();
      if (body.verb === "select") {
        let q: any = db.from(body.table).select(body.select || "*");
        for (const f of body.filters || []) {
          const [op, a, b] = f;
          if (op === "eq") q = q.eq(a, b);
          else if (op === "in") q = q.in(a, b);
          else if (op === "gte") q = q.gte(a, b);
          else if (op === "lte") q = q.lte(a, b);
          else if (op === "neq") q = q.neq(a, b);
        }
        if (body.order) q = q.order(body.order.col, body.order.opts);
        if (body.limit != null) q = q.limit(body.limit);
        if (body.single === "one") q = q.single();
        if (body.single === "maybe") q = q.maybeSingle();
        return c.json(await q);
      }
      if (body.verb === "insert") {
        const rows = Array.isArray(body.rows) ? body.rows : [body.rows];
        let q: any = db.from(body.table).insert(rows);
        if (body.returning) q = q.select(body.returning);
        if (body.single) q = q.single();
        return c.json(await q);
      }
      if (body.verb === "update") {
        let q: any = db.from(body.table).update(body.patch);
        for (const f of body.filters || []) {
          const [op, a, b] = f;
          if (op === "eq") q = q.eq(a, b);
        }
        return c.json(await q);
      }
      if (body.verb === "delete") {
        let q: any = db.from(body.table).delete();
        for (const f of body.filters || []) {
          const [op, a, b] = f;
          if (op === "eq") q = q.eq(a, b);
          else if (op === "neq") q = q.neq(a, b);
        }
        return c.json(await q);
      }
      if (body.verb === "count") {
        const pool = getPool();
        let sql = `SELECT COUNT(*)::int AS c FROM "${body.table}"`;
        const vals: unknown[] = [];
        const parts: string[] = [];
        let i = 1;
        for (const f of body.filters || []) {
          const [op, col, val] = f;
          if (!isSafeIdent(col)) {
            return c.json({ count: 0, error: { message: `Invalid column: ${col}` } }, 400);
          }
          if (op === "eq") {
            parts.push(`"${col}" = $${i++}`);
            vals.push(val);
          } else if (op === "in") {
            if (!Array.isArray(val)) {
              return c.json(
                { count: 0, error: { message: `IN expects array for column: ${col}` } },
                400,
              );
            }
            const arr = val as unknown[];
            if (arr.length === 0) {
              parts.push("1 = 0");
              continue;
            }
            parts.push(`"${col}" IN (${arr.map(() => `$${i++}`).join(", ")})`);
            vals.push(...arr);
          }
        }
        if (parts.length) sql += ` WHERE ${parts.join(" AND ")}`;
        const { rows } = await pool.query(sql, vals);
        return c.json({ count: rows[0]?.c ?? 0, error: null });
      }
      return c.json({ data: null, error: { message: "Unknown verb" } }, 400);
    } catch (e: any) {
      return c.json({ data: null, error: { message: e.message || String(e) } }, 500);
    }
  });
}
