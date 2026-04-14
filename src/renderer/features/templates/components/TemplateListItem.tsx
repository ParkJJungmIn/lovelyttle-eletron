import React from 'react';
import type { Template } from '@shared/types/domain';
import { useTemplateStore } from '../store';

export function TemplateListItem({ template, active }: { template: Template; active: boolean }) {
  const { select, remove } = useTemplateStore();
  return (
    <li
      onClick={() => select(template.id)}
      style={{
        padding: '4px 6px', borderRadius: 4, cursor: 'pointer',
        background: active ? 'var(--selected-bg)' : 'transparent',
        color: 'var(--text)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.name}</span>
      <button
        onClick={e => { e.stopPropagation(); if (confirm(`템플릿 "${template.name}"을(를) 삭제할까요?`)) void remove(template.id); }}
        style={{ fontSize: 11, padding: '2px 6px' }}
      >
        🗑
      </button>
    </li>
  );
}
