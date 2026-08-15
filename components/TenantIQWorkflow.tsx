'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { TENANTIQ_WORKLOADS, tenantIQKnowledgeHref, tenantIQWorkloadLabel } from '../lib/tenantiq-workloads';

type AssessmentSummary = { assessment_id: string; source_name?: string | null; imported_at?: string | null; finding_count: number };
type Finding = { check_id?: string; workload?: string; category?: string; status?: string; severity?: string; title?: string; evidence?: unknown; recommendation?: unknown };
type FindingsPayload = { assessment_id: string; source_name?: string | null; imported_at?: string | null; findings: Finding[] };
type WorkflowItem = Finding & { assessmentId: string; sourceName: string; importedAt?: string | null; workloadName: string };
type WorkflowState = 'needs_review' | 'in_progress' | 'ready_to_validate' | 'resolved';
type WorkflowRecord = { state: WorkflowState; checkId: string; title: string; workloadName: string; updatedAt: string; resolvedAt?: string; assignedTo?: string; dueDate?: string; notes?: string };
type WorkflowRecords = Record<string, WorkflowRecord>;

const LEGACY_STORAGE_KEY = 'tenantiq-workflow-state-v1';
const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4, '': 5 };
const statusOrder: Record<string, number> = { FAIL: 0, WARNING: 1 };

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

function itemDomId(item: WorkflowItem, index: number) {
  return `${item.assessmentId}-${item.check_id || index}`;
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
  const serverRecords = payload?.records && typeof payload.records === 'object' ? payload.records as WorkflowRecords : {};
  if (Object.keys(serverRecords).length) return serverRecords;
  const legacy = readLegacyRecords();
  if (Object.keys(legacy).length) {
    await saveRecords(legacy);
    return legacy;
  }
  return {};
}

