import React, { useEffect } from 'react';
import { useTemplateStore } from '@/features/templates/store';
import { useJobStore } from '../store';
import { JobListItem } from './JobListItem';
import { JobToolbar } from './JobToolbar';
import { BatchProgressBar } from './BatchProgressBar';

export function JobPanel() {
  const templateId = useTemplateStore(s => s.selectedId);
  const jobsByTemplateId = useJobStore(s => s.jobsByTemplateId);
  const loadByTemplate = useJobStore(s => s.loadByTemplate);
  const jobs = templateId ? jobsByTemplateId[templateId] ?? [] : [];

  useEffect(() => { if (templateId) void loadByTemplate(templateId); }, [templateId, loadByTemplate]);
  if (!templateId) return <section><h4 style={{ marginTop: 0 }}>잡</h4><p style={{ color: 'var(--text-muted)' }}>템플릿을 선택하세요.</p></section>;

  return (
    <section>
      <h4 style={{ marginTop: 0 }}>잡</h4>
      <JobToolbar templateId={templateId} />
      <BatchProgressBar />
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {jobs.map(j => <JobListItem key={j.id} job={j} />)}
      </ul>
    </section>
  );
}
