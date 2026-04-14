import React, { useState } from 'react';
import { useJobStore } from '../store';
import { useTemplateStore } from '@/features/templates/store';
import { ImageSlotList } from '@/features/slots/components/ImageSlotList';
import { JobPromptEditor } from './JobPromptEditor';
import { TemplateSummary } from './TemplateSummary';
import { PromptPreviewDialog } from './PromptPreviewDialog';
import { GenerationHistoryList } from '@/features/generations/components/GenerationHistoryList';

export function JobDetailPanel() {
  const job = useJobStore(s => {
    if (!s.selectedId) return null;
    for (const list of Object.values(s.jobsByTemplateId)) {
      const found = list.find(j => j.id === s.selectedId);
      if (found) return found;
    }
    return null;
  });
  const update = useJobStore(s => s.update);
  const remove = useJobStore(s => s.remove);
  const template = useTemplateStore(s => job ? s.templates.find(t => t.id === job.templateId) ?? null : null);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!job) return <section><h4 style={{ marginTop: 0 }}>상세</h4><p style={{ color: 'var(--text-muted)' }}>잡을 선택하세요.</p></section>;

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          value={job.name}
          onChange={e => void update(job.id, { name: e.target.value })}
          style={{ flex: 1, fontSize: 16, fontWeight: 'bold', boxSizing: 'border-box' }}
        />
        <button onClick={() => { if (confirm(`잡 "${job.name}"을(를) 삭제할까요?`)) void remove(job.id); }}>🗑</button>
      </div>
      <h5 style={{ marginTop: 12, marginBottom: 6 }}>이미지</h5>
      <ImageSlotList ownerKind="job" ownerId={job.id} />
      <h5 style={{ marginTop: 12, marginBottom: 6 }}>프롬프트</h5>
      <JobPromptEditor job={job} />
      {template && <><h5 style={{ marginTop: 12, marginBottom: 6 }}>템플릿</h5><TemplateSummary template={template} /></>}
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={() => setPreviewOpen(true)}>👁 미리보기</button>
      </div>
      <h5 style={{ marginTop: 12, marginBottom: 6 }}>생성 히스토리</h5>
      <GenerationHistoryList jobId={job.id} />
      <PromptPreviewDialog jobId={job.id} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </section>
  );
}
