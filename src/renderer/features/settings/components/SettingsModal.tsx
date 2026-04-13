import React, { useState } from 'react';
import { useSettingsStore } from '../store';

export function SettingsModal() {
  const { modalOpen, close, apiKeyPresent, save, clear } = useSettingsStore();
  const [input, setInput] = useState('');
  if (!modalOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0007', display: 'grid', placeItems: 'center', zIndex: 10 }}>
      <div style={{ background: 'white', padding: 20, borderRadius: 8, minWidth: 360 }}>
        <h3>Settings</h3>
        <div style={{ marginTop: 8 }}>
          <label>Gemini API key</label>
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={apiKeyPresent ? '(already saved)' : 'AIza...'}
            style={{ width: '100%', padding: 6, marginTop: 4 }}
          />
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {apiKeyPresent && <button onClick={() => void clear()}>Clear</button>}
          <button onClick={close}>Cancel</button>
          <button
            onClick={async () => { if (input) { await save(input); setInput(''); close(); } }}
            disabled={!input}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
