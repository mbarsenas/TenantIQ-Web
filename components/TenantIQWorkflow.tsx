'use client';

import { useEffect, useMemo, useState } from 'react';

type AssessmentSummary = {
  assessment_id: string;
  source_name?: string | null;
  imported_at?: string | null;
  finding_count: number;
};

type Finding = {
  check_id?: string;
  workload?: string;
  category?: string;
  status?: string;
  severity?: string;
  title?: string;
  evidence?: unknown;
  recommendation?: unknown;
};

type FindingsPayload = {
  assessment_id: string;
  source_name?: string | null;
  imported_at?: string | null;
  findings: Finding[];
};

type WorkflowItem = Finding & {
  assessmentId: string;
  sourceName: string;
  importedAt?: string | null;
  workloadName: string;
};

function workloadFromName(name: string) {
  const value = name.toLowerCase();
  if (value.includes('exchange')) return 'Exchange Online';
  if (value.includes('entra')) return 'Entra ID';
  if (value.includes('sharepoint')) return 'SharePoint Online';
  if (value.includes('onedrive')) return 'OneDrive';
  if (value.includes('teams')) return 'Teams';
  if (value.includes('intune')) return 'Intune';
  if (value.includes('defender')) return 'Defender';
  if (value.includes('purview')) return 'Microsoft Purview';
  return 'TenantIQ';
}

function text(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

async function json(response: Response) {
  const body = await response.text();
  if (!body) return null;
  try { return JSON.parse(body); } catch { throw new Error('TenantIQ received an unexpected workflow response.'); }
}

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4, '': 5 };
const statusOrder: Record<string, number> = { FAIL: 0, WARNING: 1 };

