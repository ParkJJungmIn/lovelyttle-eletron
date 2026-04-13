import React, { useState } from 'react';
import { useJobStore } from '../store';

export function JobToolbar({ templateId }: { templateId: string }) {
  const { create, checkedIds, runSelected } = useJobStore();
  const [name, setName] = useState('');
  const count = checkedIds.size;

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="New job name" style={{ flex: 1 }} />
      <button
        disabled={!name.trim()}
        onClick={async () => { await create(templateId, name.trim()); setName(''); }}
      >+</button>
      <button
        disabled={count === 0}
        onClick={() => { if (confirm(`Generate ${count} selected job(s)?`)) void runSelected(); }}
      >
        ▶ Generate ({count})
      </button>
    </div>
  );
}
