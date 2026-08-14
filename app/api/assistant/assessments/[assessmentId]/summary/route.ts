import { NextResponse } from 'next/server';
import { buildRagIdentityHeaders, getAuthenticatedCustomerId } from '../../../../../../lib/tenantiq-auth';
import { getTenantIQRagApiBase } from '../../../../../../lib/tenantiq-rag';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  try {
    const { assessmentId } = await params;
    const ragApiBase = getTenantIQRagApiBase();
    const identityHeaders = buildRagIdentityHeaders(await getAuthenticatedCustomerId());
    const response = await fetch(`${ragApiBase}/assessments/${encodeURIComponent(assessmentId)}/summary`, {
      method: 'GET',
      headers: identityHeaders,
      cache: 'no-store',
    });

    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { detail: text || 'TenantIQ RAG API returned an invalid posture response.' };
    }
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'TenantIQ could not load assessment posture.' },
      { status: 503 },
    );
  }
}
