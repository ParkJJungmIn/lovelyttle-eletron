import React, { useEffect } from 'react';
import { useTemplateStore } from '@/features/templates/store';
import { useJobStore } from '../store';
import { JobListItem } from './JobListItem';
import { JobToolbar } from './JobToolbar';
import { BatchProgressBar } from './BatchProgressBar';

export function JobPanel() {
  const templateId = useTemplateStore(s => s.selectedId);
  const jobs = useJobStore(s => templateId ? s.jobsByTemplateId[templateId] ?? [] : []);
  const loadByTemplate = useJobStore(s => s.loadByTemplate);

  useEffect(() => { if (templateId) void loadByTemplate(templateId); }, [templateId, loadByTemplate]);
  if (!templateId) return <section><h4>Jobs</h4><p style={{ opacity: 0.6 }}>Select a template.</p></section>;

  return (
    <section>
      <h4>Jobs</h4>
      <JobToolbar templateId={templateId} />
      <BatchProgressBar />
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {jobs.map(j => <JobListItem key={j.id} job={j} />)}
      </ul>
    </section>
  );
}