export default function TenantIQWorkflow({ initialFinding = '' }: { initialFinding?: string }) {
  const focusFinding = initialFinding.trim().toUpperCase();
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [records, setRecords] = useState<WorkflowRecords>({});
  const [assessedWorkloads, setAssessedWorkloads] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [workload, setWorkload] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [workflowState, setWorkflowState] = useState('ALL');
  const [query, setQuery] = useState(focusFinding);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [focusMatched, setFocusMatched] = useState<boolean | null>(focusFinding ? null : false);

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
          const name = assessment.source_name || assessment.assessment_id;
          const workloadName = tenantIQWorkloadLabel(name, '');
          if (!workloadName) continue;
          const current = latest.get(workloadName);
          const currentTime = current?.imported_at ? new Date(current.imported_at).getTime() : 0;
          const nextTime = assessment.imported_at ? new Date(assessment.imported_at).getTime() : 0;
          if (!current || nextTime >= currentTime) latest.set(workloadName, assessment);
        }
        if (!cancelled) setAssessedWorkloads(new Set(latest.keys()));

        const payloads = await Promise.all([...latest.entries()].map(async ([workloadName, assessment]) => {
          const response = await fetch(`/api/assistant/assessments/${encodeURIComponent(assessment.assessment_id)}/findings`, { cache: 'no-store' });
          const payload = await json(response);
          if (!response.ok) throw new Error(payload?.detail || `Unable to load ${workloadName} workflow findings.`);
          return { workloadName, payload: payload as FindingsPayload };
        }));

        const actionable: WorkflowItem[] = [];
        for (const { workloadName, payload } of payloads) {
          const sourceName = payload.source_name || payload.assessment_id;
          for (const finding of payload.findings || []) {
            const status = String(finding.status || '').toUpperCase();
            if (status === 'FAIL' || status === 'WARNING') {
              actionable.push({ ...finding, assessmentId: payload.assessment_id, sourceName, importedAt: payload.imported_at, workloadName });
            }
          }
        }

        actionable.sort((a, b) => {
          const severity = (severityOrder[String(a.severity || '').toLowerCase()] ?? 9) - (severityOrder[String(b.severity || '').toLowerCase()] ?? 9);
          if (severity) return severity;
          const status = (statusOrder[String(a.status || '').toUpperCase()] ?? 9) - (statusOrder[String(b.status || '').toUpperCase()] ?? 9);
          return status || String(a.check_id || '').localeCompare(String(b.check_id || ''));
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
            currentRecords[key] = { ...currentRecords[key], state: 'needs_review', updatedAt: now, resolvedAt: undefined };
            changed = true;
          }
        }

        for (const [key, record] of Object.entries(currentRecords)) {
          if (!activeKeys.has(key) && record.state === 'ready_to_validate') {
            currentRecords[key] = { ...record, state: 'resolved', updatedAt: now, resolvedAt: now };
            changed = true;
          }
        }

        if (changed) await saveRecords(currentRecords);
        if (!cancelled) {
          setItems(actionable);
          setRecords(currentRecords);
          if (focusFinding) {
            const index = actionable.findIndex((item) => String(item.check_id || '').toUpperCase() === focusFinding);
            setFocusMatched(index >= 0);
            if (index >= 0) {
              setWorkload('ALL');
              setPriority('ALL');
              setWorkflowState('ALL');
              setQuery(focusFinding);
              setExpanded(itemDomId(actionable[index], index));
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to build the TenantIQ remediation workflow.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [focusFinding]);

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

  function baseRecord(item: WorkflowItem) {
    return records[itemKey(item)] || {
      state: 'needs_review' as WorkflowState,
      checkId: item.check_id || 'Finding',
      title: item.title || 'TenantIQ finding',
      workloadName: item.workloadName,
      updatedAt: new Date().toISOString(),
    };
  }

  async function setItemState(item: WorkflowItem, state: Exclude<WorkflowState, 'resolved'>) {
    const key = itemKey(item);
    const previous = records;
    const next = { ...records, [key]: { ...baseRecord(item), state, updatedAt: new Date().toISOString(), resolvedAt: undefined } };
    await persist(next, previous);
  }

  async function updateMetadata(item: WorkflowItem, patch: Partial<Pick<WorkflowRecord, 'assignedTo' | 'dueDate' | 'notes'>>) {
    const key = itemKey(item);
    const previous = records;
    const next = { ...records, [key]: { ...baseRecord(item), ...patch, updatedAt: new Date().toISOString() } };
    await persist(next, previous);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const record = records[itemKey(item)] || baseRecord(item);
      if (workload !== 'ALL' && item.workloadName !== workload) return false;
      if (priority !== 'ALL' && String(item.severity || '').toLowerCase() !== priority.toLowerCase()) return false;
      if (workflowState !== 'ALL' && record.state !== workflowState) return false;
      if (!q) return true;
      return [item.check_id, item.title, item.category, item.workloadName, text(item.evidence), text(item.recommendation), record.assignedTo, record.notes]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [items, records, workload, priority, workflowState, query]);

  const fails = items.filter((item) => String(item.status || '').toUpperCase() === 'FAIL').length;
  const warnings = items.length - fails;
  const high = items.filter((item) => ['critical', 'high'].includes(String(item.severity || '').toLowerCase())).length;
  const inProgress = items.filter((item) => records[itemKey(item)]?.state === 'in_progress').length;
  const ready = items.filter((item) => records[itemKey(item)]?.state === 'ready_to_validate').length;
  const resolvedRecords = Object.entries(records)
    .filter(([, record]) => record.state === 'resolved')
    .sort((a, b) => new Date(b[1].resolvedAt || b[1].updatedAt).getTime() - new Date(a[1].resolvedAt || a[1].updatedAt).getTime());

  if (loading) return <div style={panelStyle}>Building your remediation workflow from the latest stored assessments…</div>;
  if (error && !items.length && !resolvedRecords.length) return <div style={{ ...panelStyle, borderColor: 'rgba(255,90,90,.28)', color: '#ffaaaa' }}>{error}</div>;

  return <>
    {error ? <div style={{ ...panelStyle, marginBottom: 14, borderColor: 'rgba(255,90,90,.28)', color: '#ffaaaa' }}>{error}</div> : null}

    {focusFinding ? <section style={{ ...panelStyle, marginBottom: 16, borderColor: focusMatched ? 'rgba(86,160,255,.34)' : 'rgba(244,196,48,.30)', background: focusMatched ? 'rgba(47,135,255,.075)' : 'rgba(244,196,48,.045)' }}>
      <div style={eyebrowStyle}>Focused remediation</div>
      <div style={{ marginTop: 7, color: '#edf5ff', fontWeight: 850 }}>{focusMatched ? `${focusFinding} is open in the remediation queue below.` : `${focusFinding} is not currently an actionable FAIL or WARNING in the latest stored assessments.`}</div>
      <div style={{ marginTop: 5, color: '#8fa4ba', fontSize: 12 }}>{focusMatched ? 'Review its evidence, guidance, ownership, notes, and validation state in one place.' : 'If the finding was remediated or is not present in the latest assessment, review assessment history or re-run TenantIQ.'}</div>
    </section> : null}

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 12, marginBottom: 18 }}>
      <Metric label="Actionable" value={String(items.length)} />
      <Metric label="Fail" value={String(fails)} tone="fail" />
      <Metric label="Warning" value={String(warnings)} tone="warning" />
      <Metric label="High / Critical" value={String(high)} tone={high ? 'warning' : 'normal'} />
      <Metric label="In progress" value={String(inProgress)} tone="blue" />
      <Metric label="Ready to validate" value={String(ready)} tone="blue" />
      <Metric label="Resolved" value={String(resolvedRecords.length)} tone="green" />
    </div>

    <section style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={eyebrowStyle}>Eight-workload coverage</div>
        <div style={{ color: saving ? '#f4d35e' : '#86e1ad', fontSize: 11, fontWeight: 800 }}>{saving ? 'Saving workspace state…' : 'Workspace state synced'}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 }}>
        {TENANTIQ_WORKLOADS.map(({ label }) => {
          const assessed = assessedWorkloads.has(label);
          const actionable = items.filter((item) => item.workloadName === label).length;
          return <div key={label} style={{ border: `1px solid ${assessed ? 'rgba(86,160,255,.18)' : 'rgba(255,255,255,.05)'}`, borderRadius: 10, padding: '10px 11px', background: assessed ? 'rgba(47,135,255,.055)' : 'rgba(255,255,255,.018)' }}>
            <div style={{ color: assessed ? '#dbeaff' : '#718398', fontSize: 13, fontWeight: 800 }}>{label}</div>
            <div style={{ color: assessed ? '#829bb7' : '#5f7185', fontSize: 11, marginTop: 4 }}>{assessed ? `${actionable} actionable finding${actionable === 1 ? '' : 's'}` : 'No stored assessment'}</div>
          </div>;
        })}
      </div>
    </section>

    <section style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={eyebrowStyle}>Remediation lifecycle</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginTop: 12 }}>
        <Step number="1" title="Needs review" text="Confirm exactly what TenantIQ observed." />
        <Step number="2" title="In progress" text="Apply the approved configuration change." />
        <Step number="3" title="Ready to validate" text="Re-run or validate the intended Microsoft 365 state." />
        <Step number="4" title="Resolved" text="TenantIQ confirms the finding cleared on re-assessment." />
      </div>
    </section>

    <section style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <div>
          <div style={eyebrowStyle}>Remediation queue</div>
          <div style={{ color: '#aeb8c8', fontSize: 13, marginTop: 5 }}>{filtered.length} finding{filtered.length === 1 ? '' : 's'} shown · latest assessment per workload · highest risk first</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search findings, evidence, owner, notes…" style={{ ...selectStyle, minWidth: 260 }} />
          <select value={workflowState} onChange={(event) => setWorkflowState(event.target.value)} style={selectStyle}><option value="ALL">All workflow states</option><option value="needs_review">Needs review</option><option value="in_progress">In progress</option><option value="ready_to_validate">Ready to validate</option></select>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} style={selectStyle}><option value="ALL">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
          <select value={workload} onChange={(event) => setWorkload(event.target.value)} style={selectStyle}><option value="ALL">All workloads</option>{TENANTIQ_WORKLOADS.map(({ label }) => <option key={label} value={label}>{label}</option>)}</select>
        </div>
      </div>
    </section>

    {!filtered.length ? <div style={panelStyle}>No actionable findings match the current workflow filters.</div> : <div style={{ display: 'grid', gap: 10 }}>
      {filtered.map((item, index) => {
        const key = itemKey(item);
        const id = itemDomId(item, index);
        const open = expanded === id;
        const status = String(item.status || 'WARNING').toUpperCase();
        const record = records[key] || baseRecord(item);
        const state = record.state;
        const assessmentHref = `/assessments/${encodeURIComponent(item.assessmentId)}#${encodeURIComponent(item.check_id || '')}`;
        const knowledgeBase = tenantIQKnowledgeHref(item.workloadName);
        const knowledgeHref = item.check_id ? `${knowledgeBase}/${encodeURIComponent(item.check_id.toLowerCase())}` : knowledgeBase;
        const question = `Walk me through remediation and validation for ${item.check_id || item.title || 'this finding'} using the selected assessment evidence.`;
        const assistantHref = `/api/assistant/select-assessment?assessment=${encodeURIComponent(item.assessmentId)}&question=${encodeURIComponent(question)}`;
        const focused = Boolean(focusFinding && String(item.check_id || '').toUpperCase() === focusFinding);

        return <article id={focused ? 'focused-remediation' : undefined} key={id} style={{ ...panelStyle, padding: 0, overflow: 'hidden', borderColor: focused ? 'rgba(86,160,255,.50)' : 'rgba(86,160,255,.18)', boxShadow: focused ? '0 0 0 1px rgba(47,135,255,.12), 0 20px 50px rgba(0,0,0,.18)' : undefined }}>
          <button type="button" onClick={() => setExpanded(open ? null : id)} style={rowButtonStyle}>
            <div style={{ minWidth: 145 }}><div style={{ color: '#79baff', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.05em' }}>{item.workloadName}</div><div style={{ fontWeight: 900, marginTop: 4 }}>{item.check_id || 'Finding'}</div></div>
            <div style={{ flex: '1 1 300px', textAlign: 'left' }}><div style={{ fontWeight: 800, color: '#edf5ff' }}>{item.title || 'TenantIQ finding'}</div><div style={{ fontSize: 11, color: '#758ba3', marginTop: 4 }}>{item.category || 'Assessment control'}{record.assignedTo ? ` · ${record.assignedTo}` : ''}{record.dueDate ? ` · Due ${record.dueDate}` : ''}</div></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><WorkflowPill state={state} /><StatusPill status={status} />{item.severity ? <span style={{ fontSize: 12, color: '#a4b4c6' }}>{item.severity}</span> : null}<span style={{ color: '#79baff', fontSize: 18 }}>{open ? '−' : '+'}</span></div>
          </button>

          {open ? <div style={{ padding: '0 18px 18px', borderTop: '1px solid rgba(86,160,255,.12)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, paddingTop: 16 }}>
              <Field label="Observed evidence" value={text(item.evidence) || 'No detailed evidence was supplied for this finding.'} />
              <Field label="Recommended remediation" value={text(item.recommendation) || 'Review the associated TenantIQ guidance before making a configuration change.'} />
            </div>

            <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'rgba(47,135,255,.045)', border: '1px solid rgba(86,160,255,.12)' }}>
              <div style={eyebrowStyle}>Remediation management</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, marginTop: 10 }}>
                <label style={labelStyle}>Assigned to<input disabled={saving} value={record.assignedTo || ''} onChange={(event) => setRecords({ ...records, [key]: { ...record, assignedTo: event.target.value } })} onBlur={(event) => updateMetadata(item, { assignedTo: event.target.value.trim() || undefined })} placeholder="Owner or team" style={inputStyle} /></label>
                <label style={labelStyle}>Due date<input disabled={saving} type="date" value={record.dueDate || ''} onChange={(event) => setRecords({ ...records, [key]: { ...record, dueDate: event.target.value } })} onBlur={(event) => updateMetadata(item, { dueDate: event.target.value || undefined })} style={inputStyle} /></label>
              </div>
              <label style={{ ...labelStyle, marginTop: 12 }}>Notes<textarea disabled={saving} value={record.notes || ''} onChange={(event) => setRecords({ ...records, [key]: { ...record, notes: event.target.value } })} onBlur={(event) => updateMetadata(item, { notes: event.target.value.trim() || undefined })} placeholder="Add remediation notes, dependencies, change details, or validation context…" rows={4} style={{ ...inputStyle, resize: 'vertical', width: '100%' }} /></label>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button disabled={saving} onClick={() => setItemState(item, 'needs_review')} style={stateButton(state === 'needs_review')}>Needs review</button>
              <button disabled={saving} onClick={() => setItemState(item, 'in_progress')} style={stateButton(state === 'in_progress')}>Mark in progress</button>
              <button disabled={saving} onClick={() => setItemState(item, 'ready_to_validate')} style={stateButton(state === 'ready_to_validate')}>Ready to validate</button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <a href={assessmentHref} style={secondaryLinkStyle}>View assessment evidence</a>
              <a href={knowledgeHref} style={secondaryLinkStyle}>Open Knowledge guidance</a>
              <a href={assistantHref} style={primaryLinkStyle}>Open AI Assistant →</a>
            </div>
          </div> : null}
        </article>;
      })}
    </div>}

    {resolvedRecords.length ? <section style={{ ...panelStyle, marginTop: 18 }}>
      <div style={eyebrowStyle}>Resolved history</div>
      <h2 style={{ margin: '7px 0 5px', fontSize: 22 }}>Assessment-verified remediation</h2>
      <p style={{ color: '#8fa2b8', fontSize: 13, lineHeight: 1.55, margin: '0 0 12px' }}>Findings appear here only after they were marked ready to validate and no longer appear as FAIL or WARNING in the latest assessment.</p>
      <div style={{ display: 'grid' }}>
        {resolvedRecords.slice(0, 50).map(([key, record], index) => <div key={key} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,.8fr) minmax(220px,1.5fr) auto', gap: 12, alignItems: 'center', padding: '11px 0', borderTop: index ? '1px solid rgba(86,160,255,.10)' : 'none' }}>
          <div><div style={{ color: '#86e1ad', fontSize: 10, fontWeight: 900 }}>{record.workloadName}</div><div style={{ color: '#dce7f4', fontWeight: 850, marginTop: 3 }}>{record.checkId}</div></div>
          <div style={{ color: '#aebdcc', fontSize: 13 }}>{record.title}</div>
          <div style={{ textAlign: 'right', color: '#7790aa', fontSize: 11 }}>{record.resolvedAt ? `Resolved ${new Date(record.resolvedAt).toLocaleDateString()}` : 'Resolved'}</div>
        </div>)}
      </div>
    </section> : null}
  </>;
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
  const color = tone === 'fail' ? '#ff8f8f' : tone === 'warning' ? '#f4d35e' : tone === 'green' ? '#86e1ad' : tone === 'blue' ? '#8fc7ff' : '#eef5fd';
  return <div style={{ border: '1px solid rgba(86,160,255,.17)', borderRadius: 14, background: 'rgba(8,22,40,.66)', padding: 15 }}><div style={{ color: '#8192a6', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div><div style={{ color, fontSize: 24, fontWeight: 900, marginTop: 5 }}>{value}</div></div>;
}

function stateButton(active: boolean): CSSProperties {
  return { border: `1px solid ${active ? 'rgba(86,160,255,.48)' : 'rgba(86,160,255,.20)'}`, borderRadius: 9, padding: '9px 12px', background: active ? 'rgba(47,135,255,.15)' : 'rgba(5,16,29,.4)', color: active ? '#a8d2ff' : '#92a5b9', fontWeight: 800, cursor: 'pointer' };
}

const panelStyle: CSSProperties = { border: '1px solid rgba(86,160,255,.18)', borderRadius: 16, background: 'rgba(8,22,40,.72)', padding: 18, color: '#dce7f4' };
const eyebrowStyle: CSSProperties = { color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' };
const selectStyle: CSSProperties = { border: '1px solid rgba(86,160,255,.20)', borderRadius: 9, background: '#081425', color: '#e6eef7', padding: '9px 10px', outline: 'none' };
const rowButtonStyle: CSSProperties = { width: '100%', border: 0, background: 'transparent', color: '#dce7f4', padding: 18, display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer', textAlign: 'left' };
const labelStyle: CSSProperties = { display: 'grid', gap: 6, color: '#b5c4d4', fontSize: 12, fontWeight: 800 };
const inputStyle: CSSProperties = { boxSizing: 'border-box', border: '1px solid rgba(86,160,255,.20)', borderRadius: 9, background: '#071220', color: '#e9f2fb', padding: '10px 11px', font: 'inherit', outline: 'none' };
const primaryLinkStyle: CSSProperties = { display: 'inline-block', borderRadius: 9, padding: '9px 12px', background: '#2f87ff', color: '#fff', fontSize: 12, fontWeight: 850, textDecoration: 'none' };
const secondaryLinkStyle: CSSProperties = { display: 'inline-block', borderRadius: 9, padding: '8px 11px', border: '1px solid rgba(86,160,255,.24)', color: '#9dcbff', fontSize: 12, fontWeight: 850, textDecoration: 'none' };
