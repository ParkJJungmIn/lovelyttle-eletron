import React from 'react';
import type { Job } from '@shared/types/domain';
import { useJobStore } from '../store';

export function JobListItem({ job }: { job: Job }) {
  const { selectedId, checkedIds, statusByJobId, select, toggleCheck } = useJobStore();
  const status = statusByJobId[job.id] ?? 'idle';
  const active = selectedId === job.id;
  const checked = checkedIds.has(job.id);

  return (
    <li
      onClick={() => select(job.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 6px', borderRadius: 4, cursor: 'pointer',
        background: active ? '#cdf' : 'transparent',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onClick={e => e.stopPropagation()}
        onChange={() => toggleCheck(job.id)}
      />
      <span style={{ flex: 1 }}>{job.name}</span>
      <span className={`badge badge-${status}`}>{status}</span>
    </li>
  );
}
