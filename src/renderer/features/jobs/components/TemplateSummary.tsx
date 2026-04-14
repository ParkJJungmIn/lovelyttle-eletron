import React from 'react';
import type { Template } from '@shared/types/domain';
import { ImageSlotList } from '@/features/slots/components/ImageSlotList';

export function TemplateSummary({ template }: { template: Template }) {
  return (
    <div style={{ background: 'var(--bg-subtle)', color: 'var(--text)', padding: 8, borderRadius: 6, border: '1px solid var(--border-soft)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>상위 템플릿: {template.name}</div>
      <div style={{ whiteSpace: 'pre-wrap', marginTop: 4, fontSize: 13 }}>
        {template.sharedPrompt || <em style={{ color: 'var(--text-muted)' }}>(공통 프롬프트 없음)</em>}
      </div>
      <div style={{ marginTop: 4 }}>
        <ImageSlotList ownerKind="template" ownerId={template.id} readOnly />
      </div>
    </div>
  );
}
