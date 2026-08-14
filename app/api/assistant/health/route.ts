import { NextResponse } from 'next/server';
import { getTenantIQRagApiBase } from '../../../../lib/tenantiq-rag';

export async function GET() {
  const started = Date.now();

  let ragApiBase: string;
  try {
    ragApiBase = getTenantIQRagApiBase();
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unavailable',
        proxy: 'ok',
        backend: 'not_configured',
        latency_ms: Date.now() - started,
        detail:
          error instanceof Error
            ? error.message
            : 'TenantIQ RAG backend configuration is invalid.',
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${ragApiBase}/health`, {
      method: 'GET',
      cache: 'no-store',
    });

    const text = await response.text();
    let upstream: unknown;

    try {
      upstream = text ? JSON.parse(text) : {};
    } catch {
      upstream = { raw: text };
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          status: 'degraded',
          proxy: 'ok',
          backend: 'error',
          backend_status: response.status,
          latency_ms: Date.now() - started,
          upstream,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      status: 'ok',
      proxy: 'ok',
      backend: 'ok',
      latency_ms: Date.now() - started,
      upstream,
    });
  } catch {
    return NextResponse.json(
      {
        status: 'unavailable',
        proxy: 'ok',
        backend: 'unreachable',
        latency_ms: Date.now() - started,
      },
      { status: 503 },
    );
  }
}
