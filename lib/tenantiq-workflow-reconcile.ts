import { requireTenantIQEntitlement } from './tenantiq-entitlement';
import { tenantIQWorkloadLabel } from './tenantiq-workloads';
import { getWorkflowRecords, replaceWorkflowRecords } from './tenantiq-workflow-store';

type AssessmentSummary = {
  assessment_id?: string;
  source_name?: string | null;
  imported_at?: string | null;
};

type Finding = {
  check_id?: string;
  title?: string;
  status?: string;
};

type FindingsPayload = AssessmentSummary & {
  findings?: Finding[];
};

function workspaceKey(subscriptionId?: string, licenseId?: string, email?: string | null) {
  return subscriptionId || licenseId || String(email || '').trim().toLowerCase();
}

function findingKey(workloadName: string, finding: Finding) {
  return `${workloadName}::${finding.check_id || finding.title || 'finding'}`;
}

export async function reconcileWorkflowAfterAssessment(input: {
  assessment: AssessmentSummary;
  findings: FindingsPayload;
}) {
  const assessmentId = String(input.assessment.assessment_id || input.findings.assessment_id || '').trim();
  const sourceName = String(input.assessment.source_name || input.findings.source_name || assessmentId).trim();
  if (!assessmentId || !sourceName) return { changed: 0, reopened: 0, resolved: 0 };

  const workloadName = tenantIQWorkloadLabel(sourceName, '');
  if (!workloadName) return { changed: 0, reopened: 0, resolved: 0 };

  const { session, entitlement } = await requireTenantIQEntitlement();
  if (!session?.user?.id || !entitlement.entitled) return { changed: 0, reopened: 0, resolved: 0 };

  const key = workspaceKey(entitlement.subscriptionId, entitlement.licenseId, session.user.email);
  if (!key) return { changed: 0, reopened: 0, resolved: 0 };

  const records = await getWorkflowRecords(key);
  const currentFindings = Array.isArray(input.findings.findings) ? input.findings.findings : [];
  const actionableKeys = new Set(
    currentFindings
      .filter((finding) => {
        const status = String(finding.status || '').toUpperCase();
        return status === 'FAIL' || status === 'WARNING';
      })
      .map((finding) => findingKey(workloadName, finding)),
  );

  const now = new Date().toISOString();
  const validatedAt = input.assessment.imported_at || input.findings.imported_at || now;
  let resolved = 0;
  let reopened = 0;

  for (const [recordKey, record] of Object.entries(records)) {
    if (record.workloadName !== workloadName) continue;
    const stillActionable = actionableKeys.has(recordKey);

    if (record.state === 'ready_to_validate' && !stillActionable) {
      records[recordKey] = {
        ...record,
        state: 'resolved',
        resolvedAt: now,
        updatedAt: now,
        validatedAssessmentId: assessmentId,
        validatedAssessmentName: sourceName,
        validatedAt,
      };
      resolved += 1;
      continue;
    }

    if (record.state === 'resolved' && stillActionable) {
      records[recordKey] = {
        ...record,
        state: 'needs_review',
        resolvedAt: undefined,
        updatedAt: now,
        validatedAssessmentId: undefined,
        validatedAssessmentName: undefined,
        validatedAt: undefined,
      };
      reopened += 1;
    }
  }

  if (resolved || reopened) await replaceWorkflowRecords(key, records);
  return { changed: resolved + reopened, reopened, resolved };
}
