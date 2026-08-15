'use client';

import { useEffect, useMemo, useState } from 'react';
import { TENANTIQ_WORKLOADS, tenantIQWorkloadKey } from '../lib/tenantiq-workloads';

type Assessment = { assessment_id: string; source_name?: string | null; imported_at?: string | null; finding_count: number };
type PriorityFinding = { check_id?: string; title?: string; status?: string; severity?: string; evidence?: unknown };
type PostureSummary = { assessment_id: string; source_name?: string | null; imported_at?: string | null; finding_count: number; status_counts?: Record<string, number>; severity_counts?: Record<string, number>; workloads?: Record<string, Record<string, number>>; priority_findings?: PriorityFinding[] };
type WorkloadPosture = { key: string; label: string; assessment: Assessment | null; summary: PostureSummary | null };

async function jsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new Error('TenantIQ received an unexpected dashboard response.'); }
}

function count(summary: PostureSummary | null, key: string) {
  if (!summary?.status_counts) return 0;
  return Number(summary.status_counts[key] || summary.status_counts[key.toUpperCase()] || 0);
}
function severityRank(value?: string) { const n = String(value || '').toUpperCase(); return n === 'CRITICAL' ? 5 : n === 'HIGH' ? 4 : n === 'MEDIUM' ? 3 : n === 'LOW' ? 2 : n === 'INFO' ? 1 : 0; }
function statusRank(value?: string) { const n = String(value || '').toUpperCase(); return n === 'FAIL' ? 3 : n === 'WARNING' ? 2 : 0; }

