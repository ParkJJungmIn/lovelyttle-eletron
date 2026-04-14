import React, { useState } from 'react';
import type { Asset, ImageSlot } from '@shared/types/domain';
import { ipc } from '@/ipc-client';
import { ImageThumbnail } from './ImageThumbnail';

export function ImageSlotCard(props: {
  slot: ImageSlot & { asset: Asset };
  onChange: () => void;
}) {
  const { slot, onChange } = props;
  const [variableName, setVariableName] = useState(slot.variableName);
  const [description, setDescription] = useState(slot.description);

  const commit = async (patch: Partial<Pick<ImageSlot, 'variableName' | 'description'>>) => {
    await ipc.slot.update(slot.id, patch);
    onChange();
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', border: '1px solid var(--border-soft)', padding: 6, borderRadius: 6, marginBottom: 6, background: 'var(--bg-subtle)' }}>
      <ImageThumbnail assetId={slot.assetId} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <input
          value={variableName}
          onChange={e => setVariableName(e.target.value.replace(/[^\w]/g, ''))}
          onBlur={() => variableName !== slot.variableName && void commit({ variableName })}
          placeholder="변수명"
        />
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={() => description !== slot.description && void commit({ description })}
          placeholder="설명 (선택)"
        />
      </div>
      <button onClick={async () => { if (confirm('이 이미지를 삭제할까요?')) { await ipc.slot.delete(slot.id); onChange(); } }}>🗑</button>
    </div>
  );
}
