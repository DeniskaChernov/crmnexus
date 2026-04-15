import type { Hono } from "hono";
import { createClient } from "../serviceDb.ts";
import { getPool } from "../dbPool.ts";
import { isSafeIdent } from "../sqlSafe.ts";
import { verifyBearer } from "../jwt.ts";

type Verb = "select" | "insert" | "update" | "delete" | "count";
type FilterOp = "eq" | "in" | "gte" | "lte" | "neq";
type FilterTuple = [FilterOp, string, unknown];

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

const ADMIN_ROLES = new Set(["owner", "director", "admin"]);
const MANAGER_WRITE_TABLES = new Set([
  "deals",
  "companies",
  "contacts",
  "tasks",
  "leads",
  "calendar_events",
]);

function toFilters(v: unknown): FilterTuple[] {
  if (!Array.isArray(v)) return [];
  return v as FilterTuple[];
}

function parseRoleFromAuth(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return Promise.resolve(null);
  return verifyBearer(authHeader.slice(7))
    .then((p) => (typeof p.role === "string" ? p.role : null))
    .catch(() => null);
}

function canUse(role: string | null, verb: Verb, table: string): boolean {
  if (role && ADMIN_ROLES.has(role)) return true;
  if (verb === "select" || verb === "count") return true;
  if (role === "manager") return MANAGER_WRITE_TABLES.has(table);
  return false;
}

function validateFilterTuple(f: unknown, allowedOps: Set<FilterOp>): string | null {
  if (!Array.isArray(f) || f.length < 3) return "Invalid filter format";
  const [op, col, val] = f as FilterTuple;
  if (!allowedOps.has(op)) return `Unsupported filter op: ${String(op)}`;
  if (!isSafeIdent(col)) return `Invalid column: ${col}`;
  if (op === "in" && !Array.isArray(val)) return `IN expects array for column: ${col}`;
  return null;
}

export function registerCrmRunRoute(app: Hono) {
  app.post("/make-server-f9553289/crm/run", async (c) => {
    try {
      const body = await c.req.json();
      if (!body?.table || !CRM_TABLES.has(body.table)) {
        return c.json({ data: null, error: { message: "Invalid table" } }, 400);
      }
      const verb = body.verb as Verb;
      if (!verb || !["select", "insert", "update", "delete", "count"].includes(verb)) {
        return c.json({ data: null, error: { message: "Unknown verb" } }, 400);
      }

      const role = await parseRoleFromAuth(c.req.header("authorization"));
      if (!canUse(role, verb, body.table)) {
        return c.json({ data: null, error: { message: "Forbidden for role" } }, 403);
      }

      const filters = toFilters(body.filters);
      const db = createClient();

      if (verb === "select") {
        const filterOps = new Set<FilterOp>(["eq", "in", "gte", "lte", "neq"]);
        for (const f of filters) {
          const err = validateFilterTuple(f, filterOps);
          if (err) return c.json({ data: null, error: { message: err } }, 400);
        }
        if (body.order?.col && !isSafeIdent(body.order.col)) {
          return c.json({ data: null, error: { message: `Invalid order column: ${body.order.col}` } }, 400);
        }

        let q: any = db.from(body.table).select(body.select || "*");
        for (const f of filters) {
          const [op, a, b] = f;
          if (op === "eq") q = q.eq(a, b);
          else if (op === "in") q = q.in(a, b as unknown[]);
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

      if (verb === "insert") {
        const rows = Array.isArray(body.rows) ? body.rows : [body.rows];
        if (!rows.length || rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))) {
          return c.json({ data: null, error: { message: "Invalid rows payload" } }, 400);
        }
        let q: any = db.from(body.table).insert(rows);
        if (body.returning) q = q.select(body.returning);
        if (body.single) q = q.single();
        return c.json(await q);
      }

      if (verb === "update") {
        if (!body.patch || typeof body.patch !== "object" || Array.isArray(body.patch)) {
          return c.json({ data: null, error: { message: "Invalid patch payload" } }, 400);
        }
        if (filters.length === 0) {
          return c.json({ data: null, error: { message: "At least one filter is required" } }, 400);
        }
        const filterOps = new Set<FilterOp>(["eq"]);
        for (const f of filters) {
          const err = validateFilterTuple(f, filterOps);
          if (err) return c.json({ data: null, error: { message: err } }, 400);
        }
        let q: any = db.from(body.table).update(body.patch);
        for (const f of filters) {
          const [, a, b] = f;
          q = q.eq(a, b);
        }
        return c.json(await q);
      }

      if (verb === "delete") {
        if (filters.length === 0) {
          return c.json({ data: null, error: { message: "At least one filter is required" } }, 400);
        }
        const filterOps = new Set<FilterOp>(["eq", "neq"]);
        for (const f of filters) {
          const err = validateFilterTuple(f, filterOps);
          if (err) return c.json({ data: null, error: { message: err } }, 400);
        }
        let q: any = db.from(body.table).delete();
        for (const f of filters) {
          const [op, a, b] = f;
          if (op === "eq") q = q.eq(a, b);
          else q = q.neq(a, b);
        }
        return c.json(await q);
      }

      const pool = getPool();
      let sql = `SELECT COUNT(*)::int AS c FROM "${body.table}"`;
      const vals: unknown[] = [];
      const parts: string[] = [];
      let i = 1;
      const filterOps = new Set<FilterOp>(["eq", "in"]);
      for (const f of filters) {
        const err = validateFilterTuple(f, filterOps);
        if (err) return c.json({ count: 0, error: { message: err } }, 400);

        const [op, col, val] = f;
        if (op === "eq") {
          parts.push(`"${col}" = $${i++}`);
          vals.push(val);
        } else if (op === "in") {
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
    } catch (e: any) {
      return c.json({ data: null, error: { message: e.message || String(e) } }, 500);
    }
  });
}
