import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildRagIdentityHeaders, getAuthenticatedCustomerId } from '../../../../lib/tenantiq-auth';
import { getTenantIQRagApiBase } from '../../../../lib/tenantiq-rag';

const COOKIE_NAME = 'tenantiq_selected_assessment';

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
    const response = await fetch(`${ragApiBase}/assessments`, {
      method: 'GET',
      headers: identityHeaders,
      cache: 'no-store',
    });

    const text = await response.text();
    let payload: unknown;

    try {
      payload = text ? JSON.parse(text) : [];
    } catch {
      payload = { detail: text || 'TenantIQ RAG API returned an invalid assessment response.' };
    }

    if (response.ok && Array.isArray(payload)) {
      const cookieStore = await cookies();
      const selected = cookieStore.get(COOKIE_NAME)?.value;
      if (selected) {
        payload = [...payload].sort((a: any, b: any) => {
          if (a?.assessment_id === selected) return -1;
          if (b?.assessment_id === selected) return 1;
          return 0;
        });
      }
    }

    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { detail: 'TenantIQ RAG API is unavailable. Confirm the backend API is running.' },
      { status: 503 },
    );
  }
}
