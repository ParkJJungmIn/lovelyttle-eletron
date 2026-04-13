import React, { useEffect, useState } from 'react';
import { ipc } from '@/ipc-client';

export function GenerationViewerDialog(props: { assetId: string | null; onClose: () => void }) {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    if (!props.assetId) return;
    void ipc.asset.getDataUrl(props.assetId).then(r => setSrc(r.dataUrl));
  }, [props.assetId]);
  if (!props.assetId) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000b', display: 'grid', placeItems: 'center', zIndex: 10 }}
         onClick={props.onClose}>
      {src && <img src={src} style={{ maxWidth: '90vw', maxHeight: '90vh' }} />}
    </div>
  );
}
