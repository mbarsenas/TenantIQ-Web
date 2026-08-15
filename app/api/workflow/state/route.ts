import { NextResponse } from 'next/server';
import { requireTenantIQEntitlement } from '../../../../lib/tenantiq-entitlement';
import { getWorkflowRecords, replaceWorkflowRecords, type WorkflowRecords } from '../../../../lib/tenantiq-workflow-store';

function workspaceKey(subscriptionId?: string, licenseId?: string, email?: string | null) {
  return subscriptionId || licenseId || String(email || '').trim().toLowerCase();
}

export async function GET() {
  const { session, entitlement } = await requireTenantIQEntitlement();
  if (!session?.user?.id) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 });
  if (!entitlement.entitled) return NextResponse.json({ detail: 'TenantIQ license required.' }, { status: 403 });

  const key = workspaceKey(entitlement.subscriptionId, entitlement.licenseId, session.user.email);
  if (!key) return NextResponse.json({ detail: 'TenantIQ workspace could not be resolved.' }, { status: 400 });

  const records = await getWorkflowRecords(key);
  return NextResponse.json({ records }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: Request) {
  const { session, entitlement } = await requireTenantIQEntitlement();
  if (!session?.user?.id) return NextResponse.json({ detail: 'Authentication required.' }, { status: 401 });
  if (!entitlement.entitled) return NextResponse.json({ detail: 'TenantIQ license required.' }, { status: 403 });

  const key = workspaceKey(entitlement.subscriptionId, entitlement.licenseId, session.user.email);
  if (!key) return NextResponse.json({ detail: 'TenantIQ workspace could not be resolved.' }, { status: 400 });

  let body: { records?: WorkflowRecords };
  try { body = await request.json(); } catch { return NextResponse.json({ detail: 'Invalid workflow state payload.' }, { status: 400 }); }
  const records = body?.records && typeof body.records === 'object' ? body.records : {};
  await replaceWorkflowRecords(key, records);
  return NextResponse.json({ ok: true });
}
