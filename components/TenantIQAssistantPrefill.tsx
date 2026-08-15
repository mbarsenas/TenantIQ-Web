'use client';

import { useEffect } from 'react';

const COOKIE_NAME = 'tenantiq_prefill_question';

function readCookie(name: string) {
  const prefix = `${name}=`;
  const value = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : '';
}

function questionFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const explicitQuestion = params.get('question')?.trim();
  if (explicitQuestion) return explicitQuestion;

  const finding = params.get('finding')?.trim();
  if (finding) return `Explain ${finding}, why it matters, and what needs to be fixed.`;

  return '';
}

export default function TenantIQAssistantPrefill() {
  useEffect(() => {
    const question = questionFromQuery() || readCookie(COOKIE_NAME);
    if (!question) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const textarea = document.getElementById('tenantiq-question') as HTMLTextAreaElement | null;
      if (textarea) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        setter?.call(textarea, question);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.focus();
        document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
        window.clearInterval(timer);
      } else if (attempts >= 30) {
        window.clearInterval(timer);
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, []);

  return null;
}
