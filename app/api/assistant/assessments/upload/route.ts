import { NextRequest, NextResponse } from 'next/server';
import { buildRagIdentityHeaders, getAuthenticatedCustomerId } from '../../../../../lib/tenantiq-auth';
import { getTenantIQRagApiBase } from '../../../../../lib/tenantiq-rag';
import { tenantIQWorkloadLabel } from '../../../../../lib/tenantiq-workloads';
import { reconcileWorkflowAfterAssessment } from '../../../../../lib/tenantiq-workflow-reconcile';

type AssessmentSummary = {
  assessment_id?: string;
  source_name?: string | null;
  imported_at?: string | null;
};

type FindingsPayload = AssessmentSummary & {
  findings?: Array<{ check_id?: string; title?: string; status?: string }>;
};

async function reconcileUploadedAssessment(
  ragApiBase: string,
  identityHeaders: Record<string, string>,
  originalFileName: string,
) {
  const workloadName = tenantIQWorkloadLabel(originalFileName, '');
  if (!workloadName) return;

  const assessmentsResponse = await fetch(`${ragApiBase}/assessments`, {
    method: 'GET',
    headers: identityHeaders,
    cache: 'no-store',
  });
  if (!assessmentsResponse.ok) return;

  const assessmentsPayload = await assessmentsResponse.json().catch(() => []);
  if (!Array.isArray(assessmentsPayload)) return;

  const candidates = (assessmentsPayload as AssessmentSummary[])
    .filter((assessment) => {
      const name = assessment.source_name || assessment.assessment_id || '';
      return tenantIQWorkloadLabel(name, '') === workloadName;
    })
    .sort((a, b) => {
      const aTime = a.imported_at ? new Date(a.imported_at).getTime() : 0;
      const bTime = b.imported_at ? new Date(b.imported_at).getTime() : 0;
      return bTime - aTime;
    });

  const latest = candidates[0];
  const assessmentId = String(latest?.assessment_id || '').trim();
  if (!assessmentId) return;

  const findingsResponse = await fetch(`${ragApiBase}/assessments/${encodeURIComponent(assessmentId)}/findings`, {
    method: 'GET',
    headers: identityHeaders,
    cache: 'no-store',
  });
  if (!findingsResponse.ok) return;

  const findings = await findingsResponse.json().catch(() => null) as FindingsPayload | null;
  if (!findings || typeof findings !== 'object') return;

  await reconcileWorkflowAfterAssessment({ assessment: latest, findings });
}

export async function POST(request: NextRequest) {
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
      headers: identityHeaders,
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

    if (response.ok) {
      try {
        await reconcileUploadedAssessment(ragApiBase, identityHeaders, file.name);
      } catch (error) {
        console.error('TenantIQ workflow reconciliation failed after assessment upload.', error);
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
