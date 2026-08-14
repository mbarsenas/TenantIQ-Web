import { NextResponse } from 'next/server';

const RAG_API_BASE = process.env.TENANTIQ_RAG_API || 'http://127.0.0.1:8787';

export async function GET() {
  const started = Date.now();

  try {
    const response = await fetch(`${RAG_API_BASE}/health`, {
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
