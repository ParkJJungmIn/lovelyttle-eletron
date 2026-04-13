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
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', border: '1px solid #ccc5', padding: 6, borderRadius: 6, marginBottom: 6 }}>
      <ImageThumbnail assetId={slot.assetId} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input
          value={variableName}
          onChange={e => setVariableName(e.target.value.replace(/[^\w]/g, ''))}
          onBlur={() => variableName !== slot.variableName && void commit({ variableName })}
          placeholder="variableName"
        />
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={() => description !== slot.description && void commit({ description })}
          placeholder="description (optional)"
        />
      </div>
      <button onClick={async () => { await ipc.slot.delete(slot.id); onChange(); }}>🗑</button>
    </div>
  );
}
