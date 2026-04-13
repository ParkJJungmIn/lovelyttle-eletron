import React from 'react';

export function GenerateConfirmDialog(props: {
  open: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!props.open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0007', display: 'grid', placeItems: 'center', zIndex: 10 }}>
      <div style={{ background: 'white', padding: 16, borderRadius: 8, minWidth: 280 }}>
        <p>Generate {props.count} job(s)? This will call the Gemini API {props.count} time(s).</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={props.onCancel}>Cancel</button>
          <button onClick={props.onConfirm}>Generate</button>
        </div>
      </div>
    </div>
  );
}
