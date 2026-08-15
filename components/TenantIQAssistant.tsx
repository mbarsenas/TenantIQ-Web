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
const starterQuestion = 'What are the biggest problems in this assessment and what should be fixed first?';

async function readJsonResponse(response: Response): Promise<any> {
  const body = await response.text();
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    if (/^\s*<!doctype|^\s*<html/i.test(body) || response.status >= 500) {
      throw new Error('TenantIQ is temporarily unavailable or the assistant service is waking up. Please try again in a moment.');
    }
    throw new Error('TenantIQ received an unexpected response from the assistant service.');
  }
}

function workloadFromName(name: string) {
  const value = name.toLowerCase();
  if (value.includes('exchange')) return 'Exchange Online';
  if (value.includes('entra') || value.includes('azuread') || value.includes('azure-ad')) return 'Entra ID';
  if (value.includes('sharepoint')) return 'SharePoint Online';
  if (value.includes('teams')) return 'Teams';
  if (value.includes('onedrive')) return 'OneDrive';
  if (value.includes('intune')) return 'Intune';
  if (value.includes('defender')) return 'Defender';
  if (value.includes('purview')) return 'Microsoft Purview';
  return 'TenantIQ assessment';
}

function assessmentLabel(item: AssessmentSummary) {
  const source = item.source_name || item.assessment_id;
  return `${workloadFromName(source)} · ${item.finding_count} findings`;
}

function shortId(value: string) {
  return value.length > 44 ? `${value.slice(0, 41)}…` : value;
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
  return sourceHeadingIndex < 0 ? content : lines.slice(0, sourceHeadingIndex).join('\n').trimEnd();
}

