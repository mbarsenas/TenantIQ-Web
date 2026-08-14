import { NextRequest, NextResponse } from 'next/server';
import { getTenantIQRagApiBase } from '../../../lib/tenantiq-rag';

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON request body.' }, { status: 400 });
  }

  let ragApiBase: string;
  try {
    ragApiBase = getTenantIQRagApiBase();
  } catch (error) {
    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : 'TenantIQ RAG backend configuration is invalid.',
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${ragApiBase}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const text = await response.text();
    let payload: unknown;

    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { detail: text || 'TenantIQ RAG API returned an invalid response.' };
    }

    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { detail: 'TenantIQ RAG API is unavailable. Confirm the backend API is running.' },
      { status: 503 },
    );
  }
}
