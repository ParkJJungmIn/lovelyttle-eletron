import React, { useEffect, useState } from 'react';
import type { Job } from '@shared/types/domain';
import { useJobStore } from '../store';

export function JobPromptEditor({ job }: { job: Job }) {
  const update = useJobStore(s => s.update);
  const [value, setValue] = useState(job.prompt);
  useEffect(() => { setValue(job.prompt); }, [job.id, job.prompt]);

  return (
    <textarea
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => value !== job.prompt && void update(job.id, { prompt: value })}
      rows={6}
      style={{ width: '100%' }}
      placeholder="Job-specific prompt. Use {variableName} to reference images."
    />
  );
}
