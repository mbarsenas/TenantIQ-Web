'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type AskResponse = {
  assessment_id: string;
  route: 'specific_finding' | 'tenant_wide';
  check_id?: string | null;
  answer: string;
};

type AssessmentSummary = {
  assessment_id: string;
  source_name?: string | null;
  imported_at?: string | null;
  finding_count: number;
  metadata?: Record<string, unknown>;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  route?: string;
  assessmentId?: string;
};

const ASSISTANT_API = '/api/assistant';
const ASSESSMENTS_API = '/api/assistant/assessments';
const starterQuestion = 'What are the biggest problems in this tenant and what should be fixed first?';

function shortAssessmentId(value: string) {
  return value.length > 44 ? `${value.slice(0, 41)}…` : value;
}

function assessmentLabel(item: AssessmentSummary) {
  const name = item.source_name || item.assessment_id;
  return `${name} · ${item.finding_count} findings`;
}

export default function TenantIQAssistant() {
  const [question, setQuestion] = useState(starterQuestion);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeAssessmentId, setActiveAssessmentId] = useState('');
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasConversation = messages.length > 0;
  const canSubmit = useMemo(() => Boolean(question.trim()) && !loading, [question, loading]);
  const activeAssessment = useMemo(
    () => assessments.find((item) => item.assessment_id === activeAssessmentId),
    [assessments, activeAssessmentId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAssessments() {
      setAssessmentsLoading(true);
      try {
        const response = await fetch(ASSESSMENTS_API, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.detail || 'Unable to load TenantIQ assessments.');
        const items = Array.isArray(payload) ? (payload as AssessmentSummary[]) : [];
        if (cancelled) return;
        setAssessments(items);
        if (items.length > 0) setActiveAssessmentId((current) => current || items[0].assessment_id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load TenantIQ assessments.');
      } finally {
        if (!cancelled) setAssessmentsLoading(false);
      }
    }

    loadAssessments();
    return () => { cancelled = true; };
  }, []);

  function beginTimer() {
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', content: trimmed }]);
    setQuestion('');
    setLoading(true);
    setError('');
    beginTimer();

    try {
      const response = await fetch(ASSISTANT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, assessment_id: activeAssessmentId || undefined }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || 'TenantIQ assistant request failed.');

      const result = payload as AskResponse;
      setActiveAssessmentId(result.assessment_id);
      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.answer,
        route: result.route === 'specific_finding' ? 'Specific finding' : 'Tenant-wide insights',
        assessmentId: result.assessment_id,
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach the TenantIQ assistant service.');
    } finally {
      stopTimer();
      setLoading(false);
    }
  }

  function startOver() {
    setMessages([]);
    setError('');
    setQuestion(starterQuestion);
    setElapsed(0);
  }

  return (
    <section style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb', padding: '36px 20px 56px' }}>
      <div style={{ width: 'min(1040px,100%)', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <a href="/" style={{ color: '#8fc7ff', textDecoration: 'none', fontWeight: 700 }}>← Back to TenantIQ</a>
          {hasConversation && <button type="button" onClick={startOver} disabled={loading} style={{ border: '1px solid rgba(86,160,255,.28)', borderRadius: 10, padding: '9px 13px', fontWeight: 700, background: 'transparent', color: '#b9d8ff' }}>New conversation</button>}
        </div>

        <div style={{ marginTop: 28, marginBottom: 24 }}>
          <div style={{ color: '#6eb5ff', fontSize: 13, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ Knowledge Assistant</div>
          <h1 style={{ fontSize: 'clamp(34px,6vw,58px)', lineHeight: 1.05, margin: '10px 0 14px' }}>Ask questions about the assessment.</h1>
          <p style={{ maxWidth: 760, color: '#aeb8c8', fontSize: 17, lineHeight: 1.65, margin: 0 }}>Read-only, grounded answers from TenantIQ assessment evidence and the TenantIQ knowledge base. The assistant does not make tenant changes.</p>
        </div>

        <div style={{ marginBottom: 22, border: '1px solid rgba(86,160,255,.2)', borderRadius: 16, background: 'rgba(8,22,40,.68)', padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#8fc7ff', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Assessment context</div>
              <div style={{ marginTop: 5, color: '#dfe8f4', fontWeight: 700 }}>
                {activeAssessment ? assessmentLabel(activeAssessment) : assessmentsLoading ? 'Loading assessments…' : 'No assessment selected'}
              </div>
              {activeAssessmentId && <div title={activeAssessmentId} style={{ marginTop: 5, color: '#7f8b9a', fontSize: 12 }}>{shortAssessmentId(activeAssessmentId)}</div>}
            </div>
            <select
              aria-label="Select TenantIQ assessment"
              value={activeAssessmentId}
              onChange={(event) => { setActiveAssessmentId(event.target.value); setMessages([]); setError(''); }}
              disabled={loading || assessmentsLoading || assessments.length === 0}
              style={{ minWidth: 320, maxWidth: '100%', borderRadius: 10, border: '1px solid rgba(86,160,255,.3)', background: '#081425', color: '#eaf2fb', padding: '11px 12px' }}
            >
              {assessments.length === 0 && <option value="">No stored assessments</option>}
              {assessments.map((item) => <option key={item.assessment_id} value={item.assessment_id}>{assessmentLabel(item)}</option>)}
            </select>
          </div>
        </div>

        {hasConversation && <div style={{ display: 'grid', gap: 16, marginBottom: 22 }}>
          {messages.map((message) => <div key={message.id} style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <article style={{ width: message.role === 'user' ? 'min(760px,88%)' : 'min(900px,96%)', borderRadius: 18, border: message.role === 'user' ? '1px solid rgba(47,135,255,.34)' : '1px solid rgba(86,160,255,.18)', background: message.role === 'user' ? 'rgba(47,135,255,.14)' : 'rgba(8,22,40,.82)', padding: '18px 20px', boxShadow: '0 16px 48px rgba(0,0,0,.18)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                <strong style={{ color: message.role === 'user' ? '#b9d8ff' : '#f4f7fb', fontSize: 13 }}>{message.role === 'user' ? 'You' : 'TenantIQ'}</strong>
                {message.role === 'assistant' && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {message.route && <span style={{ borderRadius: 999, padding: '5px 9px', background: 'rgba(47,135,255,.12)', color: '#9dcbff', fontSize: 11, fontWeight: 800 }}>{message.route}</span>}
                  {message.assessmentId && <span title={message.assessmentId} style={{ borderRadius: 999, padding: '5px 9px', background: 'rgba(255,255,255,.05)', color: '#9ca8b8', fontSize: 11 }}>Assessment loaded</span>}
                </div>}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.72, color: '#e7edf5', fontSize: 15 }}>{message.content}</div>
            </article>
          </div>)}
        </div>}

        {loading && <div style={{ marginBottom: 18, borderRadius: 14, border: '1px solid rgba(244,196,48,.24)', background: 'rgba(244,196,48,.07)', padding: 16, color: '#f4d35e' }}><div style={{ fontWeight: 800, marginBottom: 6 }}>TenantIQ is analyzing the assessment…</div><div style={{ color: '#d7c67a', fontSize: 14 }}>Retrieving grounded evidence and generating an answer. Elapsed: {elapsed}s</div></div>}
        {error && <div style={{ marginBottom: 18, borderRadius: 14, border: '1px solid rgba(255,90,90,.28)', background: 'rgba(255,70,70,.08)', padding: 16, color: '#ffaaaa' }}><strong>TenantIQ could not complete the request.</strong><div style={{ marginTop: 5 }}>{error}</div></div>}

        <form onSubmit={submit} style={{ background: 'rgba(8,22,40,.9)', border: '1px solid rgba(86,160,255,.24)', borderRadius: 18, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.24)', position: hasConversation ? 'sticky' : 'static', bottom: 18 }}>
          <label htmlFor="tenantiq-question" style={{ display: 'block', fontWeight: 750, marginBottom: 10 }}>{hasConversation ? 'Ask a follow-up' : 'Question'}</label>
          <textarea id="tenantiq-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (canSubmit) event.currentTarget.form?.requestSubmit(); } }} rows={hasConversation ? 3 : 5} disabled={loading} placeholder="Ask about risks, findings, evidence, or recommended remediation…" style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', borderRadius: 12, border: '1px solid rgba(139,149,165,.3)', background: '#081425', color: '#f5f8fc', padding: 16, font: 'inherit', lineHeight: 1.5, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="submit" disabled={!canSubmit} style={{ border: 0, borderRadius: 10, padding: '12px 18px', fontWeight: 800, background: '#2f87ff', color: 'white', opacity: canSubmit ? 1 : .55 }}>{loading ? 'Analyzing assessment…' : hasConversation ? 'Send follow-up' : 'Ask TenantIQ'}</button>
            <button type="button" disabled={loading} onClick={() => setQuestion('Explain ENTRA-MFA-001 and tell me what needs to be fixed.')} style={{ border: '1px solid rgba(86,160,255,.3)', borderRadius: 10, padding: '12px 18px', fontWeight: 700, background: 'transparent', color: '#b9d8ff' }}>Try MFA finding</button>
            <span style={{ color: '#7f8b9a', fontSize: 12 }}>Enter to send · Shift+Enter for a new line</span>
          </div>
        </form>
      </div>
    </section>
  );
}
