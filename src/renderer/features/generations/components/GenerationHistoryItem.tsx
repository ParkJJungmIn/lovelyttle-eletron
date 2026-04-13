import React, { useState } from 'react';
import type { Generation } from '@shared/types/domain';
import { ipc } from '@/ipc-client';
import { ImageThumbnail } from '@/features/slots/components/ImageThumbnail';
import { GenerationViewerDialog } from './GenerationViewerDialog';

export function GenerationHistoryItem({ generation }: { generation: Generation }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const ts = new Date(generation.startedAt).toLocaleString();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #eee', padding: '6px 0' }}>
      {generation.resultAssetId
        ? <div onClick={() => setViewerOpen(true)} style={{ cursor: 'zoom-in' }}><ImageThumbnail assetId={generation.resultAssetId} size={48} /></div>
        : <div style={{ width: 48, height: 48, background: '#fcc', display: 'grid', placeItems: 'center', borderRadius: 4 }}>✗</div>
      }
      <div style={{ flex: 1, fontSize: 12 }}>
        <div>{ts}</div>
        <div style={{ opacity: 0.7 }}>{generation.status}{generation.errorMessage ? ` — ${generation.errorMessage}` : ''}</div>
      </div>
      {generation.resultAssetId && (
        <button onClick={async () => { await ipc.generation.export(generation.id); }}>Export</button>
      )}
      <GenerationViewerDialog assetId={viewerOpen ? generation.resultAssetId : null} onClose={() => setViewerOpen(false)} />
    </div>
  );
}
