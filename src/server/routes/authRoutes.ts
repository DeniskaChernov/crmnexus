import type { Hono } from "hono";
import { signUserToken, verifyBearer } from "../jwt.ts";
import { normalizeCredential } from "../../lib/normalizeCredential.ts";

async function issueTokenForEmail(email: string) {
  const { getPool } = await import("../dbPool.ts");
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    email: string;
    name: string | null;
    role: string;
  }>(`SELECT id, email, name, role FROM crm_users WHERE email = $1`, [email]);
  const user = rows[0];
  if (!user) return null;
  const token = await signUserToken(user);
  return { token, user };
}

const FALLBACK_OWNER_EMAIL = "denisblackman2@gmail.com";

async function resolveMigrationEmail(): Promise<string> {
  const fromEnv = process.env["CRM_BOOTSTRAP_EMAIL"]?.trim().toLowerCase();
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

  return FALLBACK_OWNER_EMAIL;
}

export function registerAuthRoutes(app: Hono) {
  /** Вход без пароля в браузере — только для периода миграции. */
  app.post("/api/auth/migration-login", async (c) => {
    try {
      const email = await resolveMigrationEmail();
      const issued = await issueTokenForEmail(email);
      if (!issued) {
        console.warn("[auth/migration-login] user not found", { email });
        return c.json({ error: `Пользователь ${email} не найден в базе` }, 404);
      }
      return c.json({
        token: issued.token,
        user: {
          id: issued.user.id,
          email: issued.user.email,
          user_metadata: { name: issued.user.name, role: issued.user.role },
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
      const user = await verifyUserPassword(email, pass);
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
          user_metadata: { name: user.name, role: user.role },
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
      return c.json({
        user: {
          id: payload.sub,
          email: payload.email,
          user_metadata: { name: payload.name, role: payload.role },
        },
      });
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }
  });
}
