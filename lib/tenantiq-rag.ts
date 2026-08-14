const DEFAULT_LOCAL_RAG_API = 'http://127.0.0.1:8787';

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function getTenantIQRagApiBase(): string {
  const configured = process.env.TENANTIQ_RAG_API;

  if (configured) {
    return normalizeBaseUrl(configured);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'TENANTIQ_RAG_API must be configured in production. Set it to the hosted TenantIQ RAG API base URL.',
    );
  }

  return DEFAULT_LOCAL_RAG_API;
}
