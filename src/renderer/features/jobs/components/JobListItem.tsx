import React from 'react';
import type { Job } from '@shared/types/domain';
import { useJobStore, type JobRuntimeStatus } from '../store';

const STATUS_LABEL: Record<JobRuntimeStatus, string> = {
  idle: '대기',
  pending: '대기 중',
  running: '생성 중',
  succeeded: '성공',
  failed: '실패',
};

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
        background: active ? 'var(--selected-bg)' : 'transparent',
        color: 'var(--text)',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onClick={e => e.stopPropagation()}
        onChange={() => toggleCheck(job.id)}
      />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.name}</span>
      <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
    </li>
  );
}
