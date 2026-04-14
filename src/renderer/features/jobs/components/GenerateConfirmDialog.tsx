import React from 'react';

export function GenerateConfirmDialog(props: {
  open: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!props.open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'grid', placeItems: 'center', zIndex: 10 }}>
      <div style={{ background: 'var(--bg-elevated)', color: 'var(--text)', padding: 16, borderRadius: 8, minWidth: 280, border: '1px solid var(--border-soft)' }}>
        <p>잡 {props.count}개를 생성할까요? Gemini API를 {props.count}회 호출합니다.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={props.onCancel}>취소</button>
          <button onClick={props.onConfirm}>생성</button>
        </div>
      </div>
    </div>
  );
}
