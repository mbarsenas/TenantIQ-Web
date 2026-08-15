'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { TENANTIQ_WORKLOADS, tenantIQWorkloadLabel } from '../lib/tenantiq-workloads';

type AssessmentSummary = {
  assessment_id: string;
  source_name?: string | null;
  imported_at?: string | null;
  finding_count: number;
  metadata?: Record<string, unknown>;
};

type UploadResult = {
  fileName: string;
  workload: string;
  findingCount: number;
  validated: boolean;
  canonicalFindings: number;
  canonicalRatio: number;
};

async function readPayload(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new Error('TenantIQ received an unexpected response while loading assessments.'); }
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function TenantIQAssessments() {
  const [items, setItems] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function refreshAssessments() {
    const response = await fetch('/api/assistant/assessments', { cache: 'no-store' });
    const payload = await readPayload(response);
    if (!response.ok) throw new Error(payload?.detail || 'Unable to load TenantIQ assessments.');
    const next = Array.isArray(payload) ? payload as AssessmentSummary[] : [];
    next.sort((a, b) => new Date(b.imported_at || 0).getTime() - new Date(a.imported_at || 0).getTime());
    setItems(next);
  }

  useEffect(() => {
    refreshAssessments()
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load TenantIQ assessments.'))
      .finally(() => setLoading(false));
  }, []);

  async function uploadAssessment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'json'].includes(extension || '')) {
      setError('TenantIQ assessment uploads must be CSV or JSON files.');
      return;
    }

    setUploading(true);
    setUploadResult(null);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      const response = await fetch('/api/assistant/assessments/upload', { method: 'POST', body: formData });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(payload?.detail || 'TenantIQ could not import this assessment.');

      const metadata = payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata as Record<string, unknown> : {};
      const findingCount = numberValue(payload?.finding_count);
      const canonicalFindings = numberValue(metadata.canonical_findings, findingCount);
      const canonicalRatio = numberValue(metadata.canonical_ratio, findingCount ? canonicalFindings / findingCount : 0);
      const sourceName = String(payload?.source_name || metadata.original_filename || file.name);

      setUploadResult({
        fileName: file.name,
        workload: tenantIQWorkloadLabel(sourceName, 'Recognized TenantIQ assessment'),
        findingCount,
        validated: metadata.validated === true,
        canonicalFindings,
        canonicalRatio,
      });
      await refreshAssessments();
    } catch (err) {
      setUploadResult(null);
      setError(err instanceof Error ? err.message : 'Unable to upload the TenantIQ assessment.');
    } finally {
      setUploading(false);
    }
  }

  const totalFindings = useMemo(() => items.reduce((sum, item) => sum + Number(item.finding_count || 0), 0), [items]);
  const workloadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const workload = tenantIQWorkloadLabel(item.source_name || item.assessment_id, '');
      if (workload) counts.set(workload, (counts.get(workload) || 0) + 1);
    }
    return counts;
  }, [items]);
  const coveredWorkloads = TENANTIQ_WORKLOADS.filter((workload) => workloadCounts.has(workload.label)).length;

  if (loading) return <div style={noticeStyle}>Loading your TenantIQ assessments…</div>;

  return <>
    <input ref={fileInputRef} type="file" accept=".csv,.json,text/csv,application/json" onChange={uploadAssessment} style={{ display: 'none' }} />

    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
      <div style={{ color: '#91a4b9', fontSize: 13, lineHeight: 1.55 }}>
        Upload TenantIQ CSV or JSON assessment output. Imported assessments are stored in your licensed workspace and remain available after sign-out.
      </div>
      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ ...primaryButtonStyle, opacity: uploading ? .65 : 1, cursor: uploading ? 'wait' : 'pointer' }}>
        {uploading ? 'Uploading…' : 'Upload assessment'}
      </button>
    </div>

    {uploadResult ? <section style={{ ...noticeStyle, marginBottom: 16, borderColor: 'rgba(52,211,153,.28)', background: 'rgba(52,211,153,.045)' }} aria-label="Assessment import validation">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#86e1ad', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }}>{uploadResult.validated ? 'Validated TenantIQ assessment' : 'Assessment imported'}</div>
          <div style={{ color: '#e7f7ed', fontSize: 16, fontWeight: 850, marginTop: 5, overflowWrap: 'anywhere' }}>{uploadResult.fileName}</div>
        </div>
        <span style={{ borderRadius: 999, padding: '6px 10px', background: 'rgba(52,211,153,.10)', color: '#86e1ad', fontSize: 11, fontWeight: 900 }}>{uploadResult.workload}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 14 }}>
        <ValidationField label="Findings imported" value={String(uploadResult.findingCount)} />
        <ValidationField label="Canonical findings" value={`${uploadResult.canonicalFindings}/${uploadResult.findingCount}`} />
        <ValidationField label="Canonical match" value={`${Math.round(uploadResult.canonicalRatio * 100)}%`} />
        <ValidationField label="Validation" value={uploadResult.validated ? 'Passed' : 'Imported'} />
      </div>
    </section> : null}

    {error ? <div style={{ ...noticeStyle, marginBottom: 16, borderColor: 'rgba(255,90,90,.28)', color: '#ffaaaa' }}>{error}</div> : null}

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 18 }}>
      <Metric label="Stored assessments" value={String(items.length)} />
      <Metric label="Findings stored" value={String(totalFindings)} />
      <Metric label="Workload coverage" value={`${coveredWorkloads}/8`} />
      <Metric label="Workspace status" value={items.length ? 'Ready' : 'Empty'} />
    </div>

    <section style={{ ...noticeStyle, marginBottom: 22 }} aria-label="Assessment workload coverage">
      <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 10 }}>Microsoft 365 workload coverage</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 }}>
        {TENANTIQ_WORKLOADS.map(({ label }) => {
          const count = workloadCounts.get(label) || 0;
          return <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '9px 11px', borderRadius: 10, background: count ? 'rgba(47,135,255,.07)' : 'rgba(255,255,255,.02)', border: `1px solid ${count ? 'rgba(86,160,255,.18)' : 'rgba(255,255,255,.05)'}` }}>
            <span style={{ color: count ? '#dbeaff' : '#73859a', fontSize: 13, fontWeight: 750 }}>{label}</span>
            <span style={{ color: count ? '#8fc7ff' : '#66788c', fontSize: 11, fontWeight: 850 }}>{count ? `${count} stored` : 'Not uploaded'}</span>
          </div>;
        })}
      </div>
    </section>

    {!items.length ? <div style={emptyStyle}>
      <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>No assessments yet</h2>
      <p style={{ margin: '0 0 18px', color: '#9eacbd', lineHeight: 1.6 }}>Upload your first TenantIQ assessment to begin building assessment history and tenant-wide posture.</p>
      <button type="button" onClick={() => fileInputRef.current?.click()} style={{ ...primaryButtonStyle, cursor: 'pointer' }}>Upload first assessment</button>
    </div> : <div style={{ display: 'grid', gap: 12 }}>
      {items.map((item) => {
        const name = item.source_name || item.assessment_id;
        const workload = tenantIQWorkloadLabel(name);
        const imported = item.imported_at ? new Date(item.imported_at).toLocaleString() : 'Import time unavailable';
        const validated = item.metadata?.validated === true;
        const canonicalRatio = numberValue(item.metadata?.canonical_ratio, 0);
        const assistantHref = `/api/assistant/select-assessment?assessment=${encodeURIComponent(item.assessment_id)}`;
        const detailHref = `/assessments/${encodeURIComponent(item.assessment_id)}`;
        return <article key={item.assessment_id} style={cardStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ color: '#8fc7ff', fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' }}>{workload}</span>
              {validated ? <span style={{ borderRadius: 999, padding: '4px 8px', background: 'rgba(52,211,153,.10)', color: '#86e1ad', fontSize: 11, fontWeight: 800 }}>Validated{canonicalRatio ? ` · ${Math.round(canonicalRatio * 100)}% canonical` : ''}</span> : null}
            </div>
            <h2 style={{ margin: 0, fontSize: 18, color: '#f1f6fc', overflowWrap: 'anywhere' }}>{name}</h2>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, color: '#8fa0b4', fontSize: 13 }}><span>{item.finding_count} findings</span><span>{imported}</span></div>
            <div title={item.assessment_id} style={{ marginTop: 8, color: '#63758a', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, overflowWrap: 'anywhere' }}>{item.assessment_id}</div>
          </div>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href={detailHref} style={secondaryLinkStyle}>View findings</a>
            <a href={assistantHref} style={primaryLinkStyle}>Open AI Assistant</a>
          </div>
        </article>;
      })}
    </div>}
  </>;
}

