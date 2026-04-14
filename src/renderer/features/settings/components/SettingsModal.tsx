import React, { useState } from 'react';
import { useSettingsStore } from '../store';

export function SettingsModal() {
  const { modalOpen, close, apiKeyPresent, save, clear } = useSettingsStore();
  const [input, setInput] = useState('');
  if (!modalOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'grid', placeItems: 'center', zIndex: 10 }}>
      <div style={{ background: 'var(--bg-elevated)', color: 'var(--text)', padding: 20, borderRadius: 8, minWidth: 360, border: '1px solid var(--border-soft)' }}>
        <h3 style={{ margin: 0 }}>설정</h3>
        <div style={{ marginTop: 8 }}>
          <label>Gemini API 키</label>
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={apiKeyPresent ? '(이미 저장됨)' : 'AIza...'}
            style={{ width: '100%', padding: 6, marginTop: 4, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {apiKeyPresent && <button onClick={() => void clear()}>삭제</button>}
          <button onClick={close}>취소</button>
          <button
            onClick={async () => { if (input) { await save(input); setInput(''); close(); } }}
            disabled={!input}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
