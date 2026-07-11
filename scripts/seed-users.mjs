import pg from "pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const password = process.env.SEED_PASSWORD || "BttNexus2026";

const users = [
  { email: "denisblackman2@gmail.com", name: "Denis Chernov", role: "owner" },
  { email: "aandreev94@yandex.com", name: "Артемий", role: "manager" },
  { email: "tema20041@gmail.com", name: "Евгений Павлович", role: "owner" },
  { email: "tema20041@mail.ru", name: "Евгений Павлович", role: "owner" },
];

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const hash = await bcrypt.hash(password, 10);

for (const u of users) {
  const email = u.email.trim().toLowerCase();
  const r = await pool.query(
    `INSERT INTO crm_users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       role = EXCLUDED.role
     RETURNING email, role`,
    [email, hash, u.name, u.role],
  );
  console.log("OK", r.rows[0].email, r.rows[0].role);
}

console.log("\nПароль для всех:", password);
await pool.end();
