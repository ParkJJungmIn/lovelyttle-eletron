import React, { useEffect, useState } from 'react';
import { ipc } from '@/ipc-client';

export function ImageThumbnail({ assetId, size = 64 }: { assetId: string; size?: number }) {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    void ipc.asset.getDataUrl(assetId).then(r => { if (!cancelled) setSrc(r.dataUrl); });
    return () => { cancelled = true; };
  }, [assetId]);
  if (!src) return <div style={{ width: size, height: size, background: '#eee' }} />;
  return <img src={src} width={size} height={size} style={{ objectFit: 'cover', borderRadius: 4 }} />;
}
