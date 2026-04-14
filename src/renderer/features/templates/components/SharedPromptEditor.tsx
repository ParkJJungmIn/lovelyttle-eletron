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
      style={{ width: '100%', boxSizing: 'border-box' }}
      placeholder="이 템플릿에 속한 모든 잡에 공통으로 적용되는 프롬프트. {변수명} 형식으로 이미지를 참조할 수 있습니다."
    />
  );
}