function formatAssistantAnswer(content: string) {
  return contentWithoutSources(content).split(/\r?\n/).map((line, index) => {
    const trimmed = line.trim();
    const isHeading = trimmed.length > 0 && !trimmed.startsWith('-') && !trimmed.startsWith('•') &&
      (/^(Biggest problems|Why this matters|What should be fixed first|Recommended remediation|Priority|Next steps|Key findings)/i.test(trimmed) ||
       (index === 0 && trimmed.length <= 72 && !/[.!?]$/.test(trimmed)));
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
  if (!checkIds.length && !sources.length && !message.findingCount) return null;

  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(86,160,255,.16)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={eyebrowStyle}>Evidence</span>
        {message.findingCount ? <span style={badgeStyle}>{message.findingCount} findings analyzed</span> : null}
      </div>
      {checkIds.length ? <div style={{ marginTop: 10 }}>
        <div style={smallLabelStyle}>Assessment findings referenced</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{checkIds.map((id) => <span key={id} style={checkBadgeStyle}>{id}</span>)}</div>
      </div> : null}
      <div style={{ marginTop: 12 }}>
        <div style={smallLabelStyle}>Knowledge sources</div>
        {sources.length ? <div style={{ display: 'grid', gap: 6 }}>{sources.map((source) => <div key={source} title={source} style={{ color: '#9ca8b8', fontSize: 12, overflowWrap: 'anywhere' }}>↳ {source}</div>)}</div> : <div style={{ color: '#748093', fontSize: 12, lineHeight: 1.45 }}>This answer was grounded in the selected assessment findings.</div>}
      </div>
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
  const activeAssessment = useMemo(() => assessments.find((item) => item.assessment_id === activeAssessmentId), [assessments, activeAssessmentId]);
  const activeSource = activeAssessment?.source_name || activeAssessment?.assessment_id || '';
  const activeWorkload = activeSource ? workloadFromName(activeSource) : '';
  const canSubmit = Boolean(question.trim()) && !loading && !uploading && Boolean(activeAssessmentId);
  const progressPercent = progressForElapsed(elapsed);

  async function refreshAssessments(preferredAssessmentId?: string) {
    setAssessmentsLoading(true);
    try {
      const response = await fetch(ASSESSMENTS_API, { cache: 'no-store' });
      const payload = await readJsonResponse(response);
      if (!response.ok) throw new Error(payload?.detail || 'Unable to load TenantIQ assessments.');
      const items = Array.isArray(payload) ? payload as AssessmentSummary[] : [];
      items.sort((a, b) => new Date(b.imported_at || 0).getTime() - new Date(a.imported_at || 0).getTime());
      setAssessments(items);
      if (preferredAssessmentId && items.some((item) => item.assessment_id === preferredAssessmentId)) setActiveAssessmentId(preferredAssessmentId);
      else if (items.length) setActiveAssessmentId((current) => current && items.some((item) => item.assessment_id === current) ? current : items[0].assessment_id);
      else setActiveAssessmentId('');
    } finally {
      setAssessmentsLoading(false);
    }
  }

  useEffect(() => {
    refreshAssessments().catch((err) => setError(err instanceof Error ? err.message : 'Unable to load TenantIQ assessments.'));
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
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
    setUploadStatus(`Uploading ${file.name}…`);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      const response = await fetch(UPLOAD_API, { method: 'POST', body: formData });
      const payload = await readJsonResponse(response);
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
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || !activeAssessmentId || loading) return;

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
      const payload = await readJsonResponse(response);
      if (!response.ok) throw new Error(payload?.detail || 'TenantIQ assistant request failed.');
      const result = payload as AskResponse;
      setActiveAssessmentId(result.assessment_id);
      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.answer,
        route: result.route === 'specific_finding' ? 'Specific finding' : 'Assessment overview',
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

  function choosePrompt(value: string) {
    setQuestion(value);
    requestAnimationFrame(() => document.getElementById('tenantiq-question')?.focus());
  }

  function resetConversation() {
    setMessages([]);
    setError('');
    setElapsed(0);
    setQuestion(starterQuestion);
  }

  return (
    <section style={{ color: '#f3f6fb', padding: '36px 20px 64px' }}>
      <div style={{ width: 'min(1120px,100%)', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 26 }}>
          <div>
            <div style={eyebrowStyle}>TenantIQ Assistant</div>
            <h1 style={{ fontSize: 'clamp(34px,6vw,54px)', lineHeight: 1.05, margin: '10px 0 12px' }}>Ask questions about your assessment.</h1>
            <p style={{ maxWidth: 780, color: '#aeb8c8', fontSize: 16, lineHeight: 1.65, margin: 0 }}>TenantIQ answers read-only questions using the selected assessment and available knowledge context. It does not make changes to your Microsoft 365 tenant.</p>
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <a href="/assessments" style={secondaryLinkStyle}>Assessment history</a>
            {hasConversation ? <button type="button" onClick={resetConversation} disabled={loading} style={buttonSecondaryStyle}>New conversation</button> : null}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 18, alignItems: 'center', marginBottom: 18, ...panelStyle }}>
          <div style={{ minWidth: 0 }}>
            <div style={eyebrowStyle}>Assessment context</div>
            <div style={{ marginTop: 7, color: '#e6eef8', fontWeight: 800 }}>{activeAssessment ? assessmentLabel(activeAssessment) : assessmentsLoading ? 'Loading assessments…' : 'No stored assessment selected'}</div>
            {activeAssessmentId ? <div title={activeAssessmentId} style={{ marginTop: 5, color: '#74869b', fontSize: 12 }}>{shortId(activeAssessmentId)}</div> : null}
            {uploadStatus ? <div style={{ marginTop: 7, color: '#86e1ad', fontSize: 13, fontWeight: 750 }}>{uploadStatus}</div> : null}
          </div>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <select value={activeAssessmentId} onChange={(event) => { setActiveAssessmentId(event.target.value); setMessages([]); setError(''); setQuestion(starterQuestion); }} disabled={loading || uploading || assessmentsLoading || assessments.length === 0} aria-label="Select TenantIQ assessment" style={selectStyle}>
              {assessments.length === 0 ? <option value="">No stored assessments</option> : null}
              {assessments.map((item) => <option key={item.assessment_id} value={item.assessment_id}>{assessmentLabel(item)}</option>)}
            </select>
            {activeAssessmentId ? <a href={`/assessments/${encodeURIComponent(activeAssessmentId)}`} style={secondaryLinkStyle}>View findings</a> : null}
            <input ref={fileInputRef} type="file" accept=".csv,.json,text/csv,application/json" onChange={uploadAssessment} style={{ display: 'none' }} />
            <button type="button" disabled={uploading || loading} onClick={() => fileInputRef.current?.click()} style={buttonSecondaryStyle}>{uploading ? 'Uploading…' : 'Upload assessment'}</button>
          </div>
        </div>

        {!activeAssessmentId && !assessmentsLoading ? <div style={{ ...panelStyle, marginBottom: 18 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 21 }}>Upload an assessment to begin</h2>
          <p style={{ margin: '0 0 16px', color: '#96a6b8', lineHeight: 1.6 }}>The Assistant needs a stored TenantIQ CSV or JSON assessment before it can answer grounded questions.</p>
          <button type="button" onClick={() => fileInputRef.current?.click()} style={primaryButtonStyle}>Upload assessment</button>
        </div> : null}

        {activeAssessmentId && !hasConversation ? <div style={{ ...panelStyle, marginBottom: 18 }}>
          <div style={eyebrowStyle}>Suggested questions{activeWorkload ? ` · ${activeWorkload}` : ''}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, marginTop: 12 }}>
            <PromptButton text="Prioritize the biggest risks" onClick={() => choosePrompt('What are the highest-priority risks in this assessment, and what should be fixed first?')} />
            <PromptButton text="Explain failed checks" onClick={() => choosePrompt('Explain the failed and warning findings in this assessment in plain language and why they matter.')} />
            <PromptButton text="Build a remediation plan" onClick={() => choosePrompt('Create a prioritized remediation plan for this assessment, starting with the highest-risk findings.')} />
          </div>
        </div> : null}

        {hasConversation ? <div style={{ display: 'grid', gap: 16, marginBottom: 22 }}>
          {messages.map((message) => <div key={message.id} style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <article style={{ width: message.role === 'user' ? 'min(760px,88%)' : 'min(920px,96%)', borderRadius: 18, border: message.role === 'user' ? '1px solid rgba(47,135,255,.34)' : '1px solid rgba(86,160,255,.18)', background: message.role === 'user' ? 'rgba(47,135,255,.14)' : 'rgba(8,22,40,.82)', padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                <strong style={{ color: message.role === 'user' ? '#b9d8ff' : '#f4f7fb', fontSize: 13 }}>{message.role === 'user' ? 'You' : 'TenantIQ'}</strong>
                {message.role === 'assistant' && message.route ? <span style={badgeStyle}>{message.route}</span> : null}
              </div>
              <div style={{ lineHeight: 1.72, color: '#e7edf5', fontSize: 15 }}>{message.role === 'assistant' ? formatAssistantAnswer(message.content) : message.content}</div>
              <EvidencePanel message={message} />
            </article>
          </div>)}
        </div> : null}

        {loading ? <div role="dialog" aria-modal="true" aria-label="TenantIQ assessment analysis progress" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(2,8,18,.68)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}>
          <div style={{ width: 'min(540px,calc(100vw - 40px))', borderRadius: 22, border: '1px solid rgba(110,181,255,.58)', background: 'linear-gradient(180deg,rgba(10,28,52,.98) 0%,rgba(7,20,38,.99) 100%)', padding: '30px 30px 28px', color: '#f3f7fc', boxShadow: '0 28px 90px rgba(0,0,0,.62), 0 0 0 1px rgba(47,135,255,.08)', textAlign: 'center' }}>
            <div aria-hidden="true" style={{ width: 66, height: 66, margin: '0 auto 18px', borderRadius: '50%', border: '2px solid #4c9cff', display: 'grid', placeItems: 'center', color: '#b9d8ff', background: 'rgba(47,135,255,.10)', boxShadow: '0 0 32px rgba(47,135,255,.18)', fontSize: 30 }}>✦</div>
            <strong style={{ display: 'block', fontSize: 20, lineHeight: 1.3, color: '#f7fbff' }}>TenantIQ is analyzing the assessment…</strong>
            <div style={{ marginTop: 10, color: '#aebdce', fontSize: 14 }}>{progressLabel(elapsed)}</div>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} style={{ height: 10, borderRadius: 999, overflow: 'hidden', background: 'rgba(110,181,255,.16)', marginTop: 24 }}>
              <div style={{ height: '100%', width: `${progressPercent}%`, borderRadius: 999, background: 'linear-gradient(90deg,#2f87ff,#6eb5ff)', boxShadow: '0 0 18px rgba(47,135,255,.45)', transition: 'width 600ms ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, color: '#91a7bf', fontSize: 13 }}>
              <span>{progressPercent}% complete</span><span aria-hidden="true">·</span><span>{elapsed}s</span>
            </div>
          </div>
        </div> : null}

        {error ? <div style={{ marginBottom: 18, borderRadius: 14, border: '1px solid rgba(255,90,90,.28)', background: 'rgba(255,70,70,.08)', padding: 16, color: '#ffaaaa' }}><strong>TenantIQ could not complete the request.</strong><div style={{ marginTop: 5 }}>{error}</div></div> : null}

        <form onSubmit={submit} style={{ ...panelStyle, position: 'relative', zIndex: 1, boxShadow: '0 20px 60px rgba(0,0,0,.24)' }}>
          <label htmlFor="tenantiq-question" style={{ display: 'block', fontWeight: 800, marginBottom: 10 }}>{hasConversation ? 'Ask a follow-up' : 'Question'}</label>
          <textarea id="tenantiq-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (canSubmit) event.currentTarget.form?.requestSubmit(); } }} rows={hasConversation ? 3 : 5} disabled={loading || uploading || !activeAssessmentId} placeholder={activeAssessmentId ? 'Ask about risks, findings, evidence, or remediation…' : 'Select or upload an assessment to begin…'} style={textareaStyle} />
          <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="submit" disabled={!canSubmit} style={{ ...primaryButtonStyle, opacity: canSubmit ? 1 : .55 }}>{loading ? 'Analyzing assessment…' : hasConversation ? 'Send follow-up' : 'Ask TenantIQ'}</button>
            <span style={{ color: '#7f8b9a', fontSize: 12 }}>Enter to send · Shift+Enter for a new line</span>
          </div>
        </form>
      </div>
    </section>
  );
}

function PromptButton({ text, onClick }: { text: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} style={{ textAlign: 'left', border: '1px solid rgba(86,160,255,.18)', borderRadius: 12, background: 'rgba(47,135,255,.06)', color: '#cfe5ff', padding: '13px 14px', fontWeight: 750, cursor: 'pointer' }}>{text} →</button>;
}

const panelStyle = { border: '1px solid rgba(86,160,255,.18)', borderRadius: 16, background: 'rgba(8,22,40,.72)', padding: 18 };
const eyebrowStyle = { color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' as const };
const smallLabelStyle = { color: '#98a6b8', fontSize: 11, fontWeight: 700, marginBottom: 7 };
const badgeStyle = { borderRadius: 999, padding: '5px 9px', background: 'rgba(47,135,255,.12)', color: '#9dcbff', fontSize: 11, fontWeight: 800 };
const checkBadgeStyle = { borderRadius: 8, padding: '5px 8px', border: '1px solid rgba(86,160,255,.22)', background: 'rgba(86,160,255,.06)', color: '#c6dcf7', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };
const selectStyle = { minWidth: 280, maxWidth: '100%', borderRadius: 10, border: '1px solid rgba(86,160,255,.3)', background: '#081425', color: '#eaf2fb', padding: '10px 12px' };
const textareaStyle = { width: '100%', resize: 'vertical' as const, boxSizing: 'border-box' as const, borderRadius: 12, border: '1px solid rgba(139,149,165,.3)', background: '#081425', color: '#f5f8fc', padding: 16, font: 'inherit', lineHeight: 1.5, outline: 'none' };
const primaryButtonStyle = { border: 0, borderRadius: 10, padding: '11px 16px', fontWeight: 850, background: '#2f87ff', color: '#fff', cursor: 'pointer', textDecoration: 'none' };
const buttonSecondaryStyle = { border: '1px solid rgba(86,160,255,.28)', borderRadius: 10, padding: '10px 13px', fontWeight: 800, background: 'transparent', color: '#b9d8ff', cursor: 'pointer' };
const secondaryLinkStyle = { display: 'inline-block', borderRadius: 10, padding: '9px 12px', border: '1px solid rgba(86,160,255,.26)', color: '#8fc7ff', fontSize: 12, fontWeight: 850, textDecoration: 'none', whiteSpace: 'nowrap' as const };
