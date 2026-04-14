import React from 'react';
import type { Asset, ImageSlot } from '@shared/types/domain';
import { ImageThumbnail } from './ImageThumbnail';

export function ImageSlotCard(props: {
  slot: ImageSlot & { asset: Asset };
  onClick: () => void;
}) {
  const { slot, onClick } = props;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', gap: 8, alignItems: 'center',
        border: '1px solid var(--border-soft)',
        padding: 6, borderRadius: 6, marginBottom: 6,
        background: 'var(--bg-subtle)',
        color: 'var(--text)',
        width: '100%', textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <ImageThumbnail assetId={slot.assetId} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <code style={{ fontSize: 13 }}>{`{${slot.variableName}}`}</code>
        <span style={{
          fontSize: 12, color: 'var(--text-muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {slot.description || '설명 없음'}
        </span>
      </div>
      <span aria-hidden style={{ color: 'var(--text-muted)', fontSize: 12 }}>편집 ›</span>
    </button>
  );
}
