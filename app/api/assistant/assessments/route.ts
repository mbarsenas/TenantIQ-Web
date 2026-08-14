import { NextRequest, NextResponse } from 'next/server';
import { getTenantIQRagApiBase } from '../../../../lib/tenantiq-rag';

const DEFAULT_CUSTOMER_ID = process.env.TENANTIQ_DEFAULT_CUSTOMER_ID?.trim() || 'local-dev';

function customerId(request: NextRequest): string {
  return request.headers.get('x-tenantiq-customer-id')?.trim() || DEFAULT_CUSTOMER_ID;
}

export async function GET(request: NextRequest) {
  let ragApiBase: string;

  try {
    ragApiBase = getTenantIQRagApiBase();
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'TenantIQ RAG API configuration is invalid.' },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(`${ragApiBase}/assessments`, {
      method: 'GET',
      headers: { 'X-TenantIQ-Customer-ID': customerId(request) },
      cache: 'no-store',
    });

    const text = await response.text();
    let payload: unknown;

    try {
      payload = text ? JSON.parse(text) : [];
    } catch {
      payload = { detail: text || 'TenantIQ RAG API returned an invalid assessment response.' };
    }

    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { detail: 'TenantIQ RAG API is unavailable. Confirm the backend API is running.' },
      { status: 503 },
    );
  }
}
