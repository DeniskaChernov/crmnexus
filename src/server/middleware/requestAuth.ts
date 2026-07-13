import type { Context } from "hono";
import { verifyBearer } from "../jwt.ts";
import { getPool } from "../dbPool.ts";

export type RequestAuth = {
  userId: string;
  email: string;
  name: string;
  role: string;
  company_id: string | null;
};

const ADMIN_ROLES = new Set(["owner", "director", "admin"]);

export async function getRequestAuth(c: Context): Promise<RequestAuth | null> {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = await verifyBearer(header.slice(7));
    if (!payload.sub) return null;
    const pool = getPool();
    const { rows } = await pool.query<{
      role: string;
      company_id: string | null;
      name: string | null;
      email: string;
    }>(`SELECT role, company_id, name, email FROM crm_users WHERE id = $1`, [payload.sub]);
    const row = rows[0];
    return {
      userId: payload.sub,
      email: row?.email ?? payload.email ?? "",
      name: row?.name ?? payload.name ?? "",
      role: row?.role ?? payload.role ?? "",
      company_id: row?.company_id ?? payload.company_id ?? null,
    };
  } catch {
    return null;
  }
}

export function isDealer(auth: RequestAuth): boolean {
  return auth.role === "dealer" && Boolean(auth.company_id);
}

export function isAdminRole(auth: RequestAuth): boolean {
  return ADMIN_ROLES.has(auth.role?.toLowerCase() ?? "");
}

export function requireDealer(auth: RequestAuth | null): auth is RequestAuth {
  return Boolean(auth && isDealer(auth));
}
