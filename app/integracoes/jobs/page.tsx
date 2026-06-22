"use client";

import React from 'react';
import { withAuth } from '@/components/shared/with-auth';
import { IntegracoesPageShell } from '@/components/integracoes/integracoes-page-shell';

function JobsPage() {
  return (
    <IntegracoesPageShell
      title="Jobs de Integração"
      subtitle="Visão operacional dos jobs, filas e reprocessamentos"
      integrationName="Jobs"
    />
  );
}

export default withAuth(JobsPage, { module: 'INTEGRACOES' });
