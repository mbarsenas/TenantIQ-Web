'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';

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

type WorkflowState = 'needs_review' | 'in_progress' | 'ready_to_validate' | 'resolved';

type WorkflowRecord = {
  state: WorkflowState;
  checkId: string;
  title: string;
  workloadName: string;
  updatedAt: string;
  resolvedAt?: string;
  assignedTo?: string;
  dueDate?: string;
  notes?: string;
};

type WorkflowRecords = Record<string, WorkflowRecord>;
type ResolvedItem = WorkflowRecord & { findingKey: string };

const LEGACY_STORAGE_KEY = 'tenantiq-workflow-state-v1';
const ALL_WORKLOADS = [
  'Entra ID',
  'Exchange Online',
  'SharePoint Online',
  'Teams',
  'OneDrive',
  'Intune',
  'Defender',
  'Microsoft Purview',
] as const;

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4, '': 5 };
const statusOrder: Record<string, number> = { FAIL: 0, WARNING: 1 };

function workloadFromName(name: string) {
  const value = name.toLowerCase();
  if (value.includes('exchange')) return 'Exchange Online';
  if (value.includes('entra') || value.includes('azuread') || value.includes('azure-ad')) return 'Entra ID';
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

function itemKey(item: WorkflowItem) {
  return `${item.workloadName}::${item.check_id || item.title || 'finding'}`;
}

function readLegacyRecords(): WorkflowRecords {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) as WorkflowRecords : {};
  } catch {
    return {};
  }
}

async function saveRecords(records: WorkflowRecords) {
  try { window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(records)); } catch { /* compatibility cache only */ }

  const response = await fetch('/api/workflow/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ records }),
  });
  const payload = await json(response);
  if (!response.ok) throw new Error(payload?.detail || 'Unable to save TenantIQ workflow state.');
}

async function readRecords(): Promise<WorkflowRecords> {
  const response = await fetch('/api/workflow/state', { cache: 'no-store' });
  const payload = await json(response);
  if (!response.ok) throw new Error(payload?.detail || 'Unable to load TenantIQ workflow state.');

  const serverRecords = payload?.records && typeof payload.records === 'object'
    ? payload.records as WorkflowRecords
    : {};

  if (Object.keys(serverRecords).length) return serverRecords;

  const legacy = readLegacyRecords();
  if (Object.keys(legacy).length) {
    await saveRecords(legacy);
    return legacy;
  }

  return {};
}

