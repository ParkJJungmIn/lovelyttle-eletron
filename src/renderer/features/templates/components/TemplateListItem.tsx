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
        background: active ? '#cdf' : 'transparent',
        display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      <span style={{ flex: 1 }}>{template.name}</span>
      <button
        onClick={e => { e.stopPropagation(); if (confirm(`Delete template "${template.name}"?`)) void remove(template.id); }}
        style={{ fontSize: 11 }}
      >
        🗑
      </button>
    </li>
  );
}
