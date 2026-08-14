import { NextRequest, NextResponse } from 'next/server';
import { buildRagIdentityHeaders, getAuthenticatedCustomerId } from '../../../../../../lib/tenantiq-auth';
import { getTenantIQRagApiBase } from '../../../../../../lib/tenantiq-rag';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
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

  const { assessmentId } = await params;

  try {
    const response = await fetch(`${ragApiBase}/assessments/${encodeURIComponent(assessmentId)}/findings`, {
      method: 'GET',
      headers: identityHeaders,
      cache: 'no-store',
    });
    const text = await response.text();
    let payload: unknown;
    try { payload = text ? JSON.parse(text) : {}; }
    catch { payload = { detail: text || 'TenantIQ RAG API returned an invalid findings response.' }; }
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ detail: 'TenantIQ RAG API is unavailable.' }, { status: 503 });
  }
}