export default function TenantIQWorkflow() {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [records, setRecords] = useState<WorkflowRecords>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [workload, setWorkload] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [workflowState, setWorkflowState] = useState('ALL');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [assessedWorkloads, setAssessedWorkloads] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const assessmentsResponse = await fetch('/api/assistant/assessments', { cache: 'no-store' });
        const assessmentsPayload = await json(assessmentsResponse);
        if (!assessmentsResponse.ok) throw new Error(assessmentsPayload?.detail || 'Unable to load assessments for workflow.');

        const assessments = (Array.isArray(assessmentsPayload) ? assessmentsPayload : []) as AssessmentSummary[];
        const latest = new Map<string, AssessmentSummary>();

        for (const assessment of assessments) {
          const workloadName = workloadFromName(assessment.source_name || assessment.assessment_id);
          if (!ALL_WORKLOADS.includes(workloadName as typeof ALL_WORKLOADS[number])) continue;
          const current = latest.get(workloadName);
          const candidateTime = assessment.imported_at ? new Date(assessment.imported_at).getTime() : 0;
          const currentTime = current?.imported_at ? new Date(current.imported_at).getTime() : 0;
          if (!current || candidateTime >= currentTime) latest.set(workloadName, assessment);
        }

        if (!cancelled) setAssessedWorkloads(new Set(latest.keys()));

        const payloads = await Promise.all([...latest.values()].map(async (assessment) => {
          const response = await fetch(`/api/assistant/assessments/${encodeURIComponent(assessment.assessment_id)}/findings`, { cache: 'no-store' });
          const payload = await json(response);
          if (!response.ok) throw new Error(payload?.detail || 'Unable to load workflow findings.');
          return payload as FindingsPayload;
        }));

        const actionable: WorkflowItem[] = [];
        for (const payload of payloads) {
          const sourceName = payload.source_name || payload.assessment_id;
          const workloadName = workloadFromName(sourceName);

          for (const finding of payload.findings || []) {
            const status = String(finding.status || '').toUpperCase();
            if (status !== 'FAIL' && status !== 'WARNING') continue;
            actionable.push({
              ...finding,
              assessmentId: payload.assessment_id,
              sourceName,
              importedAt: payload.imported_at,
              workloadName,
            });
          }
        }

        actionable.sort((a, b) => {
          const severityDelta =
            (severityOrder[String(a.severity || '').toLowerCase()] ?? 9) -
            (severityOrder[String(b.severity || '').toLowerCase()] ?? 9);
          if (severityDelta) return severityDelta;

          const statusDelta =
            (statusOrder[String(a.status || '').toUpperCase()] ?? 9) -
            (statusOrder[String(b.status || '').toUpperCase()] ?? 9);
          return statusDelta || String(a.check_id || '').localeCompare(String(b.check_id || ''));
        });

        const currentRecords = await readRecords();
        const activeKeys = new Set(actionable.map(itemKey));
        const now = new Date().toISOString();
        let changed = false;

        for (const item of actionable) {
          const key = itemKey(item);
          if (!currentRecords[key]) {
            currentRecords[key] = {
              state: 'needs_review',
              checkId: item.check_id || 'Finding',
              title: item.title || 'TenantIQ finding',
              workloadName: item.workloadName,
              updatedAt: now,
            };
            changed = true;
          } else if (currentRecords[key].state === 'resolved') {
            currentRecords[key] = {
              ...currentRecords[key],
              state: 'needs_review',
              updatedAt: now,
              resolvedAt: undefined,
            };
            changed = true;
          }
        }

        for (const [key, record] of Object.entries(currentRecords)) {
          if (!activeKeys.has(key) && record.state === 'ready_to_validate') {
            currentRecords[key] = {
              ...record,
              state: 'resolved',
              updatedAt: now,
              resolvedAt: now,
            };
            changed = true;
          }
        }

        if (changed) await saveRecords(currentRecords);
        if (!cancelled) {
          setItems(actionable);
          setRecords(currentRecords);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to build the TenantIQ remediation workflow.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  async function persist(next: WorkflowRecords, previous: WorkflowRecords) {
    setRecords(next);
    setSaving(true);
    setError('');
    try {
      await saveRecords(next);
    } catch (err) {
      setRecords(previous);
      setError(err instanceof Error ? err.message : 'Unable to save TenantIQ workflow state.');
    } finally {
      setSaving(false);
    }
  }

  function baseRecord(item: WorkflowItem): WorkflowRecord {
    const key = itemKey(item);
    return records[key] || {
      state: 'needs_review',
      checkId: item.check_id || 'Finding',
      title: item.title || 'TenantIQ finding',
      workloadName: item.workloadName,
      updatedAt: new Date().toISOString(),
    };
  }

  async function setItemState(item: WorkflowItem, state: Exclude<WorkflowState, 'resolved'>) {
    const key = itemKey(item);
    const previous = records;
    const next = {
      ...records,
      [key]: {
        ...baseRecord(item),
        state,
        updatedAt: new Date().toISOString(),
        resolvedAt: undefined,
      },
    };
    await persist(next, previous);
  }

  async function updateMetadata(
    item: WorkflowItem,
    patch: Partial<Pick<WorkflowRecord, 'assignedTo' | 'dueDate' | 'notes'>>,
  ) {
    const key = itemKey(item);
    const previous = records;
    const next = {
      ...records,
      [key]: {
        ...baseRecord(item),
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    };
    await persist(next, previous);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const state = records[itemKey(item)]?.state || 'needs_review';
      if (workload !== 'ALL' && item.workloadName !== workload) return false;
      if (priority !== 'ALL' && String(item.severity || '').toLowerCase() !== priority.toLowerCase()) return false;
      if (workflowState !== 'ALL' && state !== workflowState) return false;
      if (!q) return true;

      const haystack = [
        item.check_id,
        item.title,
        item.category,
        item.workloadName,
        item.status,
        item.severity,
        text(item.evidence),
        text(item.recommendation),
        records[itemKey(item)]?.assignedTo,
        records[itemKey(item)]?.notes,
      ].join(' ').toLowerCase();

      return haystack.includes(q);
    });
  }, [items, workload, priority, workflowState, query, records]);

  const resolvedItems = useMemo<ResolvedItem[]>(() => {
    return Object.entries(records)
      .filter(([, record]) => record.state === 'resolved')
      .map(([findingKey, record]) => ({ ...record, findingKey }))
      .sort((a, b) => new Date(b.resolvedAt || b.updatedAt).getTime() - new Date(a.resolvedAt || a.updatedAt).getTime());
  }, [records]);

  const fails = items.filter((item) => String(item.status || '').toUpperCase() === 'FAIL').length;
  const warnings = items.length - fails;
  const high = items.filter((item) => ['critical', 'high'].includes(String(item.severity || '').toLowerCase())).length;
  const inProgress = items.filter((item) => records[itemKey(item)]?.state === 'in_progress').length;
  const ready = items.filter((item) => records[itemKey(item)]?.state === 'ready_to_validate').length;
  const coveragePercent = Math.round((assessedWorkloads.size / ALL_WORKLOADS.length) * 100);

  if (loading) return <div style={panelStyle}>Building your remediation workflow from the latest stored assessments…</div>;
  if (error && !items.length && !resolvedItems.length) {
    return <div style={{ ...panelStyle, borderColor: 'rgba(255,90,90,.28)', color: '#ffaaaa' }}>{error}</div>;
  }

  return (
    <>
      {error ? <div style={{ ...panelStyle, marginBottom: 14, borderColor: 'rgba(255,90,90,.28)', color: '#ffaaaa' }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 12, marginBottom: 18 }}>
        <Metric label="Actionable" value={String(items.length)} />
        <Metric label="Fail" value={String(fails)} tone="fail" />
        <Metric label="Warning" value={String(warnings)} tone="warning" />
        <Metric label="High / Critical" value={String(high)} tone={high ? 'warning' : 'normal'} />
        <Metric label="In progress" value={String(inProgress)} tone="blue" />
        <Metric label="Ready to validate" value={String(ready)} tone="blue" />
        <Metric label="Resolved" value={String(resolvedItems.length)} tone="green" />
      </div>

      <section style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={eyebrowStyle}>Workload coverage</div>
            <h2 style={{ margin: '8px 0 5px', fontSize: 23 }}>{assessedWorkloads.size}/8 workloads represented</h2>
            <p style={{ margin: 0, color: '#91a3b7', fontSize: 13 }}>{coveragePercent}% of the TenantIQ workload set has a stored assessment feeding this workflow.</p>
          </div>
          <a href="/assessments" style={secondaryLinkStyle}>Manage assessments</a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8, marginTop: 16 }}>
          {ALL_WORKLOADS.map((name) => {
            const assessed = assessedWorkloads.has(name);
            const actionableCount = items.filter((item) => item.workloadName === name).length;
            return (
              <div key={name} style={{ border: '1px solid rgba(86,160,255,.13)', borderRadius: 11, padding: 11, background: assessed ? 'rgba(47,135,255,.05)' : 'rgba(255,255,255,.018)' }}>
                <div style={{ color: assessed ? '#e7f1fc' : '#718398', fontSize: 12, fontWeight: 850 }}>{name}</div>
                <div style={{ marginTop: 4, color: assessed ? '#89a8c8' : '#5e7186', fontSize: 11 }}>
                  {assessed ? `${actionableCount} actionable finding${actionableCount === 1 ? '' : 's'}` : 'No stored assessment'}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={eyebrowStyle}>Remediation lifecycle</div>
          <div style={{ color: saving ? '#f4d35e' : '#86e1ad', fontSize: 11, fontWeight: 800 }}>{saving ? 'Saving workspace state…' : 'Workspace state synced'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
          <Step number="1" title="Needs review" text="Confirm exactly what TenantIQ observed." />
          <Step number="2" title="In progress" text="Apply the approved configuration change." />
          <Step number="3" title="Ready to validate" text="Re-run or otherwise validate the intended state." />
          <Step number="4" title="Resolved" text="TenantIQ confirms the finding cleared from the latest assessment." />
        </div>
      </section>

      <section style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={eyebrowStyle}>Remediation queue</div>
            <div style={{ color: '#aeb8c8', fontSize: 13, marginTop: 5 }}>{filtered.length} finding{filtered.length === 1 ? '' : 's'} shown · latest assessment per workload · highest risk first</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search findings, owner, notes…" style={{ ...selectStyle, minWidth: 230 }} />
            <select value={workflowState} onChange={(event) => setWorkflowState(event.target.value)} style={selectStyle}>
              <option value="ALL">All workflow states</option>
              <option value="needs_review">Needs review</option>
              <option value="in_progress">In progress</option>
              <option value="ready_to_validate">Ready to validate</option>
            </select>
            <select value={priority} onChange={(event) => setPriority(event.target.value)} style={selectStyle}>
              <option value="ALL">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={workload} onChange={(event) => setWorkload(event.target.value)} style={selectStyle}>
              <option value="ALL">All workloads</option>
              {ALL_WORKLOADS.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </div>
      </section>

      {!filtered.length ? (
        <div style={panelStyle}>No actionable findings match the current workflow filters.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((item, index) => {
            const key = itemKey(item);
            const id = `${item.assessmentId}-${item.check_id || index}`;
            const open = expanded === id;
            const status = String(item.status || 'WARNING').toUpperCase();
            const record = records[key] || baseRecord(item);
            const state = record.state;
            const evidence = text(item.evidence) || 'No detailed evidence was supplied for this finding.';
            const recommendation = text(item.recommendation) || 'Review the associated TenantIQ guidance before making a configuration change.';
            const assessmentHref = `/assessments/${encodeURIComponent(item.assessmentId)}#${encodeURIComponent(item.check_id || '')}`;
            const question = `Walk me through remediation and validation for ${item.check_id || item.title || 'this finding'} using the selected assessment evidence.`;
            const assistantHref = `/api/assistant/select-assessment?assessment=${encodeURIComponent(item.assessmentId)}&question=${encodeURIComponent(question)}`;

            return (
              <article key={id} style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
                <button type="button" onClick={() => setExpanded(open ? null : id)} style={rowButtonStyle}>
                  <div style={{ minWidth: 145 }}>
                    <div style={{ color: '#79baff', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.05em' }}>{item.workloadName}</div>
                    <div style={{ fontWeight: 900, marginTop: 4 }}>{item.check_id || 'Finding'}</div>
                  </div>
                  <div style={{ flex: '1 1 300px', textAlign: 'left' }}>
                    <div style={{ fontWeight: 800, color: '#edf5ff' }}>{item.title || 'TenantIQ finding'}</div>
                    <div style={{ fontSize: 11, color: '#758ba3', marginTop: 4 }}>
                      {item.category || 'Assessment control'}
                      {record.assignedTo ? ` · ${record.assignedTo}` : ''}
                      {record.dueDate ? ` · Due ${record.dueDate}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <WorkflowPill state={state} />
                    <StatusPill status={status} />
                    {item.severity ? <span style={{ fontSize: 12, color: '#a4b4c6' }}>{item.severity}</span> : null}
                    <span style={{ color: '#79baff', fontSize: 18 }}>{open ? '−' : '+'}</span>
                  </div>
                </button>

                {open ? (
                  <div style={{ padding: '0 18px 18px', borderTop: '1px solid rgba(86,160,255,.12)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, paddingTop: 16 }}>
                      <Field label="Observed evidence" value={evidence} />
                      <Field label="Recommended remediation" value={recommendation} />
                    </div>

                    <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'rgba(47,135,255,.045)', border: '1px solid rgba(86,160,255,.12)' }}>
                      <div style={smallSectionLabel}>Remediation management</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
                        <label style={labelStyle}>Assigned to
                          <input disabled={saving} value={record.assignedTo || ''} onChange={(event) => setRecords({ ...records, [key]: { ...record, assignedTo: event.target.value } })} onBlur={(event) => updateMetadata(item, { assignedTo: event.target.value.trim() || undefined })} placeholder="Owner or team" style={inputStyle} />
                        </label>
                        <label style={labelStyle}>Due date
                          <input disabled={saving} type="date" value={record.dueDate || ''} onChange={(event) => setRecords({ ...records, [key]: { ...record, dueDate: event.target.value } })} onBlur={(event) => updateMetadata(item, { dueDate: event.target.value || undefined })} style={inputStyle} />
                        </label>
                      </div>
                      <label style={{ ...labelStyle, marginTop: 12 }}>Notes
                        <textarea disabled={saving} value={record.notes || ''} onChange={(event) => setRecords({ ...records, [key]: { ...record, notes: event.target.value } })} onBlur={(event) => updateMetadata(item, { notes: event.target.value.trim() || undefined })} placeholder="Add remediation notes, dependencies, change details, or validation context…" rows={4} style={{ ...inputStyle, resize: 'vertical', width: '100%' }} />
                      </label>
                      <div style={{ color: '#74899f', fontSize: 11, marginTop: 8 }}>Owner, due date, and notes are stored in this licensed TenantIQ workspace.</div>
                    </div>

                    <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'rgba(47,135,255,.055)', border: '1px solid rgba(86,160,255,.12)' }}>
                      <div style={smallSectionLabel}>Workflow state</div>
                      <div style={{ fontSize: 13, color: '#b8c5d3', lineHeight: 1.6, marginTop: 5 }}>
                        Resolved is assessment-verified only. Mark a finding ready to validate, then re-run the relevant assessment. If the finding clears, TenantIQ records it as resolved automatically.
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                      <button disabled={saving} onClick={() => setItemState(item, 'needs_review')} style={stateButton(state === 'needs_review')}>Needs review</button>
                      <button disabled={saving} onClick={() => setItemState(item, 'in_progress')} style={stateButton(state === 'in_progress')}>Mark in progress</button>
                      <button disabled={saving} onClick={() => setItemState(item, 'ready_to_validate')} style={stateButton(state === 'ready_to_validate')}>Ready to validate</button>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                      <a href={assessmentHref} style={secondaryLinkStyle}>View assessment evidence</a>
                      <a href={assistantHref} style={primaryLinkStyle}>Start guided remediation →</a>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <section style={{ ...panelStyle, marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={eyebrowStyle}>Resolved history</div>
            <h2 style={{ margin: '8px 0 5px', fontSize: 22 }}>{resolvedItems.length} assessment-verified resolution{resolvedItems.length === 1 ? '' : 's'}</h2>
            <p style={{ margin: 0, color: '#8fa2b8', fontSize: 13 }}>Resolved items remain in the licensed workspace for audit and remediation history.</p>
          </div>
          <button type="button" onClick={() => setShowResolved((value) => !value)} style={secondaryButtonStyle}>{showResolved ? 'Hide resolved' : 'View resolved'}</button>
        </div>

        {showResolved ? (
          <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
            {resolvedItems.length ? resolvedItems.map((item) => (
              <div key={item.findingKey} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,.8fr) minmax(220px,1.4fr) minmax(150px,1fr) auto', gap: 14, alignItems: 'center', padding: '12px 0', borderTop: '1px solid rgba(86,160,255,.11)' }}>
                <div>
                  <div style={{ color: '#79baff', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>{item.workloadName}</div>
                  <div style={{ color: '#eef5fd', fontWeight: 850, marginTop: 3 }}>{item.checkId}</div>
                </div>
                <div style={{ color: '#c8d4e1', fontSize: 13 }}>{item.title}</div>
                <div style={{ color: '#8295aa', fontSize: 12 }}>{item.assignedTo || 'Unassigned'}</div>
                <div style={{ color: '#86e1ad', fontSize: 11, fontWeight: 850, whiteSpace: 'nowrap' }}>{item.resolvedAt ? `Resolved ${new Date(item.resolvedAt).toLocaleDateString()}` : 'Resolved'}</div>
              </div>
            )) : <div style={{ color: '#8193a8', marginTop: 14 }}>No findings have been assessment-verified as resolved yet.</div>}
          </div>
        ) : null}
      </section>
    </>
  );
}

function WorkflowPill({ state }: { state: WorkflowState }) {
  const labels: Record<WorkflowState, string> = { needs_review: 'NEEDS REVIEW', in_progress: 'IN PROGRESS', ready_to_validate: 'READY TO VALIDATE', resolved: 'RESOLVED' };
  const color = state === 'resolved' ? '#86e1ad' : state === 'ready_to_validate' ? '#8fc7ff' : state === 'in_progress' ? '#79baff' : '#a9b4c1';
  return <span style={{ borderRadius: 999, padding: '4px 8px', background: 'rgba(47,135,255,.08)', color, fontSize: 10, fontWeight: 900 }}>{labels[state]}</span>;
}

function Step({ number, title, text: description }: { number: string; title: string; text: string }) {
  return <div style={{ border: '1px solid rgba(86,160,255,.14)', borderRadius: 12, padding: 14, background: 'rgba(6,17,31,.42)' }}><div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900 }}>STEP {number}</div><div style={{ color: '#eef5fd', fontSize: 15, fontWeight: 850, marginTop: 5 }}>{title}</div><div style={{ color: '#8fa2b8', fontSize: 12, lineHeight: 1.5, marginTop: 5 }}>{description}</div></div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><div style={{ color: '#7f93aa', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>{label}</div><div style={{ color: '#c6d3e2', lineHeight: 1.6, fontSize: 13, whiteSpace: 'pre-wrap' }}>{value}</div></div>;
}

function StatusPill({ status }: { status: string }) {
  const fail = status === 'FAIL';
  return <span style={{ borderRadius: 999, padding: '4px 8px', background: fail ? 'rgba(255,90,90,.10)' : 'rgba(244,196,48,.09)', color: fail ? '#ff9b9b' : '#f4d35e', fontSize: 10, fontWeight: 900 }}>{status}</span>;
}

function Metric({ label, value, tone = 'normal' }: { label: string; value: string; tone?: string }) {
  const color = tone === 'fail' ? '#ff8f8f' : tone === 'warning' ? '#f4d35e' : tone === 'blue' ? '#8fc7ff' : tone === 'green' ? '#86e1ad' : '#f3f7fc';
  return <div style={{ border: '1px solid rgba(86,160,255,.17)', borderRadius: 14, background: 'rgba(8,22,40,.66)', padding: 15 }}><div style={{ color: '#8192a6', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div><div style={{ color, fontSize: 26, fontWeight: 900, marginTop: 6 }}>{value}</div></div>;
}

function stateButton(active: boolean): CSSProperties {
  return { border: active ? '1px solid rgba(86,160,255,.5)' : '1px solid rgba(86,160,255,.22)', borderRadius: 9, padding: '9px 12px', background: active ? 'rgba(47,135,255,.16)' : 'rgba(255,255,255,.02)', color: active ? '#cce6ff' : '#98abc0', fontWeight: 800, fontSize: 12, cursor: 'pointer' };
}

const panelStyle: CSSProperties = { border: '1px solid rgba(86,160,255,.18)', borderRadius: 16, background: 'rgba(8,22,40,.72)', padding: 18, color: '#dce7f4' };
const eyebrowStyle: CSSProperties = { color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' };
const smallSectionLabel: CSSProperties = { fontSize: 11, fontWeight: 900, color: '#7fbaff', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 };
const rowButtonStyle: CSSProperties = { width: '100%', border: 0, background: 'transparent', color: '#dce7f4', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', padding: 18, cursor: 'pointer', textAlign: 'left' };
const selectStyle: CSSProperties = { border: '1px solid rgba(86,160,255,.22)', borderRadius: 9, background: '#081425', color: '#eaf2fb', padding: '9px 10px', fontSize: 12 };
const labelStyle: CSSProperties = { display: 'grid', gap: 6, color: '#8fa4ba', fontSize: 11, fontWeight: 850 };
const inputStyle: CSSProperties = { border: '1px solid rgba(86,160,255,.20)', borderRadius: 9, background: '#081425', color: '#edf5ff', padding: '10px 11px', fontSize: 13, boxSizing: 'border-box' };
const primaryLinkStyle: CSSProperties = { display: 'inline-block', borderRadius: 9, padding: '10px 13px', background: '#2f87ff', color: '#fff', fontSize: 12, fontWeight: 850, textDecoration: 'none' };
const secondaryLinkStyle: CSSProperties = { display: 'inline-block', borderRadius: 9, padding: '9px 12px', border: '1px solid rgba(86,160,255,.24)', color: '#8fc7ff', fontSize: 12, fontWeight: 850, textDecoration: 'none' };
const secondaryButtonStyle: CSSProperties = { borderRadius: 9, padding: '9px 12px', border: '1px solid rgba(86,160,255,.24)', color: '#8fc7ff', fontSize: 12, fontWeight: 850, background: 'transparent', cursor: 'pointer' };
