import { NextResponse } from 'next/server';
import { buildRagIdentityHeaders, getAuthenticatedCustomerId } from '../../../../../lib/tenantiq-auth';
import { getTenantIQRagApiBase } from '../../../../../lib/tenantiq-rag';

export async function GET() {
  let ragApiBase: string;
  let identityHeaders: Record<string, string>;

  try {
    ragApiBase = getTenantIQRagApiBase();
    identityHeaders = buildRagIdentityHeaders(await getAuthenticatedCustomerId());
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'TenantIQ authentication or backend configuration is invalid.' },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(`${ragApiBase}/assessments/latest`, {
      method: 'GET',
      headers: identityHeaders,
      cache: 'no-store',
    });

    const text = await response.text();
    let payload: unknown;

    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { detail: text || 'TenantIQ RAG API returned an invalid latest-assessment response.' };
    }

    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { detail: 'TenantIQ RAG API is unavailable. Confirm the backend API is running.' },
      { status: 503 },
    );
  }
}
