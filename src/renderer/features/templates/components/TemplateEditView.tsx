import React from 'react';
import { useTemplateStore } from '../store';
import { SharedPromptEditor } from './SharedPromptEditor';
import { ImageSlotList } from '@/features/slots/components/ImageSlotList';

export function TemplateEditView() {
  const template = useTemplateStore(s => s.templates.find(t => t.id === s.selectedId));
  const update = useTemplateStore(s => s.update);
  if (!template) return <p style={{ opacity: 0.6 }}>Select a template.</p>;

  return (
    <div>
      <input
        value={template.name}
        onChange={e => void update(template.id, { name: e.target.value })}
        style={{ width: '100%', fontSize: 16, fontWeight: 'bold' }}
      />
      <h5 style={{ marginTop: 12 }}>Shared prompt</h5>
      <SharedPromptEditor template={template} />
      <h5 style={{ marginTop: 12 }}>Shared images</h5>
      <ImageSlotList ownerKind="template" ownerId={template.id} />
    </div>
  );
}