export default function TenantIQWorkspaceDashboard() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [summaries, setSummaries] = useState<Record<string, PostureSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const listResponse = await fetch('/api/assistant/assessments', { cache: 'no-store' });
        const listPayload = await jsonResponse(listResponse);
        if (!listResponse.ok) throw new Error(listPayload?.detail || 'Unable to load assessments.');
        const items = Array.isArray(listPayload) ? listPayload as Assessment[] : [];
        setAssessments(items);
        if (!items.length) return;
        const pairs = await Promise.all(items.map(async (item) => {
          const response = await fetch(`/api/assistant/assessments/${encodeURIComponent(item.assessment_id)}/summary`, { cache: 'no-store' });
          const payload = await jsonResponse(response);
          return [item.assessment_id, response.ok ? payload as PostureSummary : null] as const;
        }));
        const next: Record<string, PostureSummary> = {};
        for (const [id, summary] of pairs) if (summary) next[id] = summary;
        setSummaries(next);
      } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load TenantIQ workspace posture.'); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const workloadPosture = useMemo<WorkloadPosture[]>(() => TENANTIQ_WORKLOADS.map((workload) => {
    const matching = assessments.filter((item) => tenantIQWorkloadKey(item.source_name || item.assessment_id) === workload.key).sort((a, b) => new Date(b.imported_at || 0).getTime() - new Date(a.imported_at || 0).getTime());
    const assessment = matching[0] || null;
    return { key: workload.key, label: workload.label, assessment, summary: assessment ? summaries[assessment.assessment_id] || null : null };
  }), [assessments, summaries]);

  const selected = workloadPosture.filter((item) => item.assessment && item.summary);
  const totals = selected.reduce((acc, item) => { acc.findings += Number(item.summary?.finding_count || item.assessment?.finding_count || 0); acc.fail += count(item.summary, 'FAIL'); acc.warning += count(item.summary, 'WARNING'); acc.pass += count(item.summary, 'PASS'); acc.info += count(item.summary, 'INFO'); return acc; }, { findings: 0, fail: 0, warning: 0, pass: 0, info: 0 });
  const topFindings = selected.flatMap((item) => (item.summary?.priority_findings || []).map((finding) => ({ ...finding, workload: item.label, assessmentId: item.assessment?.assessment_id || '' }))).filter((finding) => ['FAIL', 'WARNING'].includes(String(finding.status || '').toUpperCase())).sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || statusRank(b.status) - statusRank(a.status)).slice(0, 8);

  if (loading) return <section style={panelStyle}>Loading tenant-wide TenantIQ posture…</section>;
  if (error) return <section style={{ ...panelStyle, borderColor: 'rgba(255,90,90,.25)', color: '#ffaaaa' }}>{error}</section>;
  if (!assessments.length) return <section style={panelStyle}>No assessments are stored yet. Upload one from Assessments or the AI Assistant to populate the dashboard.</section>;

  return <section style={{ marginBottom: 28 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 12, marginBottom: 16 }}><Metric label="Workloads assessed" value={`${selected.length}/8`} /><Metric label="Tenant findings" value={String(totals.findings)} /><Metric label="FAIL" value={String(totals.fail)} emphasis={totals.fail > 0} tone="fail" /><Metric label="WARNING" value={String(totals.warning)} emphasis={totals.warning > 0} tone="warning" /><Metric label="PASS" value={String(totals.pass)} /><Metric label="INFO" value={String(totals.info)} /></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(320px,.85fr)', gap: 16, marginBottom: 16 }}>
      <article style={panelStyle}><div style={eyebrowStyle}>Tenant posture overview</div><h2 style={{ margin: '8px 0 4px', fontSize: 22 }}>Microsoft 365 workload posture</h2><p style={{ color: '#8496aa', fontSize: 13, margin: '0 0 16px' }}>Uses the latest stored assessment for each of the eight supported workloads.</p><div style={{ display: 'grid', gap: 8 }}>{workloadPosture.map((item) => { const fail = count(item.summary, 'FAIL'); const warning = count(item.summary, 'WARNING'); const assessed = Boolean(item.assessment && item.summary); return <div key={item.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(170px,1fr) auto', gap: 12, alignItems: 'center', padding: '11px 0', borderTop: '1px solid rgba(86,160,255,.10)' }}><div><div style={{ color: assessed ? '#e8f1fb' : '#6f8195', fontWeight: 800, fontSize: 14 }}>{item.label}</div><div style={{ color: '#718398', fontSize: 11, marginTop: 2 }}>{assessed ? `${item.summary?.finding_count ?? item.assessment?.finding_count ?? 0} findings · latest assessment` : 'No assessment uploaded'}</div></div>{assessed ? <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}><StatusPill label={`${fail} Fail`} active={fail > 0} kind="fail" /><StatusPill label={`${warning} Warning`} active={warning > 0} kind="warning" /><a href={`/assessments/${encodeURIComponent(item.assessment!.assessment_id)}`} style={textLinkStyle}>View findings →</a></div> : <span style={{ color: '#65778c', fontSize: 12, fontWeight: 700 }}>Not assessed</span>}</div>; })}</div></article>
      <article style={panelStyle}><div style={eyebrowStyle}>Tenant coverage</div><h2 style={{ margin: '8px 0 8px', fontSize: 22 }}>{selected.length === 8 ? 'Full workload coverage' : `${8 - selected.length} workload${8 - selected.length === 1 ? '' : 's'} remaining`}</h2><p style={{ color: '#96a6b8', lineHeight: 1.6, margin: '0 0 18px', fontSize: 14 }}>{selected.length === 8 ? 'TenantIQ has a current assessment for all eight Microsoft 365 workloads.' : 'Upload the remaining workload assessments to complete the tenant-wide posture view.'}</p><div style={{ height: 10, borderRadius: 999, overflow: 'hidden', background: 'rgba(86,160,255,.10)', border: '1px solid rgba(86,160,255,.16)', marginBottom: 10 }}><div style={{ height: '100%', width: `${(selected.length / 8) * 100}%`, borderRadius: 999, background: '#2f87ff' }} /></div><div style={{ color: '#8193a8', fontSize: 12, marginBottom: 20 }}>{Math.round((selected.length / 8) * 100)}% workload coverage</div><a href="/assessments" style={primaryLinkStyle}>Upload another assessment</a></article>
    </div>
    <article style={panelStyle}><div style={eyebrowStyle}>Top priority findings</div><h2 style={{ margin: '8px 0 6px', fontSize: 22 }}>Tenant-wide remediation priorities</h2><p style={{ color: '#8496aa', fontSize: 13, margin: '0 0 16px' }}>Highest-severity FAIL and WARNING findings across the latest assessment for each workload.</p>{topFindings.length ? <div style={{ display: 'grid' }}>{topFindings.map((finding, index) => <div key={`${finding.workload}-${finding.check_id || index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,.65fr) minmax(260px,1.35fr) auto', gap: 16, alignItems: 'center', padding: '13px 0', borderTop: index ? '1px solid rgba(86,160,255,.11)' : 'none' }}><div><div style={{ color: '#8fc7ff', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.05em' }}>{finding.workload}</div><div style={{ color: '#eef5fd', fontWeight: 850, fontSize: 14, marginTop: 3 }}>{finding.check_id || 'Priority finding'}</div></div><div><div style={{ color: '#dce7f4', fontSize: 14, fontWeight: 750 }}>{finding.title || finding.check_id || 'Priority finding'}</div><div style={{ display: 'flex', gap: 8, marginTop: 4 }}><span style={{ color: String(finding.status).toUpperCase() === 'FAIL' ? '#ff9b9b' : '#f3d77a', fontSize: 11, fontWeight: 900 }}>{finding.status || 'REVIEW'}</span>{finding.severity ? <span style={{ color: '#9bb0c7', fontSize: 11 }}>{finding.severity}</span> : null}</div></div><a href={`/assessments/${encodeURIComponent(finding.assessmentId)}${finding.check_id ? `#${encodeURIComponent(finding.check_id)}` : ''}`} style={textLinkStyle}>Investigate →</a></div>)}</div> : <div style={{ color: '#90a1b4' }}>No FAIL or WARNING findings are present in the latest workload assessments.</div>}</article>
  </section>;
}

function Metric({ label, value, emphasis = false, tone }: { label: string; value: string; emphasis?: boolean; tone?: 'fail' | 'warning' }) { const border = emphasis ? (tone === 'fail' ? 'rgba(255,105,105,.30)' : 'rgba(244,196,48,.28)') : 'rgba(86,160,255,.17)'; const background = emphasis ? (tone === 'fail' ? 'rgba(255,85,85,.06)' : 'rgba(244,196,48,.06)') : 'rgba(8,22,40,.66)'; const color = emphasis ? (tone === 'fail' ? '#ff9b9b' : '#f4d35e') : '#f3f7fc'; return <div style={{ border: `1px solid ${border}`, borderRadius: 14, background, padding: 15 }}><div style={{ color: '#8192a6', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div><div style={{ color, fontSize: 26, fontWeight: 900, marginTop: 6 }}>{value}</div></div>; }
function StatusPill({ label, active, kind }: { label: string; active: boolean; kind: 'fail' | 'warning' }) { const color = active ? (kind === 'fail' ? '#ff9b9b' : '#f3d77a') : '#718398'; const background = active ? (kind === 'fail' ? 'rgba(255,85,85,.08)' : 'rgba(244,196,48,.07)') : 'rgba(255,255,255,.025)'; return <span style={{ borderRadius: 999, padding: '4px 8px', background, color, fontSize: 11, fontWeight: 850 }}>{label}</span>; }
const panelStyle = { border: '1px solid rgba(86,160,255,.18)', borderRadius: 16, background: 'rgba(8,22,40,.72)', padding: 18, color: '#dce7f4' };
const eyebrowStyle = { color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' as const };
const primaryLinkStyle = { display: 'inline-block', borderRadius: 10, padding: '10px 14px', background: '#2f87ff', color: '#fff', fontSize: 13, fontWeight: 850, textDecoration: 'none' };
const textLinkStyle = { color: '#8fc7ff', fontSize: 12, fontWeight: 850, textDecoration: 'none', whiteSpace: 'nowrap' as const };
