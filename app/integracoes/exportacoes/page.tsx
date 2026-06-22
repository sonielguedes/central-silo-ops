"use client";

import React from 'react';
import { withAuth } from '@/components/shared/with-auth';
import { IntegracoesPageShell } from '@/components/integracoes/integracoes-page-shell';

function ExportacoesPage() {
  return (
    <IntegracoesPageShell
      title="Exportações"
      subtitle="Fila e estrutura de exportações futuras para integrações externas"
      integrationName="Exportações"
    />
  );
}

export default withAuth(ExportacoesPage, { module: 'INTEGRACOES' });
