import React, { useState } from 'react';
import { useJobStore } from '../store';

export function JobToolbar({ templateId }: { templateId: string }) {
  const { create, checkedIds, runSelected } = useJobStore();
  const [name, setName] = useState('');
  const count = checkedIds.size;

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="새 잡 이름" style={{ flex: 1, minWidth: 0 }} />
      <button
        disabled={!name.trim()}
        onClick={async () => { await create(templateId, name.trim()); setName(''); }}
      >+</button>
      <button
        disabled={count === 0}
        onClick={() => { if (confirm(`선택한 잡 ${count}개를 생성할까요?`)) void runSelected(); }}
      >
        ▶ 생성 ({count})
      </button>
    </div>
  );
}
