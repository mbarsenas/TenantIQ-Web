import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

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

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

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
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await authPool.query(`ALTER TABLE tenantiq_users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0`);
  await authPool.query(`ALTER TABLE tenantiq_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ`);
  await authPool.query(`ALTER TABLE tenantiq_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`);

  await authPool.query(`
    CREATE TABLE IF NOT EXISTS tenantiq_auth_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES tenantiq_users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      token_type TEXT NOT NULL CHECK (token_type IN ('verify-email', 'reset-password')),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await authPool.query(
    `CREATE INDEX IF NOT EXISTS tenantiq_auth_tokens_user_idx ON tenantiq_auth_tokens (user_id, token_type, created_at DESC)`,
  );
}

export async function findUserByEmail(email: string) {
  await ensureUserSchema();
  const normalized = email.trim().toLowerCase();
  const { rows } = await authPool.query(
    `SELECT id, email, name, password_hash, email_verified, failed_login_attempts, locked_until
     FROM tenantiq_users WHERE email = $1 LIMIT 1`,
    [normalized],
  );
  return rows[0] || null;
}

async function recordFailedLogin(userId: string, currentAttempts: number) {
  const nextAttempts = currentAttempts + 1;
  if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
    await authPool.query(
      `UPDATE tenantiq_users
       SET failed_login_attempts = 0,
           locked_until = NOW() + ($2 || ' minutes')::interval,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, String(LOCKOUT_MINUTES)],
    );
  } else {
    await authPool.query(
      `UPDATE tenantiq_users
       SET failed_login_attempts = $2, updated_at = NOW()
       WHERE id = $1`,
      [userId, nextAttempts],
    );
  }
}

export async function verifyUserPassword(email: string, password: string): Promise<TenantIQUser | null> {
  const row = await findUserByEmail(email);
  if (!row) {
    await bcrypt.compare(password || 'invalid', '$2b$12$5t79qY8CmjGKCfJ8J5G2su7MEGJc1RK7piKUYvZfgbaKMC0YiQMS6').catch(() => false);
    return null;
  }

  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    return null;
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    await recordFailedLogin(String(row.id), Number(row.failed_login_attempts || 0));
    return null;
  }

  await authPool.query(
    `UPDATE tenantiq_users
     SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [row.id],
  );

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

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createAuthToken(userId: string, tokenType: 'verify-email' | 'reset-password', ttlMinutes: number) {
  await ensureUserSchema();
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  await authPool.query(
    `INSERT INTO tenantiq_auth_tokens (user_id, token_hash, token_type, expires_at)
     VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval)`,
    [userId, tokenHash, tokenType, String(ttlMinutes)],
  );
  return rawToken;
}

export async function consumeEmailVerificationToken(token: string) {
  await ensureUserSchema();
  const tokenHash = hashToken(token);
  const client = await authPool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, user_id FROM tenantiq_auth_tokens
       WHERE token_hash = $1 AND token_type = 'verify-email' AND used_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query(`UPDATE tenantiq_users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1`, [row.user_id]);
    await client.query(`UPDATE tenantiq_auth_tokens SET used_at = NOW() WHERE id = $1`, [row.id]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  await ensureUserSchema();
  if (newPassword.length < 12) return false;
  const tokenHash = hashToken(token);
  const client = await authPool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, user_id FROM tenantiq_auth_tokens
       WHERE token_hash = $1 AND token_type = 'reset-password' AND used_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return false;
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await client.query(
      `UPDATE tenantiq_users
       SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, row.user_id],
    );
    await client.query(`UPDATE tenantiq_auth_tokens SET used_at = NOW() WHERE user_id = $1 AND token_type = 'reset-password' AND used_at IS NULL`, [row.user_id]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
