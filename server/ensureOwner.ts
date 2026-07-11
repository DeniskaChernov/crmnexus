import bcrypt from "bcryptjs";
import type pg from "pg";

export const DEFAULT_OWNER = {
  email: "denisblackman2@gmail.com",
  password: "20260711",
  name: "Denis Chernov",
  role: "owner",
};

export function ownerCredentials() {
  return {
    email: (process.env["CRM_BOOTSTRAP_EMAIL"]?.trim() || DEFAULT_OWNER.email).toLowerCase(),
    password: process.env["CRM_BOOTSTRAP_PASSWORD"]?.trim() || DEFAULT_OWNER.password,
    name: process.env["CRM_BOOTSTRAP_NAME"]?.trim() || DEFAULT_OWNER.name,
    role: process.env["CRM_BOOTSTRAP_ROLE"]?.trim() || DEFAULT_OWNER.role,
  };
}

/** Создаёт или обновляет владельца — вызывается при старте и при migration-login. */
export async function ensureOwnerUser(pool: pg.Pool): Promise<string> {
  const { email, password, name, role } = ownerCredentials();
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO crm_users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       role = EXCLUDED.role`,
    [email, hash, name, role],
  );
  return email;
}
