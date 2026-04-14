import { getPool } from "./dbPool.ts";

export const set = async (key: string, value: unknown): Promise<void> => {
  const pool = getPool();
  await pool.query(
    `INSERT INTO crm_kv (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value ?? null)],
  );
};

export const get = async (key: string): Promise<any> => {
  const pool = getPool();
  const { rows } = await pool.query<{ value: unknown }>(
    `SELECT value FROM crm_kv WHERE key = $1`,
    [key],
  );
  return rows[0]?.value ?? null;
};

export const del = async (key: string): Promise<void> => {
  const pool = getPool();
  await pool.query(`DELETE FROM crm_kv WHERE key = $1`, [key]);
};

export const mset = async (keys: string[], values: any[]): Promise<void> => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < keys.length; i++) {
      await client.query(
        `INSERT INTO crm_kv (key, value, updated_at) VALUES ($1, $2::jsonb, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [keys[i], JSON.stringify(values[i] ?? null)],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

export const mget = async (keys: string[]): Promise<any[]> => {
  if (keys.length === 0) return [];
  const pool = getPool();
  const { rows } = await pool.query<{ key: string; value: unknown }>(
    `SELECT key, value FROM crm_kv WHERE key = ANY($1::text[])`,
    [keys],
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return keys.map((k) => map.get(k) ?? null);
};

export const mdel = async (keys: string[]): Promise<void> => {
  if (keys.length === 0) return;
  const pool = getPool();
  await pool.query(`DELETE FROM crm_kv WHERE key = ANY($1::text[])`, [keys]);
};

export const getByPrefix = async (prefix: string): Promise<any[]> => {
  const pool = getPool();
  const { rows } = await pool.query<{ value: unknown }>(
    `SELECT value FROM crm_kv WHERE key LIKE $1 ORDER BY key`,
    [`${prefix}%`],
  );
  return rows.map((r) => r.value);
};

export const scanByKeyLike = async (
  likePattern: string,
): Promise<{ key: string; value: any }[]> => {
  const pool = getPool();
  const { rows } = await pool.query<{ key: string; value: unknown }>(
    `SELECT key, value FROM crm_kv WHERE key LIKE $1`,
    [likePattern],
  );
  return rows.map((r) => ({ key: r.key, value: r.value }));
};
