'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type AskResponse = {
  assessment_id: string;
  route: 'specific_finding' | 'tenant_wide';
  check_id?: string | null;
  answer: string;
  finding_count?: number;
  check_ids?: string[];
  sources?: string[];
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
  findingCount?: number;
  checkIds?: string[];
  sources?: string[];
};

const ASSISTANT_API = '/api/assistant';
const ASSESSMENTS_API = '/api/assistant/assessments';
const UPLOAD_API = '/api/assistant/assessments/upload';
const starterQuestion = 'What are the biggest problems in this tenant and what should be fixed first?';

function shortAssessmentId(value: string) {
  return value.length > 44 ? `${value.slice(0, 41)}…` : value;
}

function assessmentLabel(item: AssessmentSummary) {
  const name = item.source_name || item.assessment_id;
  return `${name} · ${item.finding_count} findings`;
}

function progressForElapsed(elapsed: number) {
  if (elapsed < 3) return 12;
  if (elapsed < 8) return 28;
  if (elapsed < 15) return 44;
  if (elapsed < 25) return 58;
  if (elapsed < 40) return 70;
  if (elapsed < 60) return 82;
  if (elapsed < 90) return 90;
  return 94;
}

function progressLabel(elapsed: number) {
  if (elapsed < 3) return 'Loading assessment context';
  if (elapsed < 10) return 'Reviewing findings';
  if (elapsed < 25) return 'Retrieving grounded evidence';
  if (elapsed < 45) return 'Prioritizing risks and recommendations';
  return 'Generating the final TenantIQ answer';
}

function contentWithoutSources(content: string) {
  const lines = content.split(/\r?\n/);
  const sourceHeadingIndex = lines.findIndex((line) => /^\s*Sources\s*:??\s*$/i.test(line.trim()));
  if (sourceHeadingIndex < 0) return content;
  return lines.slice(0, sourceHeadingIndex).join('\n').trimEnd();
}

function formatAssistantAnswer(content: string) {
  const lines = contentWithoutSources(content).split(/\r?\n/);
  return lines.map((line, index) => {
    const trimmed = line.trim();
    const isHeading =
      trimmed.length > 0 &&
      !trimmed.startsWith('-') &&
      !trimmed.startsWith('•') &&
      (/^(Biggest problems|Why this matters|What should be fixed first|Recommended remediation|Priority|Next steps|Key findings)/i.test(trimmed) ||
        (trimmed.length <= 72 && !/[.!?]$/.test(trimmed) && index === 0));

    if (!trimmed) return <div key={index} style={{ height: 10 }} />;
    if (isHeading) return <div key={index} style={{ marginTop: index === 0 ? 0 : 14, marginBottom: 6, fontWeight: 800, color: '#f4f7fb' }}>{trimmed}</div>;
    if (trimmed.startsWith('-') || trimmed.startsWith('•')) return <div key={index} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 6, margin: '4px 0' }}><span>•</span><span>{trimmed.replace(/^[-•]\s*/, '')}</span></div>;
    return <div key={index} style={{ margin: '4px 0' }}>{trimmed}</div>;
  });
}

function EvidencePanel({ message }: { message: ChatMessage }) {
  if (message.role !== 'assistant') return null;

  const checkIds = message.checkIds || [];
  const sources = message.sources || [];
  const hasChecks = checkIds.length > 0;
  const hasSources = sources.length > 0;
  if (!hasChecks && !hasSources && !message.findingCount) return null;

  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(86,160,255,.16)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: hasChecks || hasSources ? 10 : 0 }}>
        <span style={{ color: '#8fc7ff', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Evidence & sources</span>
        {message.findingCount ? <span style={{ borderRadius: 999, padding: '4px 8px', background: 'rgba(47,135,255,.11)', color: '#9dcbff', fontSize: 11, fontWeight: 700 }}>{message.findingCount} findings analyzed</span> : null}
      </div>

      {hasChecks && <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: hasSources ? 10 : 0 }}>
        {checkIds.map((checkId) => <span key={checkId} style={{ borderRadius: 8, padding: '5px 8px', border: '1px solid rgba(86,160,255,.22)', background: 'rgba(86,160,255,.06)', color: '#c6dcf7', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{checkId}</span>)}
      </div>}

      {hasSources && <div style={{ display: 'grid', gap: 6 }}>
        {sources.map((source) => <div key={source} title={source} style={{ display: 'grid', gridTemplateColumns: '14px minmax(0,1fr)', gap: 7, alignItems: 'start', color: '#9ca8b8', fontSize: 12, lineHeight: 1.45 }}><span>↳</span><span style={{ overflowWrap: 'anywhere' }}>{source}</span></div>)}
      </div>}
    </div>
  );
}

