import { crmUrl, authHeaders } from "./crmApi.ts";

async function crmRun(body: Record<string, unknown>) {
  const res = await fetch(crmUrl("/crm/run"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return res.json();
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

const noopSub = { unsubscribe: () => {} };

/** HTTP-клиент к Postgres через `/crm/run` и JWT-сессия через `/auth/*`. */
export const crm = {
  from: fromTable,
  channel(_name: string) {
    return {
      on() {
        return { subscribe: () => noopSub };
      },
      subscribe: () => noopSub,
    };
  },
  removeChannel() {},
  auth: {
    async getSession() {
      const t = localStorage.getItem("crm_token");
      if (!t) return { data: { session: null } };
      try {
        const res = await fetch(crmUrl("/auth/me"), {
          headers: { ...authHeaders(false), Authorization: `Bearer ${t}` },
        });
        if (!res.ok) return { data: { session: null } };
        const { user } = await res.json();
        return {
          data: {
            session: {
              user: {
                id: user.id,
                email: user.email,
                user_metadata: user.user_metadata || {},
              },
            },
          },
        };
      } catch {
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
      const res = await fetch(crmUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });
      const j = await res.json();
      if (!res.ok) return { error: { message: j.error || "Login failed" } };
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
