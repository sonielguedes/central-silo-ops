"use client";

import React from 'react';
import { withAuth } from '@/components/shared/with-auth';
import { IntegracoesPageShell } from '@/components/integracoes/integracoes-page-shell';

function LogsPage() {
  return (
    <IntegracoesPageShell
      title="Logs de Integração"
      subtitle="Registro de eventos, respostas e auditoria operacional"
      integrationName="Logs"
    />
  );
}

export default withAuth(LogsPage, { module: 'INTEGRACOES' });
