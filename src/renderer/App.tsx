import React, { useEffect } from 'react';
import { AppHeader } from './features/settings/components/AppHeader';
import { TemplatePanel } from './features/templates/components/TemplatePanel';
import { JobPanel } from './features/jobs/components/JobPanel';
import { JobDetailPanel } from './features/jobs/components/JobDetailPanel';
import { useTemplateStore } from './features/templates/store';
import { useJobStore } from './features/jobs/store';
import { ipc } from './ipc-client';

export function App() {
  const loadTemplates = useTemplateStore(s => s.load);
  const applyGenerationEvent = useJobStore(s => s.applyGenerationEvent);

  useEffect(() => {
    void loadTemplates();
    const off = ipc.generation.onUpdate(applyGenerationEvent);
    return off;
  }, [loadTemplates, applyGenerationEvent]);

  return (
    <div className="app">
      <AppHeader />
      <div className="main-grid">
        <TemplatePanel />
        <JobPanel />
        <JobDetailPanel />
      </div>
    </div>
  );
}
