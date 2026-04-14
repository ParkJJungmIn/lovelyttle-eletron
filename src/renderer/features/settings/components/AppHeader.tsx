import React, { useEffect } from 'react';
import { useSettingsStore } from '../store';
import { SettingsModal } from './SettingsModal';

export function AppHeader() {
  const { apiKeyPresent, open, refresh } = useSettingsStore();
  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <header style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg)', color: 'var(--text)' }}>
      <strong>NanoBanana Factory</strong>
      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
        API 키: {apiKeyPresent ? '설정됨' : '설정 안 됨'}
      </span>
      <button onClick={open} style={{ marginLeft: 12 }}>⚙ 설정</button>
      <SettingsModal />
    </header>
  );
}
