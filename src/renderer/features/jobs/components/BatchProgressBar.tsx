import React from 'react';
import { useJobStore } from '../store';

export function BatchProgressBar() {
  const statuses = useJobStore(s => s.statusByJobId);
  const entries = Object.values(statuses);
  const running = entries.filter(s => s === 'running' || s === 'pending').length;
  if (running === 0) return null;
  return (
    <div style={{ background: '#cdf', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>
      {running} in progress…
    </div>
  );
}
