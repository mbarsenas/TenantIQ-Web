import { NextResponse } from 'next/server';
import { getTenantIQRagApiBase } from '../../../../lib/tenantiq-rag';

export async function GET() {
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
