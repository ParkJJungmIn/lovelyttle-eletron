import React from 'react';
import { useTemplateStore } from '../store';
import { SharedPromptEditor } from './SharedPromptEditor';
import { ImageSlotList } from '@/features/slots/components/ImageSlotList';

export function TemplateEditView() {
  const template = useTemplateStore(s => s.templates.find(t => t.id === s.selectedId));
  const update = useTemplateStore(s => s.update);
  if (!template) return <p style={{ color: 'var(--text-muted)' }}>템플릿을 선택하세요.</p>;

  return (
    <div>
      <input
        value={template.name}
        onChange={e => void update(template.id, { name: e.target.value })}
        style={{ width: '100%', fontSize: 16, fontWeight: 'bold', boxSizing: 'border-box' }}
      />
      <h5 style={{ marginTop: 12, marginBottom: 6 }}>공통 프롬프트</h5>
      <SharedPromptEditor template={template} />
      <h5 style={{ marginTop: 12, marginBottom: 6 }}>공통 이미지</h5>
      <ImageSlotList ownerKind="template" ownerId={template.id} />
    </div>
  );
}
