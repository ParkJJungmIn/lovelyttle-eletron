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
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'grid', placeItems: 'center', zIndex: 10 }}>
      <div style={{ background: 'var(--bg-elevated)', color: 'var(--text)', padding: 16, borderRadius: 8, width: 600, maxHeight: '80vh', overflow: 'auto', border: '1px solid var(--border-soft)' }}>
        <h3 style={{ marginTop: 0 }}>프롬프트 미리보기</h3>
        {!data && <p>조합 중…</p>}
        {data && (
          <>
            <h4>최종 프롬프트</h4>
            <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-subtle)', color: 'var(--text)', padding: 8, borderRadius: 4 }}>{data.finalPrompt || '(비어 있음)'}</pre>
            <h4>첨부 이미지</h4>
            {data.imageRefs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>(없음)</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.imageRefs.map(r => (
                <div key={r.assetId + r.variableName} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <ImageThumbnail assetId={r.assetId} size={48} />
                  <div style={{ fontSize: 12 }}>
                    <div><code>{`{${r.variableName}}`}</code></div>
                    <div style={{ color: 'var(--text-muted)' }}>{r.description || <em>설명 없음</em>}</div>
                  </div>
                </div>
              ))}
            </div>
            {data.warnings.length > 0 && (
              <>
                <h4>경고</h4>
                <ul>{data.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </>
            )}
          </>
        )}
        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
