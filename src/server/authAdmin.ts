import bcrypt from "bcryptjs";
import { getPool } from "./dbPool.ts";
import { normalizeCredential } from "../lib/normalizeCredential.ts";

const SALT = 10;

export async function adminCreateUser(params: {
  email: string;
  password: string;
  user_metadata?: { name?: string; role?: string; company_id?: string | null };
  email_confirm?: boolean;
}): Promise<{ data: { user: { id: string; email?: string } } | null; error: { message: string } | null }> {
  const pool = getPool();
  const email = params.email.trim().toLowerCase();
  const hash = await bcrypt.hash(params.password, SALT);
  const name = params.user_metadata?.name ?? email.split("@")[0]!;
  const role = params.user_metadata?.role ?? "director";
  const company_id = params.user_metadata?.company_id ?? null;
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO crm_users (email, password_hash, name, role, company_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [email, hash, name, role, company_id],
    );
    return { data: { user: { id: rows[0]!.id, email } }, error: null };
  } catch (e: any) {
    if (e.code === "23505") {
      return { data: null, error: { message: "User already registered" } };
    }
    return { data: null, error: { message: e.message || "createUser failed" } };
  }
}

export async function adminUpdateUserById(
  id: string,
  params: { email?: string; password?: string; user_metadata?: { name?: string; role?: string; company_id?: string | null } },
): Promise<{ error: { message: string } | null }> {
  const pool = getPool();
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (params.email) {
    sets.push(`email = $${i++}`);
    vals.push(params.email.trim().toLowerCase());
  }
  if (params.password) {
    sets.push(`password_hash = $${i++}`);
    vals.push(await bcrypt.hash(params.password, SALT));
  }
  if (params.user_metadata?.name !== undefined) {
    sets.push(`name = $${i++}`);
    vals.push(params.user_metadata.name);
  }
  if (params.user_metadata?.role !== undefined) {
    sets.push(`role = $${i++}`);
    vals.push(params.user_metadata.role);
  }
  if (params.user_metadata?.company_id !== undefined) {
    sets.push(`company_id = $${i++}`);
    vals.push(params.user_metadata.company_id);
  }
  if (sets.length === 0) return { error: null };
  vals.push(id);
  await pool.query(`UPDATE crm_users SET ${sets.join(", ")} WHERE id = $${i}`, vals);
  return { error: null };
}

export async function adminDeleteUser(id: string): Promise<{ error: { message: string } | null }> {
  const pool = getPool();
  await pool.query(`DELETE FROM crm_users WHERE id = $1`, [id]);
  return { error: null };
}

export async function verifyUserPassword(
  email: string,
  password: string,
): Promise<{ id: string; email: string; name: string | null; role: string; company_id: string | null } | null> {
  const pool = getPool();
  const normalizedEmail = normalizeCredential(email).toLowerCase();
  const normalizedPassword = normalizeCredential(password);
  const { rows } = await pool.query<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    company_id: string | null;
    password_hash: string;
  }>(`SELECT id, email, name, role, company_id, password_hash FROM crm_users WHERE lower(email) = lower($1)`, [
    normalizedEmail,
  ]);
  const row = rows[0];
  if (!row) return null;
  const ok = await bcrypt.compare(normalizedPassword, row.password_hash);
  if (!ok) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    company_id: row.company_id,
  };
}
