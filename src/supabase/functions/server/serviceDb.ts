/**
 * Postgres-backed client with a small subset of chained-query APIs (совместимый стиль вызовов) для этого CRM.
 */
import { getPool } from "./dbPool.ts";
import * as authAdmin from "./authAdmin.ts";
import fs from "node:fs";
import path from "node:path";

const TABLES = new Set([
  "deals",
  "companies",
  "contacts",
  "stages",
  "pipelines",
  "tasks",
  "leads",
  "calendar_events",
]);

function err(message: string) {
  return { message };
}

type Filter = { col: string; op: "=" | ">=" | "<=" | "<>" | "IN"; val: unknown };

class BaseBuilder {
  protected filters: Filter[] = [];
  protected orderCol: string | null = null;
  protected orderAsc = true;
  protected limitN: number | null = null;
  protected single: "none" | "one" | "maybe" = "none";

  constructor(protected table: string) {}

  eq(col: string, val: unknown) {
    this.filters.push({ col, op: "=", val });
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push({ col, op: "IN", val: vals });
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push({ col, op: ">=", val });
    return this;
  }
  lte(col: string, val: unknown) {
    this.filters.push({ col, op: "<=", val });
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push({ col, op: "<>", val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single() {
    this.single = "one";
    return this;
  }
  maybeSingle() {
    this.single = "maybe";
    return this;
  }

  protected buildWhere(alias: string, startIdx: number) {
    const vals: unknown[] = [];
    const parts: string[] = [];
    let i = startIdx;
    for (const f of this.filters) {
      const col =
        f.col === "start" && this.table === "calendar_events"
          ? `${alias}.start_ts`
          : `${alias}."${f.col}"`;
      if (f.op === "IN") {
        const arr = f.val as unknown[];
        const ph = arr.map(() => `$${i++}`).join(", ");
        vals.push(...arr);
        parts.push(`${col} IN (${ph})`);
      } else {
        parts.push(`${col} ${f.op} $${i++}`);
        vals.push(f.val);
      }
    }
    return { sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "", vals, next: i };
  }

  protected finishSelect(rows: any[]): { data: any; error: any } {
    if (this.single === "one") {
      if (rows.length !== 1) return { data: null, error: err("JSON object requested, multiple (or no) rows returned") };
      return { data: rows[0], error: null };
    }
    if (this.single === "maybe") {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }
}

class SelectBuilder extends BaseBuilder {
  constructor(
    table: string,
    private selectStr: string,
  ) {
    super(table);
  }

  async execute(): Promise<{ data: any; error: any }> {
    const pool = getPool();
    if (!TABLES.has(this.table)) {
      return { data: null, error: err(`Unknown table ${this.table}`) };
    }
    try {
      if (this.table === "pipelines" && this.selectStr.includes("stages(")) {
        const { rows } = await pool.query(
          `SELECT p.id, p.name, p.description, p.is_default, p.created_at,
            COALESCE(
              (SELECT json_agg(json_build_object(
                  'id', s.id,
                  'name', s.name,
                  'order', s.order_index
                ) ORDER BY s.order_index)
               FROM stages s WHERE s.pipeline_id = p.id),
              '[]'::json
            ) AS stages
           FROM pipelines p
           ORDER BY p.created_at DESC`,
        );
        return { data: rows, error: null };
      }

      if (this.table === "calendar_events") {
        let sql = `SELECT id, title, start_ts AS start, end_ts AS end, type FROM calendar_events c`;
        const { sql: w, vals } = this.buildWhere("c", 1);
        sql += w ? ` ${w}` : "";
        if (this.orderCol === "start") sql += ` ORDER BY c.start_ts ${this.orderAsc ? "ASC" : "DESC"}`;
        if (this.limitN != null) sql += ` LIMIT ${this.limitN}`;
        const { rows } = await pool.query(sql, vals);
        return this.finishSelect(rows);
      }

      if (this.table === "contacts" && this.selectStr.includes("companies(")) {
        let sql = `SELECT c.id,
          TRIM(CONCAT(COALESCE(c.first_name,''),' ', COALESCE(c.last_name,''))) AS name,
          c.position, c.phone, c.email, c.company_id,
          json_build_object('name', co.name) AS companies
        FROM contacts c
        LEFT JOIN companies co ON co.id = c.company_id`;
        const { sql: w, vals } = this.buildWhere("c", 1);
        sql += w ? ` ${w}` : "";
        if (this.orderCol === "created_at") sql += ` ORDER BY c.created_at ${this.orderAsc ? "ASC" : "DESC"}`;
        if (this.orderCol === "first_name") sql += ` ORDER BY c.first_name ${this.orderAsc ? "ASC" : "DESC"}`;
        if (this.limitN != null) sql += ` LIMIT ${this.limitN}`;
        const { rows } = await pool.query(sql, vals);
        return { data: rows, error: null };
      }

      if (this.table === "deals") {
        const s = this.selectStr;
        const needCompanies = s.includes("companies");
        const needStages = s.includes("stages");
        let sql = `SELECT d.*`;
        if (needCompanies) sql += `, json_build_object('name', c.name, 'email', c.email) AS companies`;
        if (needStages) sql += `, json_build_object('name', st.name) AS stages`;
        sql += ` FROM deals d`;
        if (needCompanies) sql += ` LEFT JOIN companies c ON c.id = d.company_id`;
        if (needStages) sql += ` LEFT JOIN stages st ON st.id = d.stage_id`;
        const { sql: w, vals } = this.buildWhere("d", 1);
        sql += w ? ` ${w}` : "";
        if (this.orderCol) sql += ` ORDER BY d."${this.orderCol}" ${this.orderAsc ? "ASC" : "DESC"}`;
        if (this.limitN != null) sql += ` LIMIT ${this.limitN}`;
        const { rows } = await pool.query(sql, vals);
        return this.finishSelect(rows);
      }

      let cols = this.selectStr;
      if (this.table === "contacts" && cols.includes("name") && !cols.includes("first_name")) {
        cols = cols.replace(
          /\bname\b/,
          `TRIM(CONCAT(COALESCE(first_name,''),' ', COALESCE(last_name,''))) AS name`,
        );
      }
      let sql = `SELECT ${cols} FROM "${this.table}" t`;
      const { sql: w, vals } = this.buildWhere("t", 1);
      sql += w ? ` ${w}` : "";
      if (this.orderCol) sql += ` ORDER BY t."${this.orderCol}" ${this.orderAsc ? "ASC" : "DESC"}`;
      if (this.limitN != null) sql += ` LIMIT ${this.limitN}`;
      const { rows } = await pool.query(sql, vals);
      return this.finishSelect(rows);
    } catch (e: any) {
      return { data: null, error: err(e.message || String(e)) };
    }
  }

  then(onFulfilled?: any, onRejected?: any) {
    return this.execute().then(onFulfilled, onRejected);
  }
}

class InsertBuilder extends BaseBuilder {
  private returning: string | null = null;

  constructor(
    table: string,
    private rows: Record<string, unknown>[],
  ) {
    super(table);
  }

  select(cols: string) {
    this.returning = cols;
    return this;
  }

  async execute(): Promise<{ data: any; error: any }> {
    const pool = getPool();
    if (!TABLES.has(this.table)) {
      return { data: null, error: err(`Unknown table ${this.table}`) };
    }
    if (this.rows.length !== 1) {
      return { data: null, error: err("Only single-row insert") };
    }
    const row = this.rows[0]!;
    const keys = Object.keys(row).filter((k) => row[k] !== undefined);
    const vals = keys.map((k) => row[k]);
    const ph = keys.map((_, i) => `$${i + 1}`).join(", ");
    const ret = this.returning ? `RETURNING ${this.returning === "*" ? "*" : this.returning}` : "RETURNING *";
    const q = `INSERT INTO "${this.table}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${ph}) ${ret}`;
    try {
      const { rows } = await pool.query(q, vals);
      const out = rows[0] ?? null;
      if (this.single === "one" && !out) return { data: null, error: err("insert failed") };
      if (this.single === "one") return { data: out, error: null };
      if (this.single === "maybe") return { data: out, error: null };
      return { data: out ?? rows, error: null };
    } catch (e: any) {
      return { data: null, error: err(e.message || String(e)) };
    }
  }

  single() {
    this.single = "one";
    return this;
  }
  maybeSingle() {
    this.single = "maybe";
    return this;
  }

  then(onFulfilled?: any, onRejected?: any) {
    return this.execute().then(onFulfilled, onRejected);
  }
}

class UpdateBuilder extends BaseBuilder {
  constructor(
    table: string,
    private patch: Record<string, unknown>,
  ) {
    super(table);
  }

  async execute(): Promise<{ data: any; error: any }> {
    const pool = getPool();
    const keys = Object.keys(this.patch);
    if (!keys.length) return { data: null, error: null };
    const vals = keys.map((k) => this.patch[k]);
    const sets = keys.map((k, i) => `"${k}" = $${i + 1}`);
    const { sql: w, vals: wvals } = this.buildWhere("t", keys.length + 1);
    const q = `UPDATE "${this.table}" AS t SET ${sets.join(", ")} ${w}`;
    try {
      await pool.query(q, [...vals, ...wvals]);
      return { data: null, error: null };
    } catch (e: any) {
      return { data: null, error: err(e.message || String(e)) };
    }
  }

  then(onFulfilled?: any, onRejected?: any) {
    return this.execute().then(onFulfilled, onRejected);
  }
}

class DeleteBuilder extends BaseBuilder {
  async execute(): Promise<{ data: any; error: any }> {
    const pool = getPool();
    const { sql: w, vals } = this.buildWhere("t", 1);
    const q = `DELETE FROM "${this.table}" AS t ${w}`;
    try {
      await pool.query(q, vals);
      return { data: null, error: null };
    } catch (e: any) {
      return { data: null, error: err(e.message || String(e)) };
    }
  }

  then(onFulfilled?: any, onRejected?: any) {
    return this.execute().then(onFulfilled, onRejected);
  }
}

function fromTable(table: string) {
  return {
    select(selectStr: string) {
      return new SelectBuilder(table, selectStr);
    },
    insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
      const arr = Array.isArray(rows) ? rows : [rows];
      return new InsertBuilder(table, arr);
    },
    update(patch: Record<string, unknown>) {
      return new UpdateBuilder(table, patch);
    },
    delete() {
      return new DeleteBuilder(table);
    },
  };
}

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function createClient(_url?: string | null, _key?: string | null) {
  return {
    from: (t: string) => fromTable(t),
    auth: {
      admin: {
        createUser: authAdmin.adminCreateUser,
        updateUserById: authAdmin.adminUpdateUserById,
        deleteUser: authAdmin.adminDeleteUser,
      },
    },
    storage: {
      async listBuckets() {
        return { data: [{ name: "make-f9553289-chat-images" }], error: null };
      },
      async createBucket(_name: string, _opts?: { public?: boolean }) {
        return { data: { name: _name }, error: null };
      },
      from(_bucket: string) {
        return {
          upload: async (
            fileName: string,
            body: Buffer | Uint8Array | File | Blob,
            _opts?: { contentType?: string },
          ) => {
            ensureUploadDir();
            const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
            const fp = path.join(UPLOAD_DIR, safe);
            let buf: Buffer;
            if (typeof Blob !== "undefined" && (body instanceof Blob || body instanceof File)) {
              buf = Buffer.from(await body.arrayBuffer());
            } else {
              buf = Buffer.from(body as Buffer);
            }
            await fs.promises.writeFile(fp, buf);
            return { data: { path: safe }, error: null };
          },
          createSignedUrl: async (fileName: string, _seconds: number) => {
            const base =
              process.env["PUBLIC_BASE_URL"]?.replace(/\/$/, "") || "http://localhost:4000";
            const url = `${base}/make-server-f9553289/static-uploads/${encodeURIComponent(fileName)}`;
            return { data: { signedUrl: url }, error: null };
          },
        };
      },
    },
  };
}
