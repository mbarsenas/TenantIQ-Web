'use client';

import { useEffect, useMemo, useState } from 'react';

type AssessmentSummary = {
  assessment_id: string;
  source_name?: string | null;
  imported_at?: string | null;
  finding_count: number;
  metadata?: Record<string, unknown>;
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
  if (value.includes('portfolio')) return 'Tenant portfolio';
  return 'TenantIQ assessment';
}

async function readPayload(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new Error('TenantIQ received an unexpected response while loading assessments.'); }
}

export default function TenantIQAssessments() {
  const [items, setItems] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/assistant/assessments', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await readPayload(response);
        if (!response.ok) throw new Error(payload?.detail || 'Unable to load TenantIQ assessments.');
        setItems(Array.isArray(payload) ? payload : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load TenantIQ assessments.'))
      .finally(() => setLoading(false));
  }, []);

  const totalFindings = useMemo(() => items.reduce((sum, item) => sum + Number(item.finding_count || 0), 0), [items]);

  if (loading) return <div style={noticeStyle}>Loading your TenantIQ assessments…</div>;
  if (error) return <div style={{ ...noticeStyle, borderColor: 'rgba(255,90,90,.28)', color: '#ffaaaa' }}>{error}</div>;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 22 }}>
        <Metric label="Stored assessments" value={String(items.length)} />
        <Metric label="Findings stored" value={String(totalFindings)} />
        <Metric label="Workspace status" value={items.length ? 'Ready' : 'Empty'} />
      </div>

      {items.length === 0 ? (
        <div style={emptyStyle}>
          <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>No assessments yet</h2>
          <p style={{ margin: '0 0 18px', color: '#9eacbd', lineHeight: 1.6 }}>Upload your first TenantIQ assessment from the Assistant to begin building assessment history.</p>
          <a href="/assistant" style={primaryLinkStyle}>Open Assistant</a>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => {
            const name = item.source_name || item.assessment_id;
            const workload = workloadFromName(name);
            const imported = item.imported_at ? new Date(item.imported_at).toLocaleString() : 'Import time unavailable';
            const validated = item.metadata?.validated === true;
            const assistantHref = `/api/assistant/select-assessment?assessment=${encodeURIComponent(item.assessment_id)}`;
            return (
              <article key={item.assessment_id} style={cardStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ color: '#8fc7ff', fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' }}>{workload}</span>
                    {validated ? <span style={{ borderRadius: 999, padding: '4px 8px', background: 'rgba(52,211,153,.10)', color: '#86e1ad', fontSize: 11, fontWeight: 800 }}>Validated</span> : null}
                  </div>
                  <h2 style={{ margin: 0, fontSize: 18, color: '#f1f6fc', overflowWrap: 'anywhere' }}>{name}</h2>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, color: '#8fa0b4', fontSize: 13 }}>
                    <span>{item.finding_count} findings</span>
                    <span>{imported}</span>
                  </div>
                  <div title={item.assessment_id} style={{ marginTop: 8, color: '#63758a', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, overflowWrap: 'anywhere' }}>{item.assessment_id}</div>
                </div>
                <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
                  <a href={assistantHref} style={primaryLinkStyle}>Open in Assistant</a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ border: '1px solid rgba(86,160,255,.17)', borderRadius: 14, background: 'rgba(8,22,40,.66)', padding: 16 }}><div style={{ color: '#8192a6', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div><div style={{ color: '#f3f7fc', fontSize: 26, fontWeight: 850, marginTop: 7 }}>{value}</div></div>;
}

const cardStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, flexWrap: 'wrap' as const, border: '1px solid rgba(86,160,255,.18)', borderRadius: 16, background: 'rgba(8,22,40,.72)', padding: 18 };
const noticeStyle = { border: '1px solid rgba(86,160,255,.18)', borderRadius: 14, background: 'rgba(8,22,40,.66)', padding: 18, color: '#a9b9ca' };
const emptyStyle = { border: '1px dashed rgba(86,160,255,.24)', borderRadius: 16, background: 'rgba(8,22,40,.50)', padding: 28 };
const primaryLinkStyle = { display: 'inline-block', borderRadius: 10, padding: '10px 14px', background: '#2f87ff', color: '#fff', fontSize: 13, fontWeight: 850, textDecoration: 'none' };