export default function TenantIQAssistant() {
  const [question, setQuestion] = useState(starterQuestion);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeAssessmentId, setActiveAssessmentId] = useState('');
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasConversation = messages.length > 0;
  const canSubmit = useMemo(() => Boolean(question.trim()) && !loading && Boolean(activeAssessmentId), [question, loading, activeAssessmentId]);
  const activeAssessment = useMemo(() => assessments.find((item) => item.assessment_id === activeAssessmentId), [assessments, activeAssessmentId]);
  const progressPercent = progressForElapsed(elapsed);
  const progressText = progressLabel(elapsed);

  async function refreshAssessments(preferredAssessmentId?: string) {
    setAssessmentsLoading(true);
    try {
      const response = await fetch(ASSESSMENTS_API, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || 'Unable to load TenantIQ assessments.');
      const items = Array.isArray(payload) ? (payload as AssessmentSummary[]) : [];
      setAssessments(items);
      if (preferredAssessmentId && items.some((item) => item.assessment_id === preferredAssessmentId)) {
        setActiveAssessmentId(preferredAssessmentId);
      } else if (items.length > 0) {
        setActiveAssessmentId((current) => current && items.some((item) => item.assessment_id === current) ? current : items[0].assessment_id);
      } else {
        setActiveAssessmentId('');
      }
    } finally {
      setAssessmentsLoading(false);
    }
  }

  useEffect(() => {
    refreshAssessments().catch((err) => setError(err instanceof Error ? err.message : 'Unable to load TenantIQ assessments.'));
  }, []);

  async function uploadAssessment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'csv' && extension !== 'json') {
      setError('TenantIQ assessment uploads must be CSV or JSON files.');
      return;
    }

    setUploading(true);
    setUploadStatus(`Uploading ${file.name}…`);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      const response = await fetch(UPLOAD_API, { method: 'POST', body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || 'TenantIQ could not import this assessment.');

      const uploaded = payload as AssessmentSummary;
      await refreshAssessments(uploaded.assessment_id);
      setMessages([]);
      setQuestion(starterQuestion);
      setUploadStatus(`Imported ${file.name} · ${uploaded.finding_count} findings`);
    } catch (err) {
      setUploadStatus('');
      setError(err instanceof Error ? err.message : 'Unable to upload the TenantIQ assessment.');
    } finally {
      setUploading(false);
    }
  }

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
    if (!trimmed || loading || !activeAssessmentId) return;

    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', content: trimmed }]);
    setQuestion('');
    setLoading(true);
    setError('');
    beginTimer();

    try {
      const response = await fetch(ASSISTANT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, assessment_id: activeAssessmentId }),
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
        findingCount: result.finding_count,
        checkIds: result.check_ids || [],
        sources: result.sources || [],
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
          <p style={{ maxWidth: 760, color: '#aeb8c8', fontSize: 17, lineHeight: 1.65, margin: 0 }}>Upload a TenantIQ assessment, then ask read-only questions grounded in that assessment evidence and the TenantIQ knowledge base.</p>
        </div>

        <div style={{ marginBottom: 22, border: '1px solid rgba(86,160,255,.2)', borderRadius: 16, background: 'rgba(8,22,40,.68)', padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#8fc7ff', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Assessment context</div>
              <div style={{ marginTop: 5, color: '#dfe8f4', fontWeight: 700 }}>{activeAssessment ? assessmentLabel(activeAssessment) : assessmentsLoading ? 'Loading assessments…' : 'No assessment selected'}</div>
              {activeAssessmentId && <div title={activeAssessmentId} style={{ marginTop: 5, color: '#7f8b9a', fontSize: 12 }}>{shortAssessmentId(activeAssessmentId)}</div>}
              {uploadStatus && <div style={{ marginTop: 8, color: '#86e1ad', fontSize: 13, fontWeight: 700 }}>{uploadStatus}</div>}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <select aria-label="Select TenantIQ assessment" value={activeAssessmentId} onChange={(event) => { setActiveAssessmentId(event.target.value); setMessages([]); setError(''); }} disabled={loading || uploading || assessmentsLoading || assessments.length === 0} style={{ minWidth: 300, maxWidth: '100%', borderRadius: 10, border: '1px solid rgba(86,160,255,.3)', background: '#081425', color: '#eaf2fb', padding: '11px 12px' }}>
                {assessments.length === 0 && <option value="">No stored assessments</option>}
                {assessments.map((item) => <option key={item.assessment_id} value={item.assessment_id}>{assessmentLabel(item)}</option>)}
              </select>
              <input ref={fileInputRef} type="file" accept=".csv,.json,text/csv,application/json" onChange={uploadAssessment} style={{ display: 'none' }} />
              <button type="button" disabled={uploading || loading} onClick={() => fileInputRef.current?.click()} style={{ border: '1px solid rgba(86,160,255,.38)', borderRadius: 10, padding: '11px 14px', fontWeight: 800, background: 'rgba(47,135,255,.12)', color: '#b9d8ff', opacity: uploading ? .6 : 1 }}>{uploading ? 'Uploading…' : 'Upload assessment'}</button>
            </div>
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
              <div style={{ lineHeight: 1.72, color: '#e7edf5', fontSize: 15 }}>{message.role === 'assistant' ? formatAssistantAnswer(message.content) : message.content}</div>
              <EvidencePanel message={message} />
            </article>
          </div>)}
        </div>}

        {loading && <div style={{ marginBottom: 18, borderRadius: 14, border: '1px solid rgba(244,196,48,.24)', background: 'rgba(244,196,48,.07)', padding: 16, color: '#f4d35e' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 9, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800 }}>TenantIQ is analyzing the assessment…</div>
            <div style={{ fontSize: 13, color: '#d7c67a' }}>{progressPercent}% · {elapsed}s</div>
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} aria-label="TenantIQ analysis progress" style={{ height: 10, borderRadius: 999, overflow: 'hidden', background: 'rgba(244,196,48,.12)', border: '1px solid rgba(244,196,48,.2)' }}>
            <div style={{ height: '100%', width: `${progressPercent}%`, borderRadius: 999, background: 'linear-gradient(90deg,#f4c430,#ffd95a)', transition: 'width 600ms ease' }} />
          </div>
          <div style={{ color: '#d7c67a', fontSize: 14, marginTop: 9 }}>{progressText}</div>
          {elapsed >= 45 && <div style={{ color: '#b6aa70', fontSize: 12, marginTop: 5 }}>Larger assessments can take over a minute while TenantIQ grounds the answer against assessment evidence.</div>}
        </div>}
        {error && <div style={{ marginBottom: 18, borderRadius: 14, border: '1px solid rgba(255,90,90,.28)', background: 'rgba(255,70,70,.08)', padding: 16, color: '#ffaaaa' }}><strong>TenantIQ could not complete the request.</strong><div style={{ marginTop: 5 }}>{error}</div></div>}

        <form onSubmit={submit} style={{ background: 'rgba(8,22,40,.9)', border: '1px solid rgba(86,160,255,.24)', borderRadius: 18, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.24)', position: hasConversation ? 'sticky' : 'static', bottom: 18 }}>
          <label htmlFor="tenantiq-question" style={{ display: 'block', fontWeight: 750, marginBottom: 10 }}>{hasConversation ? 'Ask a follow-up' : 'Question'}</label>
          <textarea id="tenantiq-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (canSubmit) event.currentTarget.form?.requestSubmit(); } }} rows={hasConversation ? 3 : 5} disabled={loading || uploading || !activeAssessmentId} placeholder={activeAssessmentId ? 'Ask about risks, findings, evidence, or recommended remediation…' : 'Upload or select an assessment to begin…'} style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', borderRadius: 12, border: '1px solid rgba(139,149,165,.3)', background: '#081425', color: '#f5f8fc', padding: 16, font: 'inherit', lineHeight: 1.5, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="submit" disabled={!canSubmit || uploading} style={{ border: 0, borderRadius: 10, padding: '12px 18px', fontWeight: 800, background: '#2f87ff', color: 'white', opacity: canSubmit && !uploading ? 1 : .55 }}>{loading ? 'Analyzing assessment…' : hasConversation ? 'Send follow-up' : 'Ask TenantIQ'}</button>
            <button type="button" disabled={loading || uploading || !activeAssessmentId} onClick={() => setQuestion('Explain ENTRA-MFA-001 and tell me what needs to be fixed.')} style={{ border: '1px solid rgba(86,160,255,.3)', borderRadius: 10, padding: '12px 18px', fontWeight: 700, background: 'transparent', color: '#b9d8ff', opacity: activeAssessmentId && !uploading ? 1 : .55 }}>Try MFA finding</button>
            <span style={{ color: '#7f8b9a', fontSize: 12 }}>Enter to send · Shift+Enter for a new line</span>
          </div>
        </form>
      </div>
    </section>
  );
}
