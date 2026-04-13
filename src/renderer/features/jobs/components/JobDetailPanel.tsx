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

  if (!job) return <section><h4>Detail</h4><p style={{ opacity: 0.6 }}>Select a job.</p></section>;

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          value={job.name}
          onChange={e => void update(job.id, { name: e.target.value })}
          style={{ flex: 1, fontSize: 16, fontWeight: 'bold' }}
        />
        <button onClick={() => { if (confirm(`Delete job "${job.name}"?`)) void remove(job.id); }}>🗑</button>
      </div>
      <h5 style={{ marginTop: 12 }}>Images</h5>
      <ImageSlotList ownerKind="job" ownerId={job.id} />
      <h5 style={{ marginTop: 12 }}>Prompt</h5>
      <JobPromptEditor job={job} />
      {template && <><h5 style={{ marginTop: 12 }}>Template</h5><TemplateSummary template={template} /></>}
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={() => setPreviewOpen(true)}>👁 Preview</button>
      </div>
      <h5 style={{ marginTop: 12 }}>History</h5>
      <GenerationHistoryList jobId={job.id} />
      <PromptPreviewDialog jobId={job.id} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </section>
  );
}
