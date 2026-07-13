import type { Hono } from "hono";
import { signUserToken, verifyBearer } from "../jwt.ts";
import { normalizeCredential } from "../../lib/normalizeCredential.ts";
import { DEFAULT_OWNER, ensureOwnerUser, ownerCredentials } from "../../../server/ensureOwner.ts";

async function issueTokenForEmail(email: string) {
  const { getPool } = await import("../dbPool.ts");
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    company_id: string | null;
  }>(`SELECT id, email, name, role, company_id FROM crm_users WHERE lower(email) = lower($1)`, [email]);
  const user = rows[0];
  if (!user) return null;
  const token = await signUserToken(user);
  return { token, user };
}

async function resolveMigrationEmail(): Promise<string> {
  const fromEnv = ownerCredentials().email;
  if (fromEnv) return fromEnv;

  try {
    const { getPool } = await import("../dbPool.ts");
    const pool = getPool();
    const { rows } = await pool.query<{ email: string }>(
      `SELECT email FROM crm_users
       WHERE lower(role) IN ('owner', 'director', 'admin')
       ORDER BY created_at ASC
       LIMIT 1`,
    );
    const fromDb = rows[0]?.email?.trim().toLowerCase();
    if (fromDb) return fromDb;

    const any = await pool.query<{ email: string }>(
      `SELECT email FROM crm_users ORDER BY created_at ASC LIMIT 1`,
    );
    const anyEmail = any.rows[0]?.email?.trim().toLowerCase();
    if (anyEmail) return anyEmail;
  } catch (e) {
    console.warn("[auth/migration-login] db lookup failed, using fallback", e);
  }

  return DEFAULT_OWNER.email;
}

export function registerAuthRoutes(app: Hono) {
  /** Вход без пароля в браузере — только для периода миграции. */
  app.post("/api/auth/migration-login", async (c) => {
    try {
      const { getPool } = await import("../dbPool.ts");
      const pool = getPool();

      let email = await resolveMigrationEmail();
      let issued = await issueTokenForEmail(email);

      if (!issued) {
        console.warn("[auth/migration-login] creating owner", { email });
        email = await ensureOwnerUser(pool);
        issued = await issueTokenForEmail(email);
      }

      if (!issued) {
        return c.json({ error: "Не удалось создать пользователя для входа" }, 500);
      }
      return c.json({
        token: issued.token,
        user: {
          id: issued.user.id,
          email: issued.user.email,
          user_metadata: {
            name: issued.user.name,
            role: issued.user.role,
            company_id: issued.user.company_id,
          },
        },
      });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  app.post("/api/auth/login", async (c) => {
    try {
      const { email: emailRaw, password } = await c.req.json();
      const email = normalizeCredential(String(emailRaw || "")).toLowerCase();
      const pass = normalizeCredential(String(password || ""));
      if (!email || !pass) return c.json({ error: "Email and password required" }, 400);
      const { verifyUserPassword } = await import("../authAdmin.ts");
      let user = await verifyUserPassword(email, pass);
      if (!user && email === ownerCredentials().email) {
        const { getPool } = await import("../dbPool.ts");
        await ensureOwnerUser(getPool());
        user = await verifyUserPassword(email, pass);
      }
      if (!user) {
        console.warn("[auth/login] failed", { email, passLen: pass.length });
        return c.json({ error: "Неверный email или пароль" }, 401);
      }
      const token = await signUserToken(user);
      return c.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          user_metadata: { name: user.name, role: user.role, company_id: user.company_id },
        },
      });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  app.get("/api/auth/me", async (c) => {
    try {
      const auth = c.req.header("authorization");
      if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);
      const payload = await verifyBearer(auth.slice(7));
      const pool = (await import("../dbPool.ts")).getPool();
      const { rows } = await pool.query<{
        name: string | null;
        role: string;
        company_id: string | null;
      }>(`SELECT name, role, company_id FROM crm_users WHERE id = $1`, [payload.sub]);
      const dbUser = rows[0];
      return c.json({
        user: {
          id: payload.sub,
          email: payload.email,
          user_metadata: {
            name: dbUser?.name ?? payload.name,
            role: dbUser?.role ?? payload.role,
            company_id: dbUser?.company_id ?? payload.company_id ?? null,
          },
        },
      });
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }
  });
}