export default function TenantIQWorkflow() {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workload, setWorkload] = useState('ALL');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const assessmentsResponse = await fetch('/api/assistant/assessments', { cache: 'no-store' });
        const assessmentsPayload = await json(assessmentsResponse);
        if (!assessmentsResponse.ok) throw new Error(assessmentsPayload?.detail || 'Unable to load assessments for workflow.');
        const assessments = (Array.isArray(assessmentsPayload) ? assessmentsPayload : []) as AssessmentSummary[];

        const latestByWorkload = new Map<string, AssessmentSummary>();
        for (const assessment of assessments) {
          const name = assessment.source_name || assessment.assessment_id;
          const workloadName = workloadFromName(name);
          const current = latestByWorkload.get(workloadName);
          const currentTime = current?.imported_at ? new Date(current.imported_at).getTime() : 0;
          const candidateTime = assessment.imported_at ? new Date(assessment.imported_at).getTime() : 0;
          if (!current || candidateTime >= currentTime) latestByWorkload.set(workloadName, assessment);
        }

        const payloads = await Promise.all([...latestByWorkload.values()].map(async (assessment) => {
          const response = await fetch(`/api/assistant/assessments/${encodeURIComponent(assessment.assessment_id)}/findings`, { cache: 'no-store' });
          const payload = await json(response);
          if (!response.ok) throw new Error(payload?.detail || `Unable to load findings for ${assessment.source_name || assessment.assessment_id}.`);
          return payload as FindingsPayload;
        }));

        const actionable: WorkflowItem[] = [];
        for (const payload of payloads) {
          const sourceName = payload.source_name || payload.assessment_id;
          const workloadName = workloadFromName(sourceName);
          for (const finding of payload.findings || []) {
            const status = String(finding.status || '').toUpperCase();
            if (status !== 'FAIL' && status !== 'WARNING') continue;
            actionable.push({ ...finding, assessmentId: payload.assessment_id, sourceName, importedAt: payload.imported_at, workloadName });
          }
        }

        actionable.sort((a, b) => {
          const sev = (severityOrder[String(a.severity || '').toLowerCase()] ?? 9) - (severityOrder[String(b.severity || '').toLowerCase()] ?? 9);
          if (sev !== 0) return sev;
          const stat = (statusOrder[String(a.status || '').toUpperCase()] ?? 9) - (statusOrder[String(b.status || '').toUpperCase()] ?? 9);
          if (stat !== 0) return stat;
          return String(a.check_id || '').localeCompare(String(b.check_id || ''));
        });
        if (!cancelled) setItems(actionable);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to build the TenantIQ remediation workflow.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const workloads = useMemo(() => ['ALL', ...Array.from(new Set(items.map((item) => item.workloadName))).sort()], [items]);
  const filtered = useMemo(() => workload === 'ALL' ? items : items.filter((item) => item.workloadName === workload), [items, workload]);
  const highPriority = items.filter((item) => ['critical', 'high'].includes(String(item.severity || '').toLowerCase())).length;
  const workloadCount = new Set(items.map((item) => item.workloadName)).size;

  if (loading) return <div style={panelStyle}>Building your remediation workflow from the latest stored assessments…</div>;
  if (error) return <div style={{ ...panelStyle, borderColor: 'rgba(255,90,90,.28)', color: '#ffaaaa' }}>{error}</div>;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 18 }}>
        <Metric label="Actionable findings" value={String(items.length)} />
        <Metric label="High / Critical" value={String(highPriority)} warning={highPriority > 0} />
        <Metric label="Workloads affected" value={String(workloadCount)} />
        <Metric label="Workflow model" value="4 steps" />
      </div>

      <section style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
          <Step number="1" title="Review evidence" text="Confirm exactly what TenantIQ observed." />
          <Step number="2" title="Remediate" text="Apply the assessment recommendation." />
          <Step number="3" title="Validate" text="Confirm the intended Microsoft 365 state." />
          <Step number="4" title="Re-assess" text="Re-run TenantIQ and verify the finding clears." />
        </div>
      </section>

      <div style={{ ...panelStyle, marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' }}>Remediation queue</div>
          <div style={{ color: '#aeb8c8', fontSize: 13, marginTop: 5 }}>FAIL and WARNING findings from the latest assessment for each workload, ordered by severity.</div>
        </div>
        <select value={workload} onChange={(e) => setWorkload(e.target.value)} style={selectStyle} aria-label="Filter workflow by workload">
          {workloads.map((name) => <option key={name} value={name}>{name === 'ALL' ? 'All workloads' : name}</option>)}
        </select>
      </div>

      {!filtered.length ? (
        <div style={panelStyle}>No FAIL or WARNING findings are present in the latest stored assessments for this view.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((item, index) => {
            const id = item.check_id || `finding-${index}`;
            const status = String(item.status || 'WARNING').toUpperCase();
            const evidence = text(item.evidence) || 'No detailed evidence was supplied for this finding.';
            const recommendation = text(item.recommendation) || 'Review the associated TenantIQ guidance before making a configuration change.';
            const assessmentHref = `/assessments/${encodeURIComponent(item.assessmentId)}#${encodeURIComponent(item.check_id || '')}`;
            const question = `Walk me through remediation and validation for ${item.check_id || item.title || 'this finding'} using the selected assessment evidence.`;
            const assistantHref = `/api/assistant/select-assessment?assessment=${encodeURIComponent(item.assessmentId)}&question=${encodeURIComponent(question)}`;
            return (
              <article key={`${item.assessmentId}-${id}-${index}`} style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 650px', minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ color: '#79baff', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.05em' }}>{item.workloadName}</span>
                      <StatusPill status={status} />
                      {item.severity ? <span style={{ color: '#a4b4c6', fontSize: 12 }}>{item.severity}</span> : null}
                      <span style={{ borderRadius: 999, padding: '4px 8px', background: 'rgba(47,135,255,.09)', color: '#8fc7ff', fontSize: 11, fontWeight: 850 }}>Step 1 · Review</span>
                    </div>
                    <h2 style={{ margin: '9px 0 4px', fontSize: 19 }}>{item.check_id || 'TenantIQ finding'} — {item.title || 'Finding'}</h2>
                    <div style={{ color: '#71869c', fontSize: 12, marginBottom: 12 }}>{item.category || 'Assessment control'}</div>
                    <Field label="Evidence" value={evidence} />
                    <Field label="Recommended remediation" value={recommendation} />
                    <div style={{ marginTop: 12, borderTop: '1px solid rgba(86,160,255,.12)', paddingTop: 12 }}>
                      <div style={{ color: '#7f93aa', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Validation path</div>
                      <div style={{ color: '#b8c5d3', fontSize: 13, lineHeight: 1.6 }}>Make the approved change, validate the Microsoft 365 configuration, then re-run the same TenantIQ workload assessment. The finding is resolved when the re-assessment no longer reports the actionable state.</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href={assessmentHref} style={secondaryLinkStyle}>View evidence</a>
                    <a href={assistantHref} style={primaryLinkStyle}>Work with Assistant →</a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function Step({ number, title, text: description }: { number: string; title: string; text: string }) {
  return <div style={{ border: '1px solid rgba(86,160,255,.14)', borderRadius: 12, padding: 14, background: 'rgba(6,17,31,.42)' }}><div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900 }}>STEP {number}</div><div style={{ color: '#eef5fd', fontSize: 15, fontWeight: 850, marginTop: 5 }}>{title}</div><div style={{ color: '#8fa2b8', fontSize: 12, lineHeight: 1.5, marginTop: 5 }}>{description}</div></div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <div style={{ marginTop: 9 }}><div style={{ color: '#7f93aa', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div><div style={{ color: '#c6d3e2', lineHeight: 1.55, fontSize: 14, whiteSpace: 'pre-wrap' }}>{value}</div></div>;
}

function StatusPill({ status }: { status: string }) {
  const fail = status === 'FAIL';
  return <span style={{ borderRadius: 999, padding: '4px 8px', background: fail ? 'rgba(255,90,90,.10)' : 'rgba(244,196,48,.09)', color: fail ? '#ff9b9b' : '#f4d35e', fontSize: 11, fontWeight: 900 }}>{status}</span>;
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div style={{ border: `1px solid ${warning ? 'rgba(244,196,48,.25)' : 'rgba(86,160,255,.17)'}`, borderRadius: 14, background: 'rgba(8,22,40,.66)', padding: 15 }}><div style={{ color: '#8192a6', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div><div style={{ color: warning ? '#f4d35e' : '#f3f7fc', fontSize: 25, fontWeight: 900, marginTop: 6 }}>{value}</div></div>;
}

const panelStyle = { border: '1px solid rgba(86,160,255,.18)', borderRadius: 16, background: 'rgba(8,22,40,.72)', padding: 18, color: '#dce7f4' };
const selectStyle = { border: '1px solid rgba(86,160,255,.22)', borderRadius: 10, background: '#081425', color: '#edf5ff', padding: '10px 12px', outline: 'none' };
const primaryLinkStyle = { display: 'inline-block', borderRadius: 10, padding: '10px 13px', background: '#2f87ff', color: '#fff', fontSize: 12, fontWeight: 850, textDecoration: 'none', whiteSpace: 'nowrap' as const };
const secondaryLinkStyle = { display: 'inline-block', borderRadius: 10, padding: '9px 12px', border: '1px solid rgba(86,160,255,.26)', color: '#8fc7ff', fontSize: 12, fontWeight: 850, textDecoration: 'none', whiteSpace: 'nowrap' as const };
