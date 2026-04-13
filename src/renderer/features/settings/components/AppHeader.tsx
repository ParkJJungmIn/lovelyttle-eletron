import React, { useEffect } from 'react';
import { useSettingsStore } from '../store';
import { SettingsModal } from './SettingsModal';

export function AppHeader() {
  const { apiKeyPresent, open, refresh } = useSettingsStore();
  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <header style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #ccc3' }}>
      <strong>NanoBanana Factory</strong>
      <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>
        API key: {apiKeyPresent ? 'configured' : 'not set'}
      </span>
      <button onClick={open} style={{ marginLeft: 12 }}>⚙ Settings</button>
      <SettingsModal />
    </header>
  );
}
