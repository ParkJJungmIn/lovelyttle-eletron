import React, { useEffect, useState } from 'react';
import type { Asset, ImageSlot } from '@shared/types/domain';
import { ipc } from '@/ipc-client';
import { ImageThumbnail } from './ImageThumbnail';

interface Props {
  slot: (ImageSlot & { asset: Asset }) | null;
  onClose: () => void;
  onChanged: () => void;
  existingNames: string[];
}

export function ImageSlotEditDialog({ slot, onClose, onChanged, existingNames }: Props) {
  const [variableName, setVariableName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slot) return;
    setVariableName(slot.variableName);
    setDescription(slot.description);
    setError(null);
  }, [slot?.id]);

  if (!slot) return null;

  const trimmed = variableName.trim();
  const nameConflict = trimmed !== slot.variableName && existingNames.includes(trimmed);
  const canSave = trimmed.length > 0 && !nameConflict && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (trimmed !== slot.variableName || description !== slot.description) {
        await ipc.slot.update(slot.id, { variableName: trimmed, description });
        onChanged();
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('이 이미지를 삭제할까요?')) return;
    await ipc.slot.delete(slot.id);
    onChanged();
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'grid', placeItems: 'center', zIndex: 20 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-elevated)', color: 'var(--text)',
          padding: 20, borderRadius: 8, width: 440,
          border: '1px solid var(--border-soft)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <h3 style={{ margin: 0 }}>이미지 편집</h3>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <ImageThumbnail assetId={slot.assetId} size={96} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {slot.asset.originalFilename ?? '(파일명 없음)'}
            </div>
            <div>{(slot.asset.byteSize / 1024).toFixed(1)} KB · {slot.asset.mimeType}</div>
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>변수명</span>
          <input
            value={variableName}
            onChange={e => setVariableName(e.target.value.replace(/[^\w]/g, ''))}
            placeholder="예: personA"
            autoFocus
          />
          {nameConflict && (
            <span style={{ fontSize: 12, color: 'var(--error-fg)' }}>
              같은 이름의 이미지가 이미 있습니다.
            </span>
          )}
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>설명 (선택)</span>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="예: 이 이미지는 인물의 얼굴 참조용입니다."
            style={{ resize: 'vertical' }}
          />
        </label>

        {error && <div style={{ color: 'var(--error-fg)', fontSize: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
          <button onClick={remove} style={{ color: 'var(--error-fg)' }}>삭제</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}>취소</button>
            <button onClick={save} disabled={!canSave}>저장</button>
          </div>
        </div>
      </div>
    </div>
  );
}
