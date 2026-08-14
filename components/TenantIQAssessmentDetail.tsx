'use client';

import { useEffect, useMemo, useState } from 'react';

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
  finding_count: number;
  status_counts?: Record<string, number>;
  severity_counts?: Record<string, number>;
  findings: Finding[];
};

const statuses = ['ALL', 'FAIL', 'WARNING', 'PASS', 'INFO'];
const severities = ['ALL', 'Critical', 'High', 'Medium', 'Low', 'None'];

function text(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

async function readPayload(response: Response) {
  const body = await response.text();
  if (!body) return null;
  try { return JSON.parse(body); } catch { throw new Error('TenantIQ received an unexpected findings response.'); }
}

export default function TenantIQAssessmentDetail({ assessmentId }: { assessmentId: string }) {
  const [payload, setPayload] = useState<FindingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('ALL');
  const [severity, setSeverity] = useState('ALL');
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch(`/api/assistant/assessments/${encodeURIComponent(assessmentId)}/findings`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await readPayload(response);
        if (!response.ok) throw new Error(result?.detail || 'Unable to load TenantIQ findings.');
        setPayload(result as FindingsPayload);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load TenantIQ findings.'))
      .finally(() => setLoading(false));
  }, [assessmentId]);

  const filtered = useMemo(() => {
    const items = payload?.findings || [];
    const q = query.trim().toLowerCase();
    return items.filter((finding) => {
      const findingStatus = String(finding.status || '').toUpperCase();
      const findingSeverity = String(finding.severity || '').toLowerCase();
      if (status !== 'ALL' && findingStatus !== status) return false;
      if (severity !== 'ALL' && findingSeverity !== severity.toLowerCase()) return false;
      if (!q) return true;
      const haystack = [finding.check_id, finding.title, finding.category, finding.workload, text(finding.evidence), text(finding.recommendation)].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [payload, status, severity, query]);

  if (loading) return <div style={panelStyle}>Loading assessment findings…</div>;
  if (error) return <div style={{ ...panelStyle, borderColor: 'rgba(255,90,90,.28)', color: '#ffaaaa' }}>{error}</div>;
  if (!payload) return null;

  const counts = payload.status_counts || {};
  const askAssessment = `/assistant?assessment=${encodeURIComponent(assessmentId)}`;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 18 }}>
        <Metric label="Findings" value={String(payload.finding_count)} />
        <Metric label="FAIL" value={String(counts.FAIL || 0)} alert={Number(counts.FAIL || 0) > 0} />
        <Metric label="WARNING" value={String(counts.WARNING || 0)} warning={Number(counts.WARNING || 0) > 0} />
        <Metric label="PASS" value={String(counts.PASS || 0)} />
        <Metric label="INFO" value={String(counts.INFO || 0)} />
      </div>

      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search check ID, title, evidence, recommendation…" style={{ ...inputStyle, flex: '1 1 300px' }} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle} aria-label="Filter by status">
            {statuses.map((item) => <option key={item} value={item}>{item === 'ALL' ? 'All statuses' : item}</option>)}
          </select>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={inputStyle} aria-label="Filter by severity">
            {severities.map((item) => <option key={item} value={item}>{item === 'ALL' ? 'All severities' : item}</option>)}
          </select>
          <a href={askAssessment} style={primaryLinkStyle}>Ask about assessment</a>
        </div>
        <div style={{ color: '#8192a6', fontSize: 12, marginTop: 10 }}>{filtered.length} of {payload.finding_count} findings shown</div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map((finding, index) => {
          const id = finding.check_id || `finding-${index}`;
          const evidence = text(finding.evidence);
          const recommendation = text(finding.recommendation);
          const question = `Explain ${finding.check_id || finding.title || 'this finding'}, why it matters, and what needs to be fixed.`;
          const askHref = `/assistant?assessment=${encodeURIComponent(assessmentId)}&question=${encodeURIComponent(question)}`;
          return (
            <article key={`${id}-${index}`} id={finding.check_id || undefined} style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: '1 1 560px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#f2f7fd', fontSize: 15 }}>{finding.check_id || 'TenantIQ finding'}</strong>
                    <StatusPill status={finding.status || 'INFO'} />
                    {finding.severity ? <span style={{ color: '#9bb0c7', fontSize: 12 }}>{finding.severity}</span> : null}
                    {finding.category ? <span style={{ color: '#72859a', fontSize: 12 }}>{finding.category}</span> : null}
                  </div>
                  <h2 style={{ margin: '8px 0 12px', fontSize: 19 }}>{finding.title || finding.check_id || 'Finding'}</h2>
                  <Field label="Evidence" value={evidence || 'No detailed evidence was supplied for this finding.'} />
                  <Field label="Recommendation" value={recommendation || 'No recommendation was supplied for this finding.'} />
                </div>
                <a href={askHref} style={secondaryLinkStyle}>Ask TenantIQ about this finding →</a>
              </div>
            </article>
          );
        })}
        {!filtered.length ? <div style={panelStyle}>No findings match the selected filters.</div> : null}
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div style={{ marginTop: 10 }}><div style={{ color: '#7f93aa', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div><div style={{ color: '#c6d3e2', lineHeight: 1.55, fontSize: 14, whiteSpace: 'pre-wrap' }}>{value}</div></div>;
}

function StatusPill({ status }: { status: string }) {
  const upper = status.toUpperCase();
  const color = upper === 'FAIL' ? '#ff9b9b' : upper === 'WARNING' ? '#f4d35e' : upper === 'PASS' ? '#86e1ad' : '#9bb0c7';
  const bg = upper === 'FAIL' ? 'rgba(255,90,90,.10)' : upper === 'WARNING' ? 'rgba(244,196,48,.09)' : upper === 'PASS' ? 'rgba(52,211,153,.08)' : 'rgba(255,255,255,.04)';
  return <span style={{ borderRadius: 999, padding: '4px 8px', background: bg, color, fontSize: 11, fontWeight: 900 }}>{upper}</span>;
}

function Metric({ label, value, alert = false, warning = false }: { label: string; value: string; alert?: boolean; warning?: boolean }) {
  const emphasis = alert || warning;
  return <div style={{ border: `1px solid ${alert ? 'rgba(255,90,90,.25)' : warning ? 'rgba(244,196,48,.25)' : 'rgba(86,160,255,.17)'}`, borderRadius: 14, background: emphasis ? 'rgba(255,255,255,.025)' : 'rgba(8,22,40,.66)', padding: 15 }}><div style={{ color: '#8192a6', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div><div style={{ color: alert ? '#ff9b9b' : warning ? '#f4d35e' : '#f3f7fc', fontSize: 26, fontWeight: 900, marginTop: 6 }}>{value}</div></div>;
}

const panelStyle = { border: '1px solid rgba(86,160,255,.18)', borderRadius: 16, background: 'rgba(8,22,40,.72)', padding: 18, color: '#dce7f4' };
const inputStyle = { border: '1px solid rgba(86,160,255,.22)', borderRadius: 10, background: '#081425', color: '#edf5ff', padding: '10px 12px', outline: 'none' };
const primaryLinkStyle = { display: 'inline-block', borderRadius: 10, padding: '10px 14px', background: '#2f87ff', color: '#fff', fontSize: 13, fontWeight: 850, textDecoration: 'none' };
const secondaryLinkStyle = { display: 'inline-block', borderRadius: 10, padding: '9px 12px', border: '1px solid rgba(86,160,255,.26)', color: '#8fc7ff', fontSize: 12, fontWeight: 850, textDecoration: 'none', whiteSpace: 'nowrap' as const };
