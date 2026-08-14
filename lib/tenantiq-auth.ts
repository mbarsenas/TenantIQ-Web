import crypto from 'node:crypto';
import { auth } from '../auth';
import { getTenantIQEntitlement } from './tenantiq-entitlement';

const DEV_CUSTOMER_ID = process.env.TENANTIQ_DEV_CUSTOMER_ID || 'local-dev';

function normalizeCustomerId(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized.replace(/[^a-z0-9._@:+-]+/g, '-').replace(/^-+|-+$/g, '') || DEV_CUSTOMER_ID;
}

export async function getAuthenticatedCustomerId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id?.trim();
  const tenantId = session?.user?.tenantId?.trim();

  if (userId) {
    const entitlement = await getTenantIQEntitlement(session.user.email);
    if (!entitlement.entitled) {
      throw new Error('An active TenantIQ license is required to access assessments and the Knowledge Assistant.');
    }
    return normalizeCustomerId(tenantId ? `${tenantId}:${userId}` : userId);
  }

  if (process.env.NODE_ENV !== 'production') {
    return normalizeCustomerId(DEV_CUSTOMER_ID);
  }

  throw new Error('TenantIQ authentication is required. Sign in before accessing customer assessment data.');
}

export function buildRagIdentityHeaders(customerId: string): Record<string, string> {
  const secret = process.env.TENANTIQ_INTERNAL_API_SECRET?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TENANTIQ_INTERNAL_API_SECRET is required in production.');
    }

    return {
      'X-TenantIQ-Customer-ID': customerId,
    };
  }

  const signature = crypto.createHmac('sha256', secret).update(customerId).digest('hex');
  return {
    'X-TenantIQ-Customer-ID': customerId,
    'X-TenantIQ-Identity-Signature': signature,
  };
}
