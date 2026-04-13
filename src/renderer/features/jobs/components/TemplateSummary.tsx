import React from 'react';
import type { Template } from '@shared/types/domain';
import { ImageSlotList } from '@/features/slots/components/ImageSlotList';

export function TemplateSummary({ template }: { template: Template }) {
  return (
    <div style={{ background: '#eee8', padding: 8, borderRadius: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>From template: {template.name}</div>
      <div style={{ whiteSpace: 'pre-wrap', marginTop: 4, fontSize: 13 }}>
        {template.sharedPrompt || <em>(no shared prompt)</em>}
      </div>
      <div style={{ marginTop: 4 }}>
        <ImageSlotList ownerKind="template" ownerId={template.id} readOnly />
      </div>
    </div>
  );
}
