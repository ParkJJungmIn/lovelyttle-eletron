import React, { useEffect, useState } from 'react';
import type { Template } from '@shared/types/domain';
import { useTemplateStore } from '../store';

export function SharedPromptEditor({ template }: { template: Template }) {
  const update = useTemplateStore(s => s.update);
  const [value, setValue] = useState(template.sharedPrompt);
  useEffect(() => { setValue(template.sharedPrompt); }, [template.id, template.sharedPrompt]);

  return (
    <textarea
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => { if (value !== template.sharedPrompt) void update(template.id, { sharedPrompt: value }); }}
      rows={5}
      style={{ width: '100%' }}
      placeholder="Shared prompt for every job under this template. Use {variableName} to reference images."
    />
  );
}
