'use client';

import { useEffect } from 'react';

const STATE_LABELS: Record<string, string> = {
  'NEEDS REVIEW': 'Needs review',
  'IN PROGRESS': 'Mark in progress',
  'READY TO VALIDATE': 'Ready to validate',
};

export default function TenantIQWorkflowStateUx() {
  useEffect(() => {
    function syncWorkflowButtons() {
      const articles = Array.from(document.querySelectorAll('article'));

      for (const article of articles) {
        const pill = Array.from(article.querySelectorAll('span')).find((node) =>
          ['NEEDS REVIEW', 'IN PROGRESS', 'READY TO VALIDATE'].includes((node.textContent || '').trim()),
        );
        if (!pill) continue;

        const currentState = (pill.textContent || '').trim();
        const buttons = Array.from(article.querySelectorAll('button'));

        for (const button of buttons) {
          const original = button.dataset.workflowLabel || (button.textContent || '').trim();
          if (!button.dataset.workflowLabel && ['Needs review', 'Mark in progress', 'Ready to validate'].includes(original)) {
            button.dataset.workflowLabel = original;
          }
          const label = button.dataset.workflowLabel;
          if (!label) continue;

          const expectedLabel = STATE_LABELS[currentState];
          const isCurrent = label === expectedLabel;
          button.disabled = isCurrent;
          button.setAttribute('aria-current', isCurrent ? 'step' : 'false');
          button.textContent = isCurrent ? `Current: ${label.replace(/^Mark /, '')}` : label;
          button.style.cursor = isCurrent ? 'default' : 'pointer';
          button.style.opacity = isCurrent ? '0.72' : '1';
        }
      }
    }

    syncWorkflowButtons();
    const observer = new MutationObserver(syncWorkflowButtons);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
