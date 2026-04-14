import React from 'react';
import { useJobStore } from '../store';

export function BatchProgressBar() {
  const statuses = useJobStore(s => s.statusByJobId);
  const entries = Object.values(statuses);
  const running = entries.filter(s => s === 'running' || s === 'pending').length;
  if (running === 0) return null;
  return (
    <div style={{ background: 'var(--badge-running-bg)', color: 'var(--badge-running-fg)', padding: '4px 8px', borderRadius: 4, fontSize: 12, marginBottom: 6 }}>
      {running}개 생성 중…
    </div>
  );
}
