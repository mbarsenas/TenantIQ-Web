'use client';

import { useEffect } from 'react';

export default function TenantIQWorkflowFocus({ finding }: { finding?: string }) {
  useEffect(() => {
    if (!finding) return;

    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scrollToFinding = () => {
      const target = document.getElementById('focused-remediation');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      attempts += 1;
      if (attempts < 40) timer = setTimeout(scrollToFinding, 125);
    };

    timer = setTimeout(scrollToFinding, 100);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [finding]);

  return null;
}
