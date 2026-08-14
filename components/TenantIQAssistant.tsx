'use client';

import { FormEvent, useState } from 'react';

type AskResponse = {
  assessment_id: string;
  route: 'specific_finding' | 'tenant_wide';
  check_id?: string | null;
  answer: string;
};

const API_BASE = process.env.NEXT_PUBLIC_TENANTIQ_RAG_API || 'http://127.0.0.1:8787';

export default function TenantIQAssistant() {
  const [question, setQuestion] = useState('What are the biggest problems in this tenant and what should be fixed first?');
  const [answer, setAnswer] = useState('');
  const [route, setRoute] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError('');
    setAnswer('');
    setRoute('');

    try {
      const response = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || 'TenantIQ assistant request failed.');
      }

      const result = payload as AskResponse;
      setAnswer(result.answer);
      setAssessmentId(result.assessment_id);
      setRoute(result.route === 'specific_finding' ? 'Specific finding' : 'Tenant-wide insights');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach the TenantIQ assistant API.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb', padding: '48px 20px' }}>
      <div style={{ width: 'min(980px,100%)', margin: '0 auto' }}>
        <a href="/" style={{ color: '#8fc7ff', textDecoration: 'none', fontWeight: 700 }}>← Back to TenantIQ</a>
        <div style={{ marginTop: 30, marginBottom: 26 }}>
          <div style={{ color: '#6eb5ff', fontSize: 13, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ Knowledge Assistant</div>
          <h1 style={{ fontSize: 'clamp(34px,6vw,58px)', lineHeight: 1.05, margin: '10px 0 14px' }}>Ask questions about the assessment.</h1>
          <p style={{ maxWidth: 760, color: '#aeb8c8', fontSize: 17, lineHeight: 1.65, margin: 0 }}>
            Read-only, grounded answers from TenantIQ assessment evidence and the TenantIQ knowledge base. The assistant does not make tenant changes.
          </p>
        </div>

        <form onSubmit={submit} style={{ background: 'rgba(8,22,40,.88)', border: '1px solid rgba(86,160,255,.24)', borderRadius: 18, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.24)' }}>
          <label htmlFor="tenantiq-question" style={{ display: 'block', fontWeight: 750, marginBottom: 10 }}>Question</label>
          <textarea
            id="tenantiq-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={5}
            disabled={loading}
            style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', borderRadius: 12, border: '1px solid rgba(139,149,165,.3)', background: '#081425', color: '#f5f8fc', padding: 16, font: 'inherit', lineHeight: 1.5, outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="submit" disabled={loading || !question.trim()} style={{ border: 0, borderRadius: 10, padding: '12px 18px', fontWeight: 800, cursor: loading ? 'wait' : 'pointer', background: '#2f87ff', color: 'white', opacity: loading ? .7 : 1 }}>
              {loading ? 'Analyzing assessment…' : 'Ask TenantIQ'}
            </button>
            <button type="button" disabled={loading} onClick={() => setQuestion('Explain ENTRA-MFA-001 and tell me what needs to be fixed.')} style={{ border: '1px solid rgba(86,160,255,.3)', borderRadius: 10, padding: '12px 18px', fontWeight: 700, background: 'transparent', color: '#b9d8ff', cursor: 'pointer' }}>
              Try MFA finding
            </button>
          </div>
        </form>

        {loading && (
          <div style={{ marginTop: 22, borderRadius: 14, border: '1px solid rgba(244,196,48,.24)', background: 'rgba(244,196,48,.07)', padding: 16, color: '#f4d35e' }}>
            TenantIQ is retrieving grounded evidence and generating the answer. Tenant-wide questions can take longer than individual findings.
          </div>
        )}

        {error && (
          <div style={{ marginTop: 22, borderRadius: 14, border: '1px solid rgba(255,90,90,.28)', background: 'rgba(255,70,70,.08)', padding: 16, color: '#ffaaaa' }}>{error}</div>
        )}

        {answer && (
          <article style={{ marginTop: 24, borderRadius: 18, border: '1px solid rgba(86,160,255,.18)', background: 'rgba(8,22,40,.74)', padding: '24px 22px' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
              {route && <span style={{ borderRadius: 999, padding: '7px 10px', background: 'rgba(47,135,255,.12)', color: '#9dcbff', fontSize: 12, fontWeight: 800 }}>{route}</span>}
              {assessmentId && <span style={{ borderRadius: 999, padding: '7px 10px', background: 'rgba(255,255,255,.05)', color: '#9ca8b8', fontSize: 12 }}>{assessmentId}</span>}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#e7edf5', fontSize: 15 }}>{answer}</div>
          </article>
        )}
      </div>
    </section>
  );
}
