import { NextRequest } from 'next/server';
import crypto from 'node:crypto';

const DEV_CUSTOMER_ID = process.env.TENANTIQ_DEV_CUSTOMER_ID || 'local-dev';
const AUTH_HEADER = 'x-tenantiq-authenticated-user';

function normalizeCustomerId(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized.replace(/[^a-z0-9._@+-]+/g, '-').replace(/^-+|-+$/g, '') || DEV_CUSTOMER_ID;
}

export function getAuthenticatedCustomerId(request: NextRequest): string {
  const trustedUser = request.headers.get(AUTH_HEADER)?.trim();

  if (trustedUser) {
    return normalizeCustomerId(trustedUser);
  }

  if (process.env.NODE_ENV !== 'production') {
    return normalizeCustomerId(DEV_CUSTOMER_ID);
  }

  throw new Error('TenantIQ authentication is required. No trusted authenticated user identity was supplied by the server authentication layer.');
}

export function buildRagIdentityHeaders(customerId: string): Record<string, string> {
  const secret = process.env.TENANTIQ_INTERNAL_API_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TENANTIQ_INTERNAL_API_SECRET is required in production.');
    }
    return { 'X-TenantIQ-Customer-ID': customerId };
  }

  const signature = crypto.createHmac('sha256', secret).update(customerId).digest('hex');
  return {
    'X-TenantIQ-Customer-ID': customerId,
    'X-TenantIQ-Identity-Signature': signature,
  };
}
