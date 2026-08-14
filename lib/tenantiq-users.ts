import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.TENANTIQ_AUTH_DATABASE_URL?.trim();

const globalForTenantIQ = globalThis as unknown as { tenantiqAuthPool?: Pool };

export const authPool =
  globalForTenantIQ.tenantiqAuthPool ||
  (connectionString
    ? new Pool({ connectionString })
    : new Pool({
        host: process.env.TENANTIQ_AUTH_DB_HOST || '127.0.0.1',
        port: Number(process.env.TENANTIQ_AUTH_DB_PORT || 5432),
        user: process.env.TENANTIQ_AUTH_DB_USER || 'postgres',
        password: process.env.TENANTIQ_AUTH_DB_PASSWORD || 'postgres',
        database: process.env.TENANTIQ_AUTH_DB_NAME || 'tenantiq',
      }));

if (process.env.NODE_ENV !== 'production') globalForTenantIQ.tenantiqAuthPool = authPool;

export type TenantIQUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export async function ensureUserSchema() {
  await authPool.query(`
    CREATE TABLE IF NOT EXISTS tenantiq_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function findUserByEmail(email: string) {
  await ensureUserSchema();
  const normalized = email.trim().toLowerCase();
  const { rows } = await authPool.query(
    `SELECT id, email, name, password_hash, email_verified FROM tenantiq_users WHERE email = $1 LIMIT 1`,
    [normalized],
  );
  return rows[0] || null;
}

export async function verifyUserPassword(email: string, password: string): Promise<TenantIQUser | null> {
  const row = await findUserByEmail(email);
  if (!row) return null;
  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) return null;
  return {
    id: `tenantiq:${row.id}`,
    email: row.email,
    name: row.name,
    emailVerified: Boolean(row.email_verified),
  };
}

export async function createUser(input: { email: string; password: string; name: string }): Promise<TenantIQUser> {
  await ensureUserSchema();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const { rows } = await authPool.query(
    `INSERT INTO tenantiq_users (email, name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, email_verified`,
    [email, name, passwordHash],
  );
  const row = rows[0];
  return {
    id: `tenantiq:${row.id}`,
    email: row.email,
    name: row.name,
    emailVerified: Boolean(row.email_verified),
  };
}
