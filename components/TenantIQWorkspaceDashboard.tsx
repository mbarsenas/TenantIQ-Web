'use client';

import { useEffect, useMemo, useState } from 'react';

type Assessment = {
  assessment_id: string;
  source_name?: string | null;
  imported_at?: string | null;
  finding_count: number;
};

type PriorityFinding = {
  check_id?: string;
  title?: string;
  status?: string;
  severity?: string;
  evidence?: unknown;
};

type PostureSummary = {
  assessment_id: string;
  source_name?: string | null;
  imported_at?: string | null;
  finding_count: number;
  status_counts?: Record<string, number>;
  severity_counts?: Record<string, number>;
  workloads?: Record<string, Record<string, number>>;
  priority_findings?: PriorityFinding[];
};

async function jsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new Error('TenantIQ received an unexpected dashboard response.'); }
}

function count(summary: PostureSummary | null, key: string) {
  if (!summary?.status_counts) return 0;
  return Number(summary.status_counts[key] || summary.status_counts[key.toUpperCase()] || 0);
}

export default function TenantIQWorkspaceDashboard() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [summary, setSummary] = useState<PostureSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const listResponse = await fetch('/api/assistant/assessments', { cache: 'no-store' });
        const listPayload = await jsonResponse(listResponse);
        if (!listResponse.ok) throw new Error(listPayload?.detail || 'Unable to load assessments.');
        const items = Array.isArray(listPayload) ? (listPayload as Assessment[]) : [];
        setAssessments(items);
        if (!items.length) return;

        const latest = items[0];
        const summaryResponse = await fetch(`/api/assistant/assessments/${encodeURIComponent(latest.assessment_id)}/summary`, { cache: 'no-store' });
        const summaryPayload = await jsonResponse(summaryResponse);
        if (!summaryResponse.ok) throw new Error(summaryPayload?.detail || 'Unable to load assessment posture.');
        setSummary(summaryPayload as PostureSummary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load TenantIQ workspace posture.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalFindings = useMemo(() => assessments.reduce((sum, item) => sum + Number(item.finding_count || 0), 0), [assessments]);

  if (loading) return <section style={panelStyle}>Loading current TenantIQ posture…</section>;
  if (error) return <section style={{ ...panelStyle, borderColor: 'rgba(255,90,90,.25)', color: '#ffaaaa' }}>{error}</section>;
  if (!assessments.length) return <section style={panelStyle}>No assessments are stored yet. Upload one from the Assistant to populate the dashboard.</section>;

  const fail = count(summary, 'FAIL');
  const warning = count(summary, 'WARNING');
  const pass = count(summary, 'PASS');
  const info = count(summary, 'INFO');
  const latest = assessments[0];
  const priorities = summary?.priority_findings || [];

  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
        <Metric label="Assessments" value={String(assessments.length)} />
        <Metric label="Stored findings" value={String(totalFindings)} />
        <Metric label="FAIL" value={String(fail)} emphasis={fail > 0} />
        <Metric label="WARNING" value={String(warning)} emphasis={warning > 0} />
        <Metric label="PASS" value={String(pass)} />
        <Metric label="INFO" value={String(info)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(280px,.8fr)', gap: 16 }}>
        <article style={panelStyle}>
          <div style={eyebrowStyle}>Latest assessment posture</div>
          <h2 style={{ margin: '8px 0 6px', fontSize: 21, overflowWrap: 'anywhere' }}>{latest.source_name || latest.assessment_id}</h2>
          <div style={{ color: '#8496aa', fontSize: 13, marginBottom: 16 }}>{latest.imported_at ? new Date(latest.imported_at).toLocaleString() : 'Import time unavailable'} · {summary?.finding_count ?? latest.finding_count} findings</div>
          {priorities.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {priorities.slice(0, 4).map((finding, index) => (
                <div key={`${finding.check_id || index}`} style={{ borderTop: index ? '1px solid rgba(86,160,255,.12)' : 'none', paddingTop: index ? 10 : 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#eef5fd', fontSize: 14 }}>{finding.check_id || finding.title || 'Priority finding'}</strong>
                    <span style={{ color: finding.status === 'FAIL' ? '#ff9b9b' : '#f3d77a', fontSize: 11, fontWeight: 900 }}>{finding.status || 'REVIEW'}</span>
                    {finding.severity ? <span style={{ color: '#9bb0c7', fontSize: 11 }}>{finding.severity}</span> : null}
                  </div>
                  {finding.title && finding.title !== finding.check_id ? <div style={{ color: '#9eacbd', fontSize: 13, marginTop: 3 }}>{finding.title}</div> : null}
                </div>
              ))}
            </div>
          ) : <div style={{ color: '#90a1b4' }}>No FAIL or WARNING findings are present in the latest assessment.</div>}
        </article>

        <article style={panelStyle}>
          <div style={eyebrowStyle}>Next action</div>
          <h2 style={{ margin: '8px 0 8px', fontSize: 21 }}>{fail || warning ? 'Review priority findings' : 'Posture looks healthy'}</h2>
          <p style={{ color: '#96a6b8', lineHeight: 1.6, margin: '0 0 18px', fontSize: 14 }}>{fail || warning ? 'Open the latest assessment in the Knowledge Assistant for evidence-grounded remediation guidance.' : 'Use the Assistant to review informational findings or upload another workload assessment.'}</p>
          <a href={`/api/assistant/select-assessment?assessment=${encodeURIComponent(latest.assessment_id)}`} style={primaryLinkStyle}>Open latest in Assistant</a>
        </article>
      </div>
    </section>
  );
}

function Metric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div style={{ border: `1px solid ${emphasis ? 'rgba(244,196,48,.28)' : 'rgba(86,160,255,.17)'}`, borderRadius: 14, background: emphasis ? 'rgba(244,196,48,.06)' : 'rgba(8,22,40,.66)', padding: 15 }}><div style={{ color: '#8192a6', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div><div style={{ color: emphasis ? '#f4d35e' : '#f3f7fc', fontSize: 26, fontWeight: 900, marginTop: 6 }}>{value}</div></div>;
}

const panelStyle = { border: '1px solid rgba(86,160,255,.18)', borderRadius: 16, background: 'rgba(8,22,40,.72)', padding: 20, color: '#dce7f4' };
const eyebrowStyle = { color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' as const };
const primaryLinkStyle = { display: 'inline-block', borderRadius: 10, padding: '10px 14px', background: '#2f87ff', color: '#fff', fontSize: 13, fontWeight: 850, textDecoration: 'none' };
