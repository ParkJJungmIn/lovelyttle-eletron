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
      style={{ width: '100%', boxSizing: 'border-box' }}
      placeholder="이 잡 전용 프롬프트. {변수명} 형식으로 이미지를 참조할 수 있습니다."
    />
  );
}