function ValidationField({ label, value }: { label: string; value: string }) {
  return <div style={{ border: '1px solid rgba(52,211,153,.14)', borderRadius: 10, padding: '10px 11px', background: 'rgba(2,18,20,.25)' }}><div style={{ color: '#7f9f93', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div><div style={{ color: '#dff8e8', fontSize: 15, fontWeight: 850, marginTop: 5 }}>{value}</div></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ border: '1px solid rgba(86,160,255,.17)', borderRadius: 14, background: 'rgba(8,22,40,.66)', padding: 16 }}><div style={{ color: '#8192a6', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div><div style={{ color: '#f3f7fc', fontSize: 26, fontWeight: 850, marginTop: 7 }}>{value}</div></div>;
}

const cardStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, flexWrap: 'wrap' as const, border: '1px solid rgba(86,160,255,.18)', borderRadius: 16, background: 'rgba(8,22,40,.72)', padding: 18 };
const noticeStyle = { border: '1px solid rgba(86,160,255,.18)', borderRadius: 14, background: 'rgba(8,22,40,.66)', padding: 18, color: '#a9b9ca' };
const emptyStyle = { border: '1px dashed rgba(86,160,255,.24)', borderRadius: 16, background: 'rgba(8,22,40,.50)', padding: 28 };
const primaryLinkStyle = { display: 'inline-block', borderRadius: 10, padding: '10px 14px', background: '#2f87ff', color: '#fff', fontSize: 13, fontWeight: 850, textDecoration: 'none' };
const primaryButtonStyle = { border: 0, borderRadius: 10, padding: '10px 14px', background: '#2f87ff', color: '#fff', fontSize: 13, fontWeight: 850, whiteSpace: 'nowrap' as const };
const secondaryLinkStyle = { display: 'inline-block', borderRadius: 10, padding: '9px 13px', border: '1px solid rgba(86,160,255,.25)', color: '#9dcbff', fontSize: 13, fontWeight: 850, textDecoration: 'none' };
