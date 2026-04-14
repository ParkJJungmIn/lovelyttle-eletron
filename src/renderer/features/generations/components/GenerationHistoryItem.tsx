import React, { useState } from 'react';
import type { Generation, GenerationStatus } from '@shared/types/domain';
import { ipc } from '@/ipc-client';
import { ImageThumbnail } from '@/features/slots/components/ImageThumbnail';
import { GenerationViewerDialog } from './GenerationViewerDialog';

const STATUS_LABEL: Record<GenerationStatus, string> = {
  pending: '대기 중',
  running: '생성 중',
  succeeded: '성공',
  failed: '실패',
};

export function GenerationHistoryItem({ generation }: { generation: Generation }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const ts = new Date(generation.startedAt).toLocaleString();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-soft)', padding: '6px 0' }}>
      {generation.resultAssetId
        ? <div onClick={() => setViewerOpen(true)} style={{ cursor: 'zoom-in' }}><ImageThumbnail assetId={generation.resultAssetId} size={48} /></div>
        : <div style={{ width: 48, height: 48, background: 'var(--error-bg)', color: 'var(--error-fg)', display: 'grid', placeItems: 'center', borderRadius: 4 }}>✗</div>
      }
      <div style={{ flex: 1, fontSize: 12 }}>
        <div>{ts}</div>
        <div style={{ color: 'var(--text-muted)' }}>{STATUS_LABEL[generation.status]}{generation.errorMessage ? ` — ${generation.errorMessage}` : ''}</div>
      </div>
      {generation.resultAssetId && (
        <button onClick={async () => { await ipc.generation.export(generation.id); }}>내보내기</button>
      )}
      <GenerationViewerDialog assetId={viewerOpen ? generation.resultAssetId : null} onClose={() => setViewerOpen(false)} />
    </div>
  );
}
