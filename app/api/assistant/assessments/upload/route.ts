import { NextRequest, NextResponse } from 'next/server';
import { getTenantIQRagApiBase } from '../../../../../lib/tenantiq-rag';

export async function POST(request: NextRequest) {
  let ragApiBase: string;
  try {
    ragApiBase = getTenantIQRagApiBase();
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'TenantIQ RAG API configuration is invalid.' },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ detail: 'Invalid assessment upload.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ detail: 'Select a TenantIQ assessment file to upload.' }, { status: 400 });
  }

  try {
    const upstreamForm = new FormData();
    upstreamForm.append('file', file, file.name);

    const response = await fetch(`${ragApiBase}/assessments/upload`, {
      method: 'POST',
      body: upstreamForm,
      cache: 'no-store',
    });

    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { detail: text || 'TenantIQ RAG API returned an invalid upload response.' };
    }

    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { detail: 'TenantIQ RAG API is unavailable. Confirm the backend API is running.' },
      { status: 503 },
    );
  }
}
