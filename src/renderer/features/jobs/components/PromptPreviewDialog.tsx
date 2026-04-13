import React, { useEffect, useState } from 'react';
import { ipc } from '@/ipc-client';
import { ImageThumbnail } from '@/features/slots/components/ImageThumbnail';

export function PromptPreviewDialog({ jobId, open, onClose }: { jobId: string; open: boolean; onClose: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof ipc.prompt.compose>> | null>(null);

  useEffect(() => {
    if (!open) return;
    setData(null);
    void ipc.prompt.compose(jobId).then(setData);
  }, [open, jobId]);

  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0007', display: 'grid', placeItems: 'center', zIndex: 10 }}>
      <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 600, maxHeight: '80vh', overflow: 'auto' }}>
        <h3>Prompt preview</h3>
        {!data && <p>Composing…</p>}
        {data && (
          <>
            <h4>Final prompt</h4>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: 8 }}>{data.finalPrompt || '(empty)'}</pre>
            <h4>Attached images</h4>
            {data.imageRefs.length === 0 && <p>(none)</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.imageRefs.map(r => (
                <div key={r.assetId + r.variableName} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <ImageThumbnail assetId={r.assetId} size={48} />
                  <div style={{ fontSize: 12 }}>
                    <div><code>{`{${r.variableName}}`}</code></div>
                    <div style={{ opacity: 0.7 }}>{r.description || <em>no description</em>}</div>
                  </div>
                </div>
              ))}
            </div>
            {data.warnings.length > 0 && (
              <>
                <h4>Warnings</h4>
                <ul>{data.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </>
            )}
          </>
        )}
        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
