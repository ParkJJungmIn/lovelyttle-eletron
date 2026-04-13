import React, { useCallback, useEffect, useState } from 'react';
import type { Generation } from '@shared/types/domain';
import { ipc } from '@/ipc-client';
import { useJobStore } from '@/features/jobs/store';
import { GenerationHistoryItem } from './GenerationHistoryItem';

export function GenerationHistoryList({ jobId }: { jobId: string }) {
  const [items, setItems] = useState<Generation[]>([]);
  const statuses = useJobStore(s => s.statusByJobId);

  const reload = useCallback(async () => {
    setItems(await ipc.generation.listByJob(jobId));
  }, [jobId]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { void reload(); }, [statuses[jobId], reload]);

  if (items.length === 0) return <p style={{ opacity: 0.6, fontSize: 12 }}>No generations yet.</p>;
  return <div>{items.map(g => <GenerationHistoryItem key={g.id} generation={g} />)}</div>;
}
