import { crmUrl, authHeaders } from "./crmApi.ts";
import { normalizeCredential } from "./normalizeCredential.ts";

type SessionUser = {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
};

function decodeJwtPayload(token: string): {
  sub?: string;
  email?: string;
  name?: string;
  role?: string;
  exp?: number;
} | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isTokenExpired(payload: { exp?: number }): boolean {
  if (!payload.exp) return false;
  return payload.exp * 1000 < Date.now() - 30_000;
}

function sessionFromToken(token: string): { user: SessionUser } | null {
  const payload = decodeJwtPayload(token);
  if (!payload?.sub || isTokenExpired(payload)) return null;
  return {
    user: {
      id: payload.sub,
      email: payload.email ?? "",
      user_metadata: {
        name: payload.name ?? "",
        role: payload.role ?? "",
      },
    },
  };
}

async function fetchMe(token: string, attempt = 0): Promise<Response> {
  try {
    return await fetch(crmUrl("/auth/me"), {
      headers: { ...authHeaders(false), Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (e) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return fetchMe(token, attempt + 1);
    }
    throw e;
  }
}

async function crmRun(body: Record<string, unknown>) {
  try {
    const res = await fetch(crmUrl("/crm/run"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    try {
      return await res.json();
    } catch {
      return { data: null, error: { message: "Некорректный ответ сервера" } };
    }
  } catch (e) {
    return {
      data: null,
      error: { message: e instanceof Error ? e.message : "Ошибка сети" },
    };
  }
}

class SelectChain {
  private filters: unknown[] = [];
  private orderSpec?: { col: string; opts?: { ascending?: boolean } };
  private limitN: number | null = null;
  private singleMode: "none" | "one" | "maybe" = "none";

  constructor(
    private table: string,
    private selectStr: string,
    private countOpts?: { count: string; head?: boolean },
  ) {}

  eq(col: string, val: unknown) {
    this.filters.push(["eq", col, val]);
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push(["neq", col, val]);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push(["in", col, vals]);
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push(["gte", col, val]);
    return this;
  }
  lte(col: string, val: unknown) {
    this.filters.push(["lte", col, val]);
    return this;
  }
  ilike(col: string, val: unknown) {
    this.filters.push(["ilike", col, val]);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderSpec = { col, opts };
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single() {
    this.singleMode = "one";
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  private async execSelect() {
    if (this.countOpts?.count === "exact" && this.countOpts?.head) {
      const r = await crmRun({
        verb: "count",
        table: this.table,
        filters: this.filters,
      });
      return { count: r.count ?? 0, error: r.error ?? null };
    }
    return crmRun({
      verb: "select",
      table: this.table,
      select: this.selectStr,
      filters: this.filters,
      order: this.orderSpec,
      limit: this.limitN ?? undefined,
      single: this.singleMode === "none" ? undefined : this.singleMode,
    });
  }

  then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
    return this.execSelect().then(onFulfilled as any, onRejected);
  }
}

class InsertChain {
  private returning: string | null = null;
  private singleMode = false;
  constructor(
    private table: string,
    private rows: Record<string, unknown>[],
  ) {}
  select(cols: string) {
    this.returning = cols;
    return this;
  }
  single() {
    this.singleMode = true;
    return this;
  }
  then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
    return crmRun({
      verb: "insert",
      table: this.table,
      rows: this.rows,
      returning: this.returning ?? undefined,
      single: this.singleMode,
    }).then(onFulfilled as any, onRejected);
  }
}

class UpdateChain {
  private filters: unknown[] = [];
  constructor(
    private table: string,
    private patch: Record<string, unknown>,
  ) {}
  eq(col: string, val: unknown) {
    this.filters.push(["eq", col, val]);
    return this;
  }
  then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
    return crmRun({
      verb: "update",
      table: this.table,
      patch: this.patch,
      filters: this.filters,
    }).then(onFulfilled as any, onRejected);
  }
}

class DeleteChain {
  private filters: unknown[] = [];
  constructor(private table: string) {}
  eq(col: string, val: unknown) {
    this.filters.push(["eq", col, val]);
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push(["neq", col, val]);
    return this;
  }
  then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
    return crmRun({
      verb: "delete",
      table: this.table,
      filters: this.filters,
    }).then(onFulfilled as any, onRejected);
  }
}

function fromTable(table: string) {
  return {
    select(sel: string, opts?: { count?: string; head?: boolean }) {
      return new SelectChain(table, sel, opts);
    },
    insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
      const arr = Array.isArray(rows) ? rows : [rows];
      return new InsertChain(table, arr);
    },
    update(patch: Record<string, unknown>) {
      return new UpdateChain(table, patch);
    },
    delete() {
      return new DeleteChain(table);
    },
  };
}

/** HTTP-клиент к Postgres через `/crm/run` и JWT-сессия через `/auth/*`. */
export const crm = {
  from: fromTable,
  auth: {
    async getSession() {
      const t = localStorage.getItem("crm_token");
      if (!t) return { data: { session: null } };

      const optimistic = sessionFromToken(t);

      try {
        const res = await fetchMe(t);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            localStorage.removeItem("crm_token");
            window.dispatchEvent(new Event("crm-auth"));
            return { data: { session: null } };
          }
          // Сервер временно недоступен (502/503) — не выкидываем, если токен ещё валиден
          if (optimistic) {
            return { data: { session: optimistic } };
          }
          return { data: { session: null } };
        }
        let body: { user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> } };
        try {
          body = await res.json();
        } catch {
          if (optimistic) return { data: { session: optimistic } };
          localStorage.removeItem("crm_token");
          window.dispatchEvent(new Event("crm-auth"));
          return { data: { session: null } };
        }
        const user = body.user;
        if (!user?.id) {
          localStorage.removeItem("crm_token");
          window.dispatchEvent(new Event("crm-auth"));
          return { data: { session: null } };
        }
        return {
          data: {
            session: {
              user: {
                id: user.id,
                email: user.email ?? "",
                user_metadata: (user.user_metadata || {}) as Record<string, unknown>,
              },
            },
          },
        };
      } catch {
        // Сеть упала при перезагрузке / деплое — сохраняем сессию по JWT, не разлогиниваем
        if (optimistic) {
          return { data: { session: optimistic } };
        }
        return { data: { session: null } };
      }
    },
    onAuthStateChange(cb: (event: string, session: unknown) => void) {
      const fn = () => {
        void crm.auth.getSession().then(({ data }) => {
          cb("INITIAL_SESSION", data.session);
        });
      };
      window.addEventListener("crm-auth", fn);
      fn();
      return { data: { subscription: { unsubscribe: () => window.removeEventListener("crm-auth", fn) } } };
    },
    async signInWithPassword(creds: { email: string; password: string }) {
      const payload = {
        email: normalizeCredential(creds.email).toLowerCase(),
        password: normalizeCredential(creds.password),
      };
      let res: Response;
      try {
        res = await fetch(crmUrl("/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        return { error: { message: e instanceof Error ? e.message : "Ошибка сети" } };
      }
      let j: { error?: string; token?: string };
      try {
        j = await res.json();
      } catch {
        return { error: { message: "Некорректный ответ сервера" } };
      }
      if (!res.ok || !j.token) {
        return { error: { message: j.error || "Ошибка входа" } };
      }
      localStorage.setItem("crm_token", j.token);
      window.dispatchEvent(new Event("crm-auth"));
      return { error: null };
    },
    async signOut() {
      localStorage.removeItem("crm_token");
      window.dispatchEvent(new Event("crm-auth"));
    },
  },
};
