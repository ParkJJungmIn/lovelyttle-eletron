import React, { useState } from 'react';
import { useTemplateStore } from '../store';
import { TemplateListItem } from './TemplateListItem';
import { TemplateEditView } from './TemplateEditView';

export function TemplatePanel() {
  const { templates, selectedId, create } = useTemplateStore();
  const [name, setName] = useState('');
  const onNew = async () => {
    if (!name.trim()) return;
    await create(name.trim());
    setName('');
  };
  return (
    <section>
      <h4>Templates</h4>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {templates.map(t => <TemplateListItem key={t.id} template={t} active={t.id === selectedId} />)}
      </ul>
      <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New template name" />
        <button onClick={onNew}>+</button>
      </div>
      <hr />
      <TemplateEditView />
    </section>
  );
}
